"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { PublicEvent } from "@/lib/types";
import { dateLong, money } from "@/lib/format";
import { registerAction, type RegisterState } from "./actions";

const initial: RegisterState = { ok: false };

export function RegisterForm({ event }: { event: PublicEvent }) {
  const [state, formAction, pending] = useActionState(registerAction, initial);
  const [formKey, setFormKey] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!event.accepting) {
    return (
      <div className="py-6 text-center">
        <h2 className="font-display text-3xl font-bold uppercase">Registration closed</h2>
        <p className="mt-2 text-slate-600">
          Online registration for this event has closed. Please contact the {event.contact_name ?? "Events Team"}
          {event.contact_phone ? ` on ${event.contact_phone}` : ""}.
        </p>
      </div>
    );
  }

  if (state.ok && dismissed !== state.confirmation.reference) {
    const c = state.confirmation;
    const paid = c.status === "paid";
    return (
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
          {paid ? "You're registered" : "Seat reserved"}
        </p>
        <h2 className="font-display mt-1 text-3xl font-bold uppercase">Thank you, {c.full_name.split(" ")[0]}!</h2>

        <div className="mt-5 rounded-xl border-2 border-dashed border-ink-700/30 bg-paper p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Your reference</p>
          <p className="font-display mt-1 text-5xl font-extrabold tracking-wide text-ink-800">{c.reference}</p>
          <p className="mt-1 text-sm text-slate-500">Screenshot or write this down</p>
        </div>

        <dl className="mt-5 divide-y divide-slate-100 text-[15px]">
          <Row k="Name" v={c.full_name} />
          <Row k="Venue" v={c.venue} />
          {!paid && <Row k="Amount to pay" v={`${money(c.amount_due, c.currency)} cash`} strong />}
          {!paid && c.reserved_until && <Row k="Pay by" v={dateLong(c.reserved_until)} strong />}
        </dl>

        {!paid && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Your seat is held until the payment deadline. Pay {money(c.amount_due, c.currency)} cash to the{" "}
            {c.contact_name ?? "Events Team"}
            {c.contact_phone ? ` (${c.contact_phone})` : ""} and quote your reference. Unpaid seats may be released after
            the deadline.
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setDismissed(c.reference);
              setFormKey((k) => k + 1);
            }}
          >
            Register another person
          </button>
          <Link href="/status" className="btn-ghost">
            Check status
          </Link>
        </div>
      </div>
    );
  }

  const v = (!state.ok && state.values) || {};

  return (
    <form key={formKey} action={formAction} className="space-y-4" noValidate={false}>
      <div>
        <h2 className="font-display text-3xl font-bold uppercase leading-none">Reserve your seat</h2>
        <p className="mt-1.5 text-sm text-slate-600">
          {Number(event.fee_amount) > 0
            ? `Registration fee ${money(event.fee_amount, event.currency)}, payable in cash.`
            : "Registration is free."}
          {event.registration_deadline ? ` Registration closes ${dateLong(event.registration_deadline)}.` : ""}
        </p>
      </div>

      {!state.ok && state.error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800 ring-1 ring-red-200">
          {state.error}
        </p>
      )}

      <div>
        <label className="label" htmlFor="full_name">Full name</label>
        <input id="full_name" name="full_name" className="field" required minLength={3} autoComplete="name" defaultValue={v.full_name} placeholder="e.g. Tendai Moyo" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="phone">Phone number</label>
          <input id="phone" name="phone" type="tel" inputMode="tel" className="field" required autoComplete="tel" defaultValue={v.phone} placeholder="077 312 6865" />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input id="email" name="email" type="email" className="field" autoComplete="email" defaultValue={v.email} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="role">I am attending as</label>
          <select id="role" name="role" className="field" required defaultValue={v.role ?? ""}>
            <option value="" disabled>Choose…</option>
            {event.roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className="label">Gender</legend>
          <div className="flex gap-2">
            {["Male", "Female"].map((g) => (
              <label key={g} className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-[15px] has-[:checked]:border-volt-500 has-[:checked]:bg-volt-500/5">
                <input type="radio" name="gender" value={g} defaultChecked={v.gender === g} className="accent-volt-500" />
                {g}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div>
        <label className="label" htmlFor="branch">Home church / branch / zone</label>
        <input id="branch" name="branch" className="field" defaultValue={v.branch} placeholder="e.g. Heartfelt Chikanga" />
      </div>

      <fieldset>
        <legend className="label">Where will you attend?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {event.venues.map((venue) => {
            const full = venue.seats_left !== null && venue.seats_left <= 0;
            return (
              <label
                key={venue.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 p-3 has-[:checked]:border-volt-500 has-[:checked]:bg-volt-500/5 ${full ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <input type="radio" name="venue_id" value={venue.id} required disabled={full} defaultChecked={v.venue_id === venue.id} className="mt-1 accent-volt-500" />
                <span>
                  <span className="block font-semibold">{venue.name}</span>
                  <span className="text-xs text-slate-500">
                    {venue.seats_left === null ? "Seats available" : full ? "Fully booked" : `${venue.seats_left} seats left`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* honeypot */}
      <div aria-hidden className="absolute -left-[9999px]" >
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <button type="submit" className="btn-primary w-full py-3 text-base" disabled={pending}>
        {pending ? "Reserving…" : "Reserve my seat"}
      </button>
      {event.payment_deadline && Number(event.fee_amount) > 0 && (
        <p className="text-center text-xs text-slate-500">
          Seats are held until {dateLong(event.payment_deadline)}. Pay cash to confirm.
        </p>
      )}
    </form>
  );
}

function Row({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className={`text-right ${strong ? "font-bold text-slate-900" : "font-medium"}`}>{v}</dd>
    </div>
  );
}
