"use client";

import { useActionState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { dateLong, dateRange, money } from "@/lib/format";
import { lookupAction, type LookupState } from "../actions";

export function StatusForm() {
  const [state, formAction, pending] = useActionState(lookupAction, {} as LookupState);
  const r = state.result;
  const overdue = r?.status === "reserved" && !!r.reserved_until && new Date(r.reserved_until) < new Date();

  return (
    <div className="space-y-5">
      <form action={formAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="reference">Reference</label>
          <input id="reference" name="reference" className="field uppercase" placeholder="MIH-0001" required defaultValue={state.reference} />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" className="field" placeholder="0773 126 865" required defaultValue={state.phone} />
        </div>
        <button className="btn-dark" disabled={pending}>{pending ? "Checking…" : "Check"}</button>
      </form>

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800 ring-1 ring-red-200">{state.error}</p>
      )}

      {r && (
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-2xl font-bold">{r.reference}</p>
              <p className="text-slate-600">{r.full_name}</p>
            </div>
            <StatusBadge status={r.status} overdue={overdue} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Event</dt><dd className="font-medium">{r.event_name}</dd>
            <dt className="text-slate-500">Dates</dt><dd className="font-medium">{dateRange(r.start_date, r.end_date)}</dd>
            <dt className="text-slate-500">Venue</dt><dd className="font-medium">{r.venue}</dd>
            <dt className="text-slate-500">Fee</dt><dd className="font-medium">{money(r.amount_due, r.currency)}</dd>
            <dt className="text-slate-500">Paid</dt><dd className="font-medium">{money(r.amount_paid, r.currency)}</dd>
            {r.status === "reserved" && r.reserved_until && (
              <><dt className="text-slate-500">Pay by</dt><dd className="font-semibold">{dateLong(r.reserved_until)}</dd></>
            )}
          </dl>
          {r.status === "reserved" && (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Please pay {money(Number(r.amount_due) - Number(r.amount_paid), r.currency)} cash to the {r.contact_name ?? "Events Team"}
              {r.contact_phone ? ` (${r.contact_phone})` : ""} to confirm your seat.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
