-- =====================================================================
-- Event registration: seat reservation until cash payment + admin reports
-- Run this once in the Supabase SQL editor (or `supabase db push`).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.events (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique,
  name                   text not null,
  theme                  text,
  organiser              text,
  start_date             date not null,
  end_date               date not null,
  venue_summary          text,
  fee_amount             numeric(10,2) not null default 0 check (fee_amount >= 0),
  currency               text not null default 'USD',
  registration_deadline  timestamptz,           -- null = no deadline
  payment_deadline       timestamptz,           -- seats are held until this moment
  contact_name           text,
  contact_phone          text,
  roles                  text[] not null default array[
                           'Pastor','Leader','HOD','Homegroup Leader',
                           'Deacon / Deaconess','Partner','Tither','Other'],
  ref_prefix             text not null default 'REG',
  ref_seq                integer not null default 0,
  is_open                boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.venues (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  name        text not null,
  capacity    integer check (capacity is null or capacity >= 0),  -- null = unlimited
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (event_id, name)
);

do $$ begin
  create type public.registration_status as enum ('reserved','paid','cancelled','expired');
exception when duplicate_object then null; end $$;

create table if not exists public.registrations (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  venue_id        uuid not null references public.venues(id),
  reference       text not null unique,
  full_name       text not null,
  phone           text not null,           -- normalised, e.g. +263773126865
  email           text,
  gender          text check (gender in ('Male','Female')),
  role            text not null,
  branch          text,                    -- home church / assembly / zone
  status          public.registration_status not null default 'reserved',
  amount_due      numeric(10,2) not null,
  amount_paid     numeric(10,2) not null default 0,
  reserved_until  timestamptz,
  paid_at         timestamptz,
  cancelled_at    timestamptz,
  cancel_reason   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- one active registration per phone number per event
create unique index if not exists registrations_active_phone_uq
  on public.registrations (event_id, phone)
  where status in ('reserved','paid');

create index if not exists registrations_event_status_idx on public.registrations (event_id, status);
create index if not exists registrations_venue_idx        on public.registrations (venue_id);

create table if not exists public.admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.payments (
  id               uuid primary key default gen_random_uuid(),
  registration_id  uuid not null references public.registrations(id) on delete cascade,
  amount           numeric(10,2) not null check (amount > 0),
  method           text not null default 'Cash',
  receipt_no       text,
  notes            text,
  received_by      uuid references public.admins(user_id),
  received_at      timestamptz not null default now(),
  voided_at        timestamptz,
  voided_by        uuid references public.admins(user_id),
  void_reason      text
);

create index if not exists payments_registration_idx on public.payments (registration_id);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Zimbabwe-friendly phone normalisation: 0773 126 865 -> +263773126865
create or replace function public.normalize_phone(p text)
returns text
language plpgsql immutable
as $$
declare d text := regexp_replace(coalesce(p,''), '\D', '', 'g');
begin
  if d = '' then return null; end if;
  if left(d, 5) = '00263' then d := substr(d, 3); end if;
  if left(d, 1) = '0' and length(d) = 10 then d := '263' || substr(d, 2); end if;
  if length(d) = 9 and left(d, 1) = '7' then d := '263' || d; end if;
  if length(d) < 9 or length(d) > 15 then return null; end if;
  return '+' || d;
end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

drop trigger if exists registrations_touch on public.registrations;
create trigger registrations_touch before update on public.registrations
  for each row execute function public.touch_updated_at();

-- Recalculate amount_paid / status from non-voided payments
create or replace function public.refresh_registration_payment(p_registration_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_paid numeric(10,2);
  v_last timestamptz;
begin
  select coalesce(sum(amount),0), max(received_at)
    into v_paid, v_last
    from public.payments
   where registration_id = p_registration_id and voided_at is null;

  update public.registrations r
     set amount_paid = v_paid,
         status = case
                    when r.status in ('cancelled','expired') then r.status
                    when v_paid >= r.amount_due then 'paid'::public.registration_status
                    else 'reserved'::public.registration_status
                  end,
         paid_at = case when v_paid >= r.amount_due then coalesce(r.paid_at, v_last) else null end
   where r.id = p_registration_id;
end $$;

-- Seats in use at a venue (reserved + paid)
create or replace function public.venue_seats_taken(p_venue_id uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::int from public.registrations
   where venue_id = p_venue_id and status in ('reserved','paid');
$$;

-- ---------------------------------------------------------------------
-- Public API (callable with the anon / publishable key)
-- ---------------------------------------------------------------------

-- Public event info incl. remaining seats per venue
create or replace function public.get_public_event(p_slug text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id, 'slug', e.slug, 'name', e.name, 'theme', e.theme, 'organiser', e.organiser,
    'start_date', e.start_date, 'end_date', e.end_date, 'venue_summary', e.venue_summary,
    'fee_amount', e.fee_amount, 'currency', e.currency,
    'registration_deadline', e.registration_deadline, 'payment_deadline', e.payment_deadline,
    'contact_name', e.contact_name, 'contact_phone', e.contact_phone,
    'roles', to_jsonb(e.roles), 'is_open', e.is_open,
    'accepting', e.is_open and (e.registration_deadline is null or now() <= e.registration_deadline),
    'venues', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'name', v.name, 'capacity', v.capacity,
               'seats_left', case when v.capacity is null then null
                                  else greatest(v.capacity - public.venue_seats_taken(v.id), 0) end)
             order by v.sort_order, v.name)
        from public.venues v where v.event_id = e.id and v.is_active), '[]'::jsonb)
  )
  from public.events e where e.slug = p_slug;
