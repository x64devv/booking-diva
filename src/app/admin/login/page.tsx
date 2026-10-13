import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = { title: "Admin sign in" };

export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="hero-bg grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-volt-300">Events Team</p>
        <h1 className="font-display mt-2 text-center text-4xl font-extrabold uppercase text-white">Admin sign in</h1>
        <div className="card mt-6 p-6">
          <Suspense fallback={<div className="h-64" />}>
            <LoginFormWithParams searchParams={searchParams} />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/" className="text-white/70 hover:text-white">← Public registration page</Link>
        </p>
      </div>
    </main>
  );
}

async function LoginFormWithParams({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/admin";
  const notice = sp.error === "not-admin" ? "Your account is signed in but is not an event admin." : undefined;
  return <LoginForm next={next} notice={notice} />;
}
