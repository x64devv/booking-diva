import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Only the admin area needs a session; public pages stay cookie-free.
  matcher: ["/admin/:path*"],
};
