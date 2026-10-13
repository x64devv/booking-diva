# booking-diva

Online registration and seat reservation for the **Pastors & Leaders Training 2026 — "Making It Happen!"**

A Next.js 16 + Supabase app where people register online and **reserve a seat until they pay cash**. The Events Team then records payments on a protected admin site that also has reports.

## What's in it

**Public site**
- `/` shows the event details (theme, dates, venue, fee, pay-by date) and the registration form. Each person gets a reference such as `MIH-0001`.
- `/status` lets a person check their registration with their reference and phone number.
- Each venue/region can have a capacity, and the form shows how many seats are left. A phone number can only have one active registration.

**Admin (`/admin`, sign-in required)**
- **Dashboard:** registered, paid, unpaid and overdue counts, cash collected vs expected, seats by venue, attendees by role and gender, registrations per day, and cash received per admin and per day (for reconciling the cash desk). There is also a CSV export and a print view.
- **Registrations:** search by name, reference, phone or branch and filter by status, venue or role. A one-click **"Paid $5.00"** button covers the cash desk; you can add a receipt number too. You can also export the filtered list to CSV.
- **Registration detail:** record full or part payments (Cash, EcoCash, bank transfer), void a payment (a reason is required and the record is kept), cancel or reinstate.
- **Settings:** edit the event (fee, dates, deadlines, roles, contact, open or closed), add and edit venues and capacities, and release overdue unpaid seats.

## How a seat works

| Status | Meaning | Holds a seat? |
|---|---|---|
| `reserved` | Registered, not fully paid. Shows as **Overdue** after the pay-by date | Yes |
| `paid` | Payments ≥ fee | Yes |
| `cancelled` | Cancelled by an admin | No |
| `expired` | Released by an admin because it wasn't paid by the deadline | No |

Seats are **not** released automatically. An admin clicks **Release unpaid seats**. Only reservations with **no payment at all** are released, so people who paid part of the fee keep their seat. Changing the pay-by date in Settings can also extend every current reservation.

## Setup

1. **Create a Supabase project** at https://supabase.com.
2. **Create the database:** open *SQL Editor*, paste the contents of `supabase/migrations/20261013000000_event_registration.sql` and run it. This creates the tables, security rules and functions, and seeds the event plus two venues (`IOC`, `Chikanga Zone`).
3. **Create your first admin:**
   - In *Authentication → Users*, click *Add user* and give it an email and password (tick *Auto confirm*).
   - In the SQL editor, run:
     ```sql
     insert into public.admins (user_id, full_name)
     select id, 'Your Name' from auth.users where email = 'you@example.com';
     ```
   - Repeat for every Events Team member who will take cash. Each payment records who received it.
4. **Configure the app:**
   ```bash
   cp .env.example .env.local
   # fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   # (Project Settings → API; the legacy anon key also works)
   npm install
   npm run dev        # http://localhost:3000
   ```
5. **Deploy:** push to GitHub and import the repo into Vercel (or run `npm run build && npm start` on any Node 20+ host). Set the same environment variables there.

## Security model

- Anonymous visitors **cannot read any table**. They can only call three database functions: `get_public_event`, `register_attendee` and `lookup_registration`. The lookup needs both the reference and the phone number.
- Admin access is checked twice. The proxy (`src/proxy.ts`) refreshes the session and sends signed-out users to the login page. Every admin page, action and the CSV export also call `requireAdmin()`, which verifies the JWT with `getClaims()` and checks the `admins` table.
- In the database, row-level security allows reads only for users listed in `admins`. Payments, cancellations and releases go through `SECURITY DEFINER` functions that check `is_admin()` themselves.
- Registrations lock the event row, so two people can't take the last seat or get the same reference number.

## Project layout

```
supabase/migrations/…sql         schema, RLS, functions, seed
src/proxy.ts                     session refresh + /admin guard (Next 16 "proxy", formerly middleware)
src/lib/                         supabase clients, admin DAL, formatting, types
src/app/page.tsx                 public page + registration form
src/app/status/                  registration lookup
src/app/admin/login/             sign in
src/app/admin/(dashboard)/       dashboard, registrations, detail, settings
src/app/admin/export/route.ts    CSV export
```

## Notes

- All dates and times are shown in Harare time (CAT, UTC+2).
- Phone numbers are normalised, so `0773 126 865`, `+263773126865` and `263773126865` are treated as the same person.
- To run another event later, insert a new row in `events` (with its venues) and set `NEXT_PUBLIC_EVENT_SLUG` to its slug.
