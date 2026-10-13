import { Suspense } from "react";
import Link from "next/link";
import { getAdminEvent, getVenues, parseFilters, queryRegistrations, PAGE_SIZE } from "@/lib/admin-data";
import { dateTime, money, phoneDisplay } from "@/lib/format";
import { isOverdue } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageSkeleton } from "@/components/page-skeleton";
import { recordPaymentAction } from "../../actions";

export default function RegistrationsPage({ searchParams }: PageProps<"/admin/registrations">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Registrations searchParams={searchParams} />
    </Suspense>
  );
}

const STATUSES = [
  ["", "All"],
  ["active", "Active (paid + unpaid)"],
  ["reserved", "Reserved – unpaid"],
  ["overdue", "Overdue"],
  ["paid", "Paid"],
  ["cancelled", "Cancelled"],
  ["expired", "Expired"],
] as const;

async function Registrations({ searchParams }: { searchParams: PageProps<"/admin/registrations">["searchParams"] }) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const event = await getAdminEvent();
  const [venues, { rows, count }] = await Promise.all([getVenues(event.id), queryRegistrations(event.id, filters)]);
  const page = filters.page ?? 1;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ...filters, ...extra };
    Object.entries(merged).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
    });
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="space-y-5 p-4 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-extrabold uppercase leading-none text-ink-900">Registrations</h1>
          <p className="mt-1 text-sm text-slate-500">{count} matching · search by name, reference, phone or branch</p>
        </div>
        <a href={`/admin/export${qs({ page: undefined })}`} className="btn-ghost no-print">Export these to CSV</a>
      </header>

      <form className="no-print card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]" action="/admin/registrations">
        <input name="q" defaultValue={filters.q} placeholder="Search name, MIH-0001, 0773…" className="field" aria-label="Search" autoFocus />
        <select name="status" defaultValue={filters.status ?? ""} className="field" aria-label="Status">
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="venue" defaultValue={filters.venue ?? ""} className="field" aria-label="Venue">
          <option value="">All venues</option>
          {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <select name="role" defaultValue={filters.role ?? ""} className="field" aria-label="Role">
          <option value="">All roles</option>
          {event.roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="btn-dark">Filter</button>
          <Link href="/admin/registrations" className="btn-ghost">Clear</Link>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Ref</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Venue</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Paid / due</th>
              <th className="no-print px-4 py-3 font-semibold">Take cash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No registrations match these filters.</td></tr>
            )}
            {rows.map((r) => {
              const balance = Math.max(0, Number(r.amount_due) - Number(r.amount_paid));
              return (
                <tr key={r.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <Link href={`/admin/registrations/${r.id}`} className="whitespace-nowrap font-mono font-semibold text-volt-500 hover:underline">{r.reference}</Link>
                    <p className="mt-0.5 whitespace-nowrap text-[11px] text-slate-400">{dateTime(r.created_at)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{r.full_name}</p>
                    {r.branch && <p className="text-xs text-slate-500">{r.branch}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{phoneDisplay(r.phone)}</td>
                  <td className="px-4 py-3">{r.role}</td>
                  <td className="px-4 py-3">{r.venues?.name}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} overdue={isOverdue(r)} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {money(r.amount_paid, event.currency)} <span className="text-slate-400">/ {money(r.amount_due, event.currency)}</span>
                  </td>
                  <td className="no-print px-4 py-2">
                    {r.status === "reserved" && balance > 0 ? (
                      <ActionForm action={recordPaymentAction} className="flex w-56 flex-wrap items-center gap-1.5">
                        <input type="hidden" name="registration_id" value={r.id} />
                        <input type="hidden" name="amount" value={balance} />
                        <input name="receipt_no" placeholder="Receipt # (opt.)" className="field w-28 px-2 py-1.5 text-xs" aria-label="Receipt number" />
                        <SubmitButton className="btn-primary px-3 py-1.5 text-xs" pendingText="…">
                          Paid {money(balance, event.currency)}
                        </SubmitButton>
                      </ActionForm>
                    ) : (
                      <Link href={`/admin/registrations/${r.id}`} className="text-xs font-semibold text-slate-500 hover:text-slate-900">Details →</Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav className="no-print flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && <Link className="btn-ghost" href={`/admin/registrations${qs({ page: page - 1 })}`}>← Previous</Link>}
            {page < pages && <Link className="btn-ghost" href={`/admin/registrations${qs({ page: page + 1 })}`}>Next →</Link>}
          </div>
        </nav>
      )}
    </div>
  );
}
