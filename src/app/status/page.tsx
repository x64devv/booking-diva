import Link from "next/link";
import { StatusForm } from "./status-form";

export const metadata = { title: "Check my registration" };

export default function StatusPage() {
  return (
    <main className="hero-bg min-h-dvh px-4 py-10 text-white sm:py-16">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="text-sm text-white/70 hover:text-white">← Back to registration</Link>
        <h1 className="font-display mt-4 text-5xl font-extrabold uppercase leading-none">Check my registration</h1>
        <p className="mt-2 text-white/70">Enter the reference you received and the phone number you registered with.</p>
        <div className="card mt-6 p-5 text-slate-900 sm:p-7">
          <StatusForm />
        </div>
      </div>
    </main>
  );
}
