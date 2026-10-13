import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminEvent, getRegistration } from "@/lib/admin-data";
import { dateLong, dateTime, money, phoneDisplay } from "@/lib/format";
import { isOverdue } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PageSkeleton } from "@/components/page-skeleton";
import {
  cancelRegistrationAction,
  recordPaymentAction,
  reinstateRegistrationAction,
  voidPaymentAction,
} from "../../../actions";

export default function RegistrationPage({ params }: PageProps<"/admin/registrations/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: PageProps<"/admin/registrations/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [event, { registration: r, payments }] = await Promise.all([getAdminEvent(), getRegistration(id)]);
  if (!r) notFound();

  const cur = event.currency;
  const balance = Math.max(0, Number(r.amount_due) - Number(r.amount_paid));
  const active = r.status === "reserved" || r.status === "paid";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <Link href="/admin/registrations" className="no-print text-sm text-slate-500 hover:text-slate-900">← All registrations</Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm font-semibold text-volt-500">{r.reference}</p>
          <h1 className="font-display text-4xl font-extrabold uppercase leading-none text-ink-900">{r.full_name}</h1>
          <p className="mt-1 text-sm text-slate-500">Registered {dateTime(r.created_at)}</p>
        </div>
        <StatusBadge status={r.status} overdue={isOverdue(r)} />
      </header>

      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <section className="card p-5">
          <h2 className="font-semibold">Details</h2>
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-slate-500">Phone</dt>
            <dd><a className="font-medium hover:underline" href={`tel:${r.phone}`}>{phoneDisplay(r.phone)}</a></dd>
            <dt className="text-slate-500">Email</dt><dd>{r.email ?? "—"}</dd>
            <dt className="text-slate-500">Gender</dt><dd>{r.gender ?? "—"}</dd>
            <dt className="text-slate-500">Role</dt><dd>{r.role}</dd>
            <dt className="text-slate-500">Branch / zone</dt><dd>{r.branch ?? "—"}</dd>
            <dt className="text-slate-500">Venue</dt><dd className="font-medium">{r.venues?.name}</dd>
            <dt className="text-slate-500">Seat held until</dt><dd>{r.status === "reserved" ? dateLong(r.reserved_until) : "—"}</dd>
            {r.cancel_reason && (<><dt className="text-slate-500">Cancel reason</dt><dd>{r.cancel_reason}</dd></>)}
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Payment</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Due" value={money(r.amount_due, cur)} />
            <Stat label="Paid" value={money(r.amount_paid, cur)} />
            <Stat label="Balance" value={money(balance, cur)} strong={balance > 0} />
          </div>

          {r.status === "reserved" && (
            <ActionForm action={recordPaymentAction} resetOnSuccess className="no-print mt-4 grid grid-cols-2 gap-2">
                                <input type="hidden" name="registration_id" value={r.id} />
                  <div>
                    <label className="label text-xs" htmlFor="amount">Amount ({cur})</label>
                    <input id="amount" name="amount" type="number" step="0.01" min="0.01" defaultValue={balance} required className="field" />
                  </div>
                  <div>
                    <label className="label text-xs" htmlFor="method">Method</label>
                    <select id="method" name="method" className="field" defaultValue="Cash">
                      <option>Cash</option>
                      <option>EcoCash</option>
                      <option>Bank transfer</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs" htmlFor="receipt_no">Receipt no.</label>
                    <input id="receipt_no" name="receipt_no" className="field" />
                  </div>
                  <div>
                    <label className="label text-xs" htmlFor="notes">Notes</label>
                    <input id="notes" name="notes" className="field" />
                  </div>
                  <SubmitButton className="btn-primary col-span-2" pendingText="Saving…">{"Record payment"}</SubmitButton>
            </ActionForm>
          )}
        </section>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold">Payment history</h2>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No payments recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {payments.map((p) => (
              <li key={p.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${p.voided_at ? "opacity-60" : ""}`}>
                <div>
                  <p className={`font-semibold tabular-nums ${p.voided_at ? "line-through" : ""}`}>
                    {money(p.amount, cur)} <span className="font-normal text-slate-500">{p.method}{p.receipt_no ? ` · receipt ${p.receipt_no}` : ""}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {dateTime(p.received_at)} · received by {p.receiver?.full_name ?? "unknown"}
                    {p.notes ? ` · ${p.notes}` : ""}
                  </p>
                  {p.voided_at && (
                    <p className="text-xs font-medium text-red-700">
                      Voided {dateTime(p.voided_at)} by {p.voider?.full_name ?? "unknown"}: {p.void_reason}
                    </p>
                  )}
                </div>
                {!p.voided_at && (
                  <ActionForm action={voidPaymentAction} confirm="Void this payment? The balance will be owed again." className="no-print flex flex-wrap items-center gap-2">
                    <input type="hidden" name="payment_id" value={p.id} />
                    <input name="reason" required placeholder="Reason" className="field w-40 py-1.5 text-xs" aria-label="Void reason" />
                    <button className="btn-danger px-3 py-1.5 text-xs">Void</button>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="no-print card p-5">
        <h2 className="font-semibold">{active ? "Cancel registration" : "Reinstate registration"}</h2>
        {active ? (
          <ActionForm action={cancelRegistrationAction} confirm="Cancel this registration and release the seat?" className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="registration_id" value={r.id} />
            <input name="reason" placeholder="Reason (optional)" className="field max-w-xs" aria-label="Cancel reason" />
            <button className="btn-danger">Cancel &amp; release seat</button>
          </ActionForm>
        ) : (
          <ActionForm action={reinstateRegistrationAction} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="registration_id" value={r.id} />
            <p className="text-sm text-slate-600">Gives the seat back if the venue still has room.</p>
            <button className="btn-dark">Reinstate</button>
          </ActionForm>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-semibold tabular-nums ${strong ? "text-ember-600" : ""}`}>{value}</p>
    </div>
  );
}
