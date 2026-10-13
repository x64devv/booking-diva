"use client";

import { useActionState } from "react";
import { signInAction, type LoginState } from "./actions";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, {} as LoginState);
  const error = state.error ?? notice;
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800 ring-1 ring-red-200">{error}</p>}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="username" className="field" defaultValue={state.email} />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="field" />
      </div>
      <button className="btn-dark w-full py-3" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
