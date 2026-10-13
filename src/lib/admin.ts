import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type AdminUser = { id: string; email: string; name: string };

/**
 * Data Access Layer: verifies the JWT (getClaims) and that the user is listed in public.admins.
 * Call it at the top of every admin page, action and route handler.
 */
export const requireAdmin = cache(async (): Promise<AdminUser> => {
  // Session checks compare token expiry with the clock: always do them at request time.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/admin/login");

  const { data: admin } = await supabase
    .from("admins")
    .select("full_name")
    .eq("user_id", claims.sub)
    .maybeSingle();
  if (!admin) redirect("/admin/login?error=not-admin");

  return { id: claims.sub, email: String(claims.email ?? ""), name: admin.full_name };
});
