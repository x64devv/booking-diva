import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { EVENT_SLUG } from "@/lib/config";
import type { Registration, Report } from "@/lib/types";

export type AdminEvent = {
  id: string;
  slug: string;
  name: string;
  theme: string | null;
  organiser: string | null;
  start_date: string;
  end_date: string;
  venue_summary: string | null;
  fee_amount: number;
  currency: string;
  registration_deadline: string | null;
  payment_deadline: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  roles: string[];
  ref_prefix: string;
  is_open: boolean;
};

export type AdminVenue = { id: string; name: string; capacity: number | null; sort_order: number; is_active: boolean };

export async function getAdminEvent(): Promise<AdminEvent> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("*").eq("slug", EVENT_SLUG).single();
  if (error) throw new Error(`Event "${EVENT_SLUG}" not found: ${error.message}`);
  return data as AdminEvent;
}

export async function getVenues(eventId: string): Promise<AdminVenue[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .select("id,name,capacity,sort_order,is_active")
    .eq("event_id", eventId)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(error.message);
  return data as AdminVenue[];
}

export async function getReport(eventId: string): Promise<Report> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_event_report", { p_event_id: eventId });
  if (error) throw new Error(error.message);
  return data as Report;
}

export type RegistrationFilters = {
  q?: string;
  status?: string;
  venue?: string;
  role?: string;
  page?: number;
};

export const PAGE_SIZE = 100;

/** Builds the filtered query used by both the list page and the CSV export. */
export async function queryRegistrations(eventId: string, f: RegistrationFilters, opts: { all?: boolean } = {}) {
  await requireAdmin();
  const supabase = await createClient();
  let query = supabase
    .from("registrations")
    .select("*, venues(name)", { count: "exact" })
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  const q = (f.q ?? "").replace(/[,()*%\\]/g, " ").trim();
  if (q) {
    const digits = q.replace(/\D/g, "").replace(/^0/, "");
    const parts = [`full_name.ilike.*${q}*`, `reference.ilike.*${q}*`, `branch.ilike.*${q}*`];
    if (digits.length >= 3) parts.push(`phone.ilike.*${digits}*`);
    query = query.or(parts.join(","));
  }

  switch (f.status) {
    case "active":
      query = query.in("status", ["reserved", "paid"]);
      break;
    case "overdue":
      query = query.eq("status", "reserved").lt("reserved_until", new Date().toISOString());
      break;
    case "reserved":
    case "paid":
    case "cancelled":
    case "expired":
      query = query.eq("status", f.status);
      break;
  }
  if (f.venue) query = query.eq("venue_id", f.venue);
  if (f.role) query = query.eq("role", f.role);

  if (opts.all) {
    query = query.range(0, 9999);
  } else {
    const page = Math.max(1, f.page ?? 1);
    query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Registration[], count: count ?? 0 };
}

export async function getRegistration(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: reg }, { data: payments }] = await Promise.all([
    supabase.from("registrations").select("*, venues(name)").eq("id", id).maybeSingle(),
    supabase
      .from("payments")
      .select("*, receiver:admins!payments_received_by_fkey(full_name), voider:admins!payments_voided_by_fkey(full_name)")
      .eq("registration_id", id)
      .order("received_at", { ascending: false }),
  ]);
  return {
    registration: reg as Registration | null,
    payments: (payments ?? []) as Payment[],
  };
}

export type Payment = {
  id: string;
  amount: number;
  method: string;
  receipt_no: string | null;
  notes: string | null;
  received_at: string;
  voided_at: string | null;
  void_reason: string | null;
  receiver: { full_name: string } | null;
  voider: { full_name: string } | null;
};

export async function listAdmins() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("admins").select("user_id, full_name, created_at").order("created_at");
  return data ?? [];
}

export function parseFilters(sp: Record<string, string | string[] | undefined>): RegistrationFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  return {
    q: one("q"),
    status: one("status"),
    venue: one("venue"),
    role: one("role"),
    page: Number(one("page") ?? 1) || 1,
  };
}
