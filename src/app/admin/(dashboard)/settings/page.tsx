import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { getAdminEvent, getVenues, listAdmins } from "@/lib/admin-data";
import { dateTime, toLocalInput } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { releaseOverdueAction, saveVenueAction, updateEventAction } from "../../actions";

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const event = await getAdminEvent();
  const [venues, admins] = await Promise.all([getVenues(event.id), listAdmins()]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <h1 className="font-display text-4xl font-extrabold uppercase leading-none text-ink-900">Settings</h1>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Event</h2>
        <p className="text-sm text-slate-500">All times are Harare time (CAT).</p>
        <ActionForm action={updateEventAction} className="mt-4 grid gap-4 sm:grid-cols-2">
                        <input type="hidden" name="id" value={event.id} />
              <F label="Event name" name="name" defaultValue={event.name} required />
              <F label="Theme" name="theme" defaultValue={event.theme ?? ""} />
              <F label="Organiser" name="organiser" defaultValue={event.organiser ?? ""} />
              <F label="Venue summary (shown publicly)" name="venue_summary" defaultValue={event.venue_summary ?? ""} />
              <F label="Start date" name="start_date" type="date" defaultValue={event.start_date} required />
              <F label="End date" name="end_date" type="date" defaultValue={event.end_date} required />
              <F label="Registration fee" name="fee_amount" type="number" step="0.01" min="0" defaultValue={String(event.fee_amount)} required />
              <F label="Currency" name="currency" defaultValue={event.currency} />
              <F label="Registration closes" name="registration_deadline" type="datetime-local" defaultValue={toLocalInput(event.registration_deadline)} hint="Blank = no deadline" />
              <div>
                <F label="Pay-by date (seats held until)" name="payment_deadline" type="datetime-local" defaultValue={toLocalInput(event.payment_deadline)} />
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" name="apply_deadline" defaultChecked className="accent-volt-500" />
                  Apply this date to everyone currently reserved
                </label>
              </div>
              <F label="Contact name" name="contact_name" defaultValue={event.contact_name ?? ""} />
              <F label="Contact phone" name="contact_phone" defaultValue={event.contact_phone ?? ""} />
              <F label="Reference prefix" name="ref_prefix" defaultValue={event.ref_prefix} hint="e.g. MIH → MIH-0001" />
              <div>
                <label className="label" htmlFor="roles">Roles (one per line)</label>
                <textarea id="roles" name="roles" rows={6} className="field" defaultValue={event.roles.join("\n")} />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
                <input type="checkbox" name="is_open" defaultChecked={event.is_open} className="size-4 accent-volt-500" />
                Registration is open to the public
              </label>
              <div className="sm:col-span-2">
                <SubmitButton className="btn-primary" pendingText="Saving…">{"Save event settings"}</SubmitButton>
              </div>
        </ActionForm>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Venues &amp; capacity</h2>
        <p className="text-sm text-slate-500">Leave capacity blank for unlimited seats. Untick “Active” to hide a venue from the public form.</p>
        <div className="mt-4 space-y-3">
          {venues.map((v) => (
            <VenueRow key={v.id} eventId={event.id} venue={v} />
          ))}
          <div className="border-t border-dashed border-slate-200 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Add a venue / region</p>
            <VenueRow eventId={event.id} />
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Release unpaid seats</h2>
        <p className="text-sm text-slate-500">
          Marks every reservation that is past its pay-by date with no payment as <strong>Expired</strong>, freeing the seat. Part-payers are kept.
        </p>
        <ActionForm action={releaseOverdueAction} confirm="Release all overdue, unpaid seats?" className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="event_id" value={event.id} />
          <button className="btn-danger">Release overdue seats now</button>
        </ActionForm>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Admins</h2>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {admins.map((a) => (
            <li key={a.user_id} className="flex justify-between py-2">
              <span className="font-medium">{a.full_name}</span>
              <span className="text-slate-500">since {dateTime(a.created_at)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          To add an admin: create the user in Supabase → Authentication → Users, then run in the SQL editor:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
{`insert into public.admins (user_id, full_name)
select id, 'Their Name' from auth.users where email = 'them@example.com';`}
        </pre>
      </section>
    </div>
  );
}

function F({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={props.name}>{label}</label>
      <input id={props.name} className="field" {...props} />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function VenueRow({ eventId, venue }: { eventId: string; venue?: { id: string; name: string; capacity: number | null; sort_order: number; is_active: boolean } }) {
  return (
    <ActionForm action={saveVenueAction} resetOnSuccess={!venue} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[2fr_1fr_5rem_auto_auto]">
                <input type="hidden" name="event_id" value={eventId} />
          {venue && <input type="hidden" name="id" value={venue.id} />}
          <input name="name" defaultValue={venue?.name} placeholder="Venue name" required className="field col-span-2 sm:col-span-1" aria-label="Venue name" />
          <input name="capacity" type="number" min="0" defaultValue={venue?.capacity ?? ""} placeholder="Capacity" className="field" aria-label="Capacity" />
          <input name="sort_order" type="number" defaultValue={venue?.sort_order ?? 0} className="field" aria-label="Sort order" title="Sort order" />
          <label className="flex items-center gap-1.5 pb-2.5 text-sm">
            <input type="checkbox" name="is_active" defaultChecked={venue?.is_active ?? true} className="accent-volt-500" /> Active
          </label>
          <SubmitButton className={venue ? "btn-ghost" : "btn-dark"}>{venue ? "Save" : "Add"}</SubmitButton>
    </ActionForm>
  );
}
