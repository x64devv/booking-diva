"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/admin/actions";

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
  inlineMessage?: boolean;
};

/** Small wrapper so any admin form shows its own success/error message. */
export function ActionForm({ action, children, className, confirm, resetOnSuccess, inlineMessage }: Props) {
  const [state, formAction] = useActionState(action, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {(state.error || state.message) && (
        <p
          role="status"
          className={`${inlineMessage ? "" : "basis-full w-full"} text-xs font-medium ${state.error ? "text-red-700" : "text-emerald-700"}`}
        >
          {state.error ?? state.message}
        </p>
      )}
    </form>
  );
}

/** Submit button that disables itself while its parent form's action is running. */
export function SubmitButton({ children, pendingText, className }: { children: ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}
