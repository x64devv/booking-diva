"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string; email?: string };

function safeNext(next: string) {
  return next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
}

export async function signInAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/admin"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Incorrect email or password.", email };

  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return { error: "This account is not an event admin. Ask an existing admin to add you.", email };
  }

  redirect(next);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