$$;

create or replace function public.register_attendee(
  p_event_slug text,
  p_full_name  text,
  p_phone      text,
  p_email      text,
  p_gender     text,
  p_role       text,
  p_branch     text,
  p_venue_id   uuid
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  e        public.events%rowtype;
  v        public.venues%rowtype;
  v_phone  text := public.normalize_phone(p_phone);
  v_name   text := nullif(btrim(regexp_replace(coalesce(p_full_name,''), '\s+', ' ', 'g')), '');
  v_email  text := nullif(lower(btrim(coalesce(p_email,''))), '');
  v_ref    text;
  v_exist  text;
  r        public.registrations%rowtype;
begin
  -- lock the event row: serialises registrations so capacity + reference numbers are safe
  select * into e from public.events where slug = p_event_slug for update;
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode = 'P0001'; end if;
  if not e.is_open or (e.registration_deadline is not null and now() > e.registration_deadline) then
    raise exception 'REGISTRATION_CLOSED' using errcode = 'P0001';
  end if;

  if v_name is null or length(v_name) < 3 then raise exception 'INVALID_NAME' using errcode = 'P0001'; end if;
  if v_phone is null then raise exception 'INVALID_PHONE' using errcode = 'P0001'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_EMAIL' using errcode = 'P0001';
  end if;
  if p_gender is not null and p_gender not in ('Male','Female') then
    raise exception 'INVALID_GENDER' using errcode = 'P0001';
  end if;
  if p_role is null or not (p_role = any(e.roles)) then raise exception 'INVALID_ROLE' using errcode = 'P0001'; end if;

  select * into v from public.venues where id = p_venue_id and event_id = e.id and is_active;
  if not found then raise exception 'INVALID_VENUE' using errcode = 'P0001'; end if;

  select reference into v_exist from public.registrations
   where event_id = e.id and phone = v_phone and status in ('reserved','paid');
  if found then raise exception 'ALREADY_REGISTERED:%', v_exist using errcode = 'P0001'; end if;

  if v.capacity is not null and public.venue_seats_taken(v.id) >= v.capacity then
    raise exception 'VENUE_FULL' using errcode = 'P0001';
  end if;

  update public.events set ref_seq = ref_seq + 1 where id = e.id returning ref_seq into e.ref_seq;
  v_ref := e.ref_prefix || '-' || lpad(e.ref_seq::text, 4, '0');

  insert into public.registrations
    (event_id, venue_id, reference, full_name, phone, email, gender, role, branch,
     status, amount_due, reserved_until)
  values
    (e.id, v.id, v_ref, v_name, v_phone, v_email, p_gender, p_role,
     nullif(btrim(coalesce(p_branch,'')), ''),
     case when e.fee_amount = 0 then 'paid'::public.registration_status else 'reserved' end,
     e.fee_amount, e.payment_deadline)
  returning * into r;

  return jsonb_build_object(
    'reference', r.reference, 'full_name', r.full_name, 'phone', r.phone,
    'venue', v.name, 'status', r.status, 'amount_due', r.amount_due,
    'currency', e.currency, 'reserved_until', r.reserved_until,
    'contact_name', e.contact_name, 'contact_phone', e.contact_phone);
end $$;

-- Attendee self-service status check (needs reference AND phone)
create or replace function public.lookup_registration(p_reference text, p_phone text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'reference', r.reference, 'full_name', r.full_name, 'status', r.status,
    'venue', v.name, 'amount_due', r.amount_due, 'amount_paid', r.amount_paid,
    'currency', e.currency, 'reserved_until', r.reserved_until, 'paid_at', r.paid_at,
    'event_name', e.name, 'start_date', e.start_date, 'end_date', e.end_date,
    'contact_name', e.contact_name, 'contact_phone', e.contact_phone)
  from public.registrations r
  join public.venues v on v.id = r.venue_id
  join public.events e on e.id = r.event_id
  where upper(r.reference) = upper(btrim(p_reference))
    and r.phone = public.normalize_phone(p_phone);
$$;

-- ---------------------------------------------------------------------
-- Admin API (authenticated + listed in public.admins)
-- ---------------------------------------------------------------------

create or replace function public.assert_admin()
returns void language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'NOT_AUTHORISED' using errcode = '42501'; end if;
end $$;

create or replace function public.record_payment(
  p_registration_id uuid,
  p_amount          numeric,
  p_receipt_no      text default null,
  p_notes           text default null,
  p_method          text default 'Cash'
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare r public.registrations%rowtype;
begin
  perform public.assert_admin();
  select * into r from public.registrations where id = p_registration_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if r.status in ('cancelled','expired') then raise exception 'REGISTRATION_INACTIVE' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT' using errcode = 'P0001'; end if;

  insert into public.payments (registration_id, amount, method, receipt_no, notes, received_by)
  values (r.id, p_amount, coalesce(nullif(btrim(p_method),''),'Cash'),
          nullif(btrim(coalesce(p_receipt_no,'')),''), nullif(btrim(coalesce(p_notes,'')),''), auth.uid());

  perform public.refresh_registration_payment(r.id);
  select * into r from public.registrations where id = r.id;
  return jsonb_build_object('reference', r.reference, 'status', r.status, 'amount_paid', r.amount_paid);
end $$;

create or replace function public.void_payment(p_payment_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_reg uuid;
begin
  perform public.assert_admin();
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
  update public.payments
     set voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
   where id = p_payment_id and voided_at is null
  returning registration_id into v_reg;
  if v_reg is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  perform public.refresh_registration_payment(v_reg);
end $$;

create or replace function public.cancel_registration(p_registration_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.assert_admin();
  update public.registrations
     set status = 'cancelled', cancelled_at = now(),
         cancel_reason = nullif(btrim(coalesce(p_reason,'')),'')
   where id = p_registration_id and status in ('reserved','paid');
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
end $$;

create or replace function public.reinstate_registration(p_registration_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.registrations%rowtype;
  v public.venues%rowtype;
begin
  perform public.assert_admin();
  select * into r from public.registrations where id = p_registration_id for update;
  if not found or r.status not in ('cancelled','expired') then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  perform 1 from public.events where id = r.event_id for update;  -- serialise with registrations
  if exists (select 1 from public.registrations
              where event_id = r.event_id and phone = r.phone and status in ('reserved','paid')) then
    raise exception 'ALREADY_REGISTERED' using errcode = 'P0001';
  end if;
  select * into v from public.venues where id = r.venue_id;
  if v.capacity is not null and public.venue_seats_taken(v.id) >= v.capacity then
    raise exception 'VENUE_FULL' using errcode = 'P0001';
  end if;
  update public.registrations
     set status = case when amount_paid >= amount_due then 'paid'::public.registration_status else 'reserved' end,
         cancelled_at = null, cancel_reason = null,
         reserved_until = greatest(coalesce(reserved_until, now()), now() + interval '1 day')
   where id = r.id;
end $$;

-- Release seats held by people who did not pay by the deadline
create or replace function public.release_overdue_reservations(p_event_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  perform public.assert_admin();
  update public.registrations
     set status = 'expired', cancelled_at = now(), cancel_reason = 'Not paid by deadline'
   where event_id = p_event_id and status = 'reserved'
     and amount_paid = 0                       -- part-payers keep their seat
     and reserved_until is not null and reserved_until < now();
  get diagnostics n = row_count;
  return n;
end $$;

-- One-shot report for the admin dashboard
create or replace function public.admin_event_report(p_event_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  perform public.assert_admin();
  with regs as (
    select r.*, (r.status = 'reserved' and r.reserved_until is not null and r.reserved_until < now()) as overdue
      from public.registrations r where r.event_id = p_event_id
  ), pays as (
    select p.* from public.payments p join regs r on r.id = p.registration_id where p.voided_at is null
  )
  select jsonb_build_object(
    'totals', (select jsonb_build_object(
        'registered', count(*) filter (where status in ('reserved','paid')),
        'paid',       count(*) filter (where status = 'paid'),
        'reserved',   count(*) filter (where status = 'reserved'),
        'overdue',    count(*) filter (where overdue),
        'cancelled',  count(*) filter (where status = 'cancelled'),
        'expired',    count(*) filter (where status = 'expired'),
        'expected',   coalesce(sum(amount_due) filter (where status in ('reserved','paid')),0),
        'collected',  (select coalesce(sum(amount),0) from pays),
        'outstanding',coalesce(sum(greatest(amount_due - amount_paid,0)) filter (where status = 'reserved'),0)
      ) from regs),
    'by_venue', (select coalesce(jsonb_agg(x order by x->>'sort_order', x->>'name'), '[]'::jsonb) from (
        select jsonb_build_object(
          'id', v.id, 'name', v.name, 'capacity', v.capacity, 'sort_order', lpad(v.sort_order::text,5,'0'),
          'is_active', v.is_active,
          'paid',     count(r.id) filter (where r.status = 'paid'),
          'reserved', count(r.id) filter (where r.status = 'reserved'),
          'overdue',  count(r.id) filter (where r.overdue),
          'collected', coalesce(sum(r.amount_paid) filter (where r.status in ('reserved','paid')),0)
        ) x
        from public.venues v left join regs r on r.venue_id = v.id
        where v.event_id = p_event_id group by v.id) s),
    'by_role', (select coalesce(jsonb_agg(jsonb_build_object(
          'role', role, 'paid', paid, 'reserved', reserved) order by paid + reserved desc), '[]'::jsonb) from (
        select role, count(*) filter (where status='paid') paid, count(*) filter (where status='reserved') reserved
          from regs where status in ('reserved','paid') group by role) s),
    'by_gender', (select coalesce(jsonb_agg(jsonb_build_object('gender', g, 'count', c) order by c desc), '[]'::jsonb) from (
        select coalesce(gender,'Not given') g, count(*) c from regs where status in ('reserved','paid') group by 1) s),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'registrations', c) order by d), '[]'::jsonb) from (
        select (created_at at time zone 'Africa/Harare')::date d, count(*) c from regs group by 1) s),
    'by_collector', (select coalesce(jsonb_agg(jsonb_build_object(
          'name', name, 'payments', n, 'amount', amt) order by amt desc), '[]'::jsonb) from (
        select coalesce(a.full_name,'Unknown') name, count(*) n, sum(p.amount) amt
          from pays p left join public.admins a on a.user_id = p.received_by group by 1) s),
    'payments_by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'amount', amt, 'payments', n) order by d), '[]'::jsonb) from (
        select (received_at at time zone 'Africa/Harare')::date d, sum(amount) amt, count(*) n from pays group by 1) s)
  ) into result;
  return result;
end $$;

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------

alter table public.events        enable row level security;
alter table public.venues        enable row level security;
alter table public.registrations enable row level security;
alter table public.payments      enable row level security;
alter table public.admins        enable row level security;

drop policy if exists events_admin_all on public.events;
create policy events_admin_all on public.events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists venues_admin_all on public.venues;
create policy venues_admin_all on public.venues
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists registrations_admin_select on public.registrations;
create policy registrations_admin_select on public.registrations
  for select to authenticated using (public.is_admin());

drop policy if exists registrations_admin_update on public.registrations;
create policy registrations_admin_update on public.registrations
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists payments_admin_select on public.payments;
create policy payments_admin_select on public.payments
  for select to authenticated using (public.is_admin());

drop policy if exists admins_select on public.admins;
create policy admins_select on public.admins
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Anonymous visitors never touch tables directly; only the public functions.
revoke all on public.events, public.venues, public.registrations, public.payments, public.admins from anon;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_public_event(text)                 to anon, authenticated;
grant execute on function public.register_attendee(text,text,text,text,text,text,text,uuid) to anon, authenticated;
grant execute on function public.lookup_registration(text,text)         to anon, authenticated;
grant execute on function public.is_admin()                              to authenticated;
grant execute on function public.record_payment(uuid,numeric,text,text,text) to authenticated;
grant execute on function public.void_payment(uuid,text)                to authenticated;
grant execute on function public.cancel_registration(uuid,text)         to authenticated;
grant execute on function public.reinstate_registration(uuid)           to authenticated;
grant execute on function public.release_overdue_reservations(uuid)     to authenticated;
grant execute on function public.admin_event_report(uuid)               to authenticated;

-- ---------------------------------------------------------------------
-- Seed: Pastors and Leaders Training 2026 (edit in Admin → Settings)
-- ---------------------------------------------------------------------

insert into public.events (slug, name, theme, organiser, start_date, end_date, venue_summary,
                           fee_amount, currency, registration_deadline, payment_deadline,
                           contact_name, contact_phone, ref_prefix)
values ('leaders-training-2026', 'Pastors and Leaders Training', 'Making It Happen!',
        'Heartfelt International Ministries', '2026-10-22', '2026-10-26', 'IOC and Regions',
        5.00, 'USD',
        '2026-10-18 23:59:00+02',   -- registration closes (adjust in Settings)
        '2026-10-18 23:59:00+02',   -- unpaid seats are held until here
        'Events Team', '0773126865', 'MIH')
on conflict (slug) do nothing;

insert into public.venues (event_id, name, sort_order)
select e.id, v.name, v.ord
  from public.events e,
       (values ('IOC', 1), ('Chikanga Zone', 2)) as v(name, ord)
 where e.slug = 'leaders-training-2026'
on conflict (event_id, name) do nothing;
