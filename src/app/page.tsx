import { Suspense } from "react";
import Link from "next/link";
import { getPublicEvent } from "@/lib/event";
import { dateLong, dateRange, money } from "@/lib/format";
import { RegisterForm } from "./register-form";

export default function Home() {
  return (
    <main className="min-h-dvh">
      <Suspense fallback={<HeroSkeleton />}>
        <EventPage />
      </Suspense>
    </main>
  );
}

async function EventPage() {
  const event = await getPublicEvent();
  if (!event) {
    return (
      <div className="hero-bg grid min-h-dvh place-items-center px-4 text-center text-white">
        <div>
          <h1 className="font-display text-4xl font-bold uppercase">Event not found</h1>
          <p className="mt-2 text-white/70">Check NEXT_PUBLIC_EVENT_SLUG and that the database seed has been run.</p>
        </div>
      </div>
    );
  }

  const fee = money(event.fee_amount, event.currency);
  const free = Number(event.fee_amount) === 0;

  return (
    <>
      <section className="hero-bg text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:pb-24 lg:pt-14">
          <div>
            {event.organiser && (
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-volt-300">{event.organiser}</p>
            )}
            <h1 className="font-display mt-4 text-5xl font-extrabold uppercase leading-[0.9] sm:text-7xl">
              {event.name}
            </h1>
            <div className="mt-5 h-px w-40 bg-ember-500" />

            {event.theme && (
              <div className="mt-6 inline-block rounded-xl border-2 border-ember-500 px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ember-400">Theme</p>
                <p className="font-display text-3xl font-bold uppercase sm:text-4xl">{event.theme}</p>
              </div>
            )}

            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              <Detail icon="calendar" label="Dates" value={dateRange(event.start_date, event.end_date)} />
              <Detail icon="pin" label="Venue" value={event.venue_summary ?? event.venues.map((v) => v.name).join(", ")} />
              <Detail icon="cash" label="Registration fee" value={free ? "Free" : `${fee} cash`} />
              {event.payment_deadline && !free && (
                <Detail icon="clock" label="Pay by" value={dateLong(event.payment_deadline)} />
              )}
            </dl>

            <a href="#register" className="btn-primary mt-8 lg:hidden">Reserve your seat ↓</a>

            {!free && (
              <ol className="mt-10 grid gap-3 text-sm sm:grid-cols-3">
                {[
                  ["Register", "Fill in the form to reserve your seat."],
                  ["Pay cash", `Pay ${fee} to the ${event.contact_name ?? "Events Team"} with your reference.`],
                  ["You're in", "Your seat is confirmed once payment is recorded."],
                ].map(([title, body], i) => (
                  <li key={title} className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
                    <p className="font-display text-lg font-bold uppercase">
                      <span className="mr-2 text-ember-400">0{i + 1}</span>
                      {title}
                    </p>
                    <p className="mt-1 text-white/70">{body}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div id="register" className="scroll-mt-4 lg:pt-6">
            <div className="card p-5 text-slate-900 sm:p-7">
              <RegisterForm event={event} />
            </div>
            <p className="mt-4 text-center text-sm text-white/70">
              Already registered?{" "}
              <Link href="/status" className="font-semibold text-white underline decoration-ember-500 underline-offset-4">
                Check your registration
              </Link>
            </p>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Questions? Contact the {event.contact_name ?? "Events Team"}
          {event.contact_phone && (
            <>
              {" "}on{" "}
              <a className="font-semibold text-slate-900 underline" href={`tel:${event.contact_phone.replace(/\s/g, "")}`}>
                {event.contact_phone}
              </a>
            </>
          )}
          .
        </p>
        <Link href="/admin" className="text-slate-400 hover:text-slate-700">
          Admin
        </Link>
      </footer>
    </>
  );
}

function Detail({ icon, label, value }: { icon: keyof typeof ICONS; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-ember-500 text-white">
        {ICONS[icon]}
      </span>
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-white/60">{label}</dt>
        <dd className="text-[17px] font-semibold">{value}</dd>
      </div>
    </div>
  );
}

const svg = (d: string) => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const ICONS = {
  calendar: svg("M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"),
  pin: svg("M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"),
  cash: svg("M2 7h20v10H2zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 12h.01M18 12h.01"),
  clock: svg("M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2"),
};

function HeroSkeleton() {
  return (
    <div className="hero-bg min-h-dvh">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-14 sm:px-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="h-4 w-56 animate-pulse rounded bg-white/10" />
          <div className="h-32 w-full animate-pulse rounded bg-white/10" />
          <div className="h-20 w-72 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-[560px] animate-pulse rounded-2xl bg-white/10" />
      </div>
    </div>
  );
}
