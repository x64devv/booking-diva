import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import Link from "next/link";
import { getAdminEvent, getReport } from "@/lib/admin-data";
import { dateLong, dateRange, money, shortDay } from "@/lib/format";
import { Columns, Legend, StackedBar } from "@/components/charts";
import { ActionForm } from "@/components/action-form";
import { releaseOverdueAction } from "../actions";
import { PrintButton } from "@/components/print-button";

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const event = await getAdminEvent();
  const r = await getReport(event.id);
  const t = r.totals;
  const cur = event.currency;
  const collectedPct = t.expected > 0 ? Math.min(100, (Number(t.collected) / Number(t.expected)) * 100) : 0;
  const deadlinePassed = !!event.payment_deadline && new Date(event.payment_deadline) < new Date();
  const roleMax = Math.max(1, ...r.by_role.map((x) => x.paid + x.reserved));
  const venueMax = Math.max(1, ...r.by_venue.map((x) => x.paid + x.reserved));

  return (
    <div className="space-y-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{dateRange(event.start_date, event.end_date)} · {event.venue_summary}</p>
          <h1 className="font-display text-4xl font-extrabold uppercase leading-none text-ink-900">{event.name}</h1>
          <p className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-1 font-semibold ${event.is_open ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
              {event.is_open ? "● Registration open" : "○ Registration closed"}
            </span>
            {event.payment_deadline && (
              <span className={`rounded-full px-2.5 py-1 font-semibold ${deadlinePassed ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
                Pay-by {deadlinePassed ? "passed" : "date"}: {dateLong(event.payment_deadline)}
              </span>
            )}
          </p>
        </div>
        <div className="no-print flex gap-2">
          <a href="/admin/export" className="btn-ghost">Export CSV</a>
          <PrintButton />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Registered" value={t.registered} sub={`${t.cancelled + t.expired} cancelled / expired`} />
        <Kpi label="Paid" value={t.paid} sub={t.registered ? `${Math.round((t.paid / t.registered) * 100)}% of registered` : "—"} accent="volt" />
        <Kpi label="Reserved, unpaid" value={t.reserved} sub={t.overdue ? `${t.overdue} past the pay-by date` : "None overdue"} accent="ember" warn={t.overdue > 0} />
        <Kpi label="Cash collected" value={money(t.collected, cur)} sub={`${money(t.outstanding, cur)} outstanding`} />
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Collection progress</h2>
          <p className="text-sm tabular-nums text-slate-600">
            {money(t.collected, cur)} of {money(t.expected, cur)} expected
          </p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-volt-500" style={{ width: `${collectedPct}%` }} />
        </div>
        {t.overdue > 0 && (
          <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
            <p>
              <strong>{t.overdue}</strong> reserved seat(s) are past the pay-by date. Releasing frees seats with no payment at all; part-payers keep theirs.{" "}
              <Link className="font-semibold underline" href="/admin/registrations?status=overdue">Review them</Link>
            </p>
            <ActionForm action={releaseOverdueAction} confirm="Release all overdue seats with no payment? They will be marked Expired." className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="event_id" value={event.id} />
              <button className="btn-danger py-1.5">Release unpaid seats</button>
            </ActionForm>
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Seats by venue</h2>
            <Legend />
          </div>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-2 font-semibold">Venue</th>
                <th className="w-[38%] pb-2" />
                <th className="pb-2 text-right font-semibold">Paid</th>
                <th className="pb-2 text-right font-semibold">Unpaid</th>
                <th className="pb-2 text-right font-semibold">Cap.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.by_venue.map((v) => {
                const used = v.paid + v.reserved;
                const max = venueMax;
                return (
                  <tr key={v.id} className={v.is_active ? "" : "opacity-50"}>
                    <td className="py-2.5 pr-3">
                      <Link href={`/admin/registrations?venue=${v.id}`} className="font-medium hover:underline">{v.name}</Link>
                      {v.overdue > 0 && <span className="ml-1.5 text-xs text-red-700">({v.overdue} overdue)</span>}
                    </td>
                    <td className="py-2.5 pr-3">
                      <StackedBar paid={v.paid} reserved={v.reserved} max={max} label={`${v.name}: ${v.paid} paid, ${v.reserved} unpaid`} />
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{v.paid}</td>
                    <td className="py-2.5 text-right tabular-nums">{v.reserved}</td>
                    <td className="py-2.5 text-right tabular-nums text-slate-500">
                      {v.capacity === null ? "∞" : `${used}/${v.capacity}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Attendees by role</h2>
            <Legend />
          </div>
          {r.by_role.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No registrations yet</p>
          ) : (
            <ul className="mt-4 space-y-2.5 text-sm">
              {r.by_role.map((x) => (
                <li key={x.role} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-3">
                  <Link href={`/admin/registrations?role=${encodeURIComponent(x.role)}`} className="truncate font-medium hover:underline">{x.role}</Link>
                  <StackedBar paid={x.paid} reserved={x.reserved} max={roleMax} label={`${x.role}: ${x.paid} paid, ${x.reserved} unpaid`} />
                  <span className="text-right tabular-nums text-slate-600">{x.paid + x.reserved}</span>
                </li>
              ))}
            </ul>
          )}
          {r.by_gender.length > 0 && (
            <p className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {r.by_gender.map((g) => `${g.gender}: ${g.count}`).join(" · ")}
            </p>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-semibold text-slate-900">Registrations per day</h2>
          <Columns data={r.by_day.slice(-21).map((d) => ({ label: shortDay(d.day), value: d.registrations }))} />
        </section>

        <section className="card p-5">
          <h2 className="font-semibold text-slate-900">Cash received, by admin</h2>
          <p className="text-xs text-slate-500">Use this to reconcile cash handed in by each person at the desk.</p>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="pb-2 font-semibold">Received by</th>
                <th className="pb-2 text-right font-semibold">Payments</th>
                <th className="pb-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.by_collector.length === 0 && (
                <tr><td colSpan={3} className="py-6 text-center text-slate-400">No payments recorded yet</td></tr>
              )}
              {r.by_collector.map((c) => (
                <tr key={c.name}>
                  <td className="py-2">{c.name}</td>
                  <td className="py-2 text-right tabular-nums">{c.payments}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">{money(c.amount, cur)}</td>
                </tr>
              ))}
            </tbody>
            {r.by_collector.length > 0 && (
              <tfoot className="border-t-2 border-slate-200 font-semibold">
                <tr>
                  <td className="pt-2">Total</td>
                  <td className="pt-2 text-right tabular-nums">{r.by_collector.reduce((a, c) => a + Number(c.payments), 0)}</td>
                  <td className="pt-2 text-right tabular-nums">{money(t.collected, cur)}</td>
                </tr>
              </tfoot>
            )}
          </table>

          {r.payments_by_day.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold text-slate-900">Cash received per day</h3>
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {r.payments_by_day.slice().reverse().map((d) => (
                  <li key={d.day} className="flex justify-between py-1.5">
                    <span>{dateLong(d.day)}</span>
                    <span className="tabular-nums"><span className="text-slate-500">{d.payments} × </span><strong>{money(d.amount, cur)}</strong></span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, accent, warn }: { label: string; value: string | number; sub: string; accent?: "volt" | "ember"; warn?: boolean }) {
  return (
    <div className="card relative overflow-hidden p-5">
      {accent && <span className={`absolute inset-y-0 left-0 w-1 ${accent === "volt" ? "bg-volt-500" : "bg-ember-500"}`} />}
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="font-display mt-1 text-4xl font-bold tabular-nums text-ink-900">{value}</p>
      <p className={`mt-1 text-xs ${warn ? "font-semibold text-red-700" : "text-slate-500"}`}>{sub}</p>
    </div>
  );
}
