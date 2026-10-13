"use server";

import { createPublicClient } from "@/lib/supabase/public";
import { EVENT_SLUG } from "@/lib/config";
import { friendlyError } from "@/lib/errors";

export type Confirmation = {
  reference: string;
  full_name: string;
  phone: string;
  venue: string;
  status: "reserved" | "paid";
  amount_due: number;
  currency: string;
  reserved_until: string | null;
  contact_name: string | null;
  contact_phone: string | null;
};

export type RegisterState =
  | { ok: true; confirmation: Confirmation }
  | { ok: false; error?: string; values?: Record<string, string> };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const values = {
    full_name: str(formData, "full_name"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    gender: str(formData, "gender"),
    role: str(formData, "role"),
    branch: str(formData, "branch"),
    venue_id: str(formData, "venue_id"),
  };

  // Honeypot: real people never fill this hidden field.
  if (str(formData, "website")) return { ok: false, error: "Something went wrong. Please try again.", values };

  if (values.full_name.length < 3) return { ok: false, error: "Please enter your full name.", values };
  if (!values.phone) return { ok: false, error: "Please enter your phone number.", values };
  if (!values.role) return { ok: false, error: "Please choose your role.", values };
  if (!values.venue_id) return { ok: false, error: "Please choose a venue.", values };

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("register_attendee", {
    p_event_slug: EVENT_SLUG,
    p_full_name: values.full_name,
    p_phone: values.phone,
    p_email: values.email || null,
    p_gender: values.gender || null,
    p_role: values.role,
    p_branch: values.branch || null,
    p_venue_id: values.venue_id,
  });

  if (error) return { ok: false, error: friendlyError(error), values };
  return { ok: true, confirmation: data as Confirmation };
}

export type LookupResult = {
  reference: string;
  full_name: string;
  status: "reserved" | "paid" | "cancelled" | "expired";
  venue: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  reserved_until: string | null;
  paid_at: string | null;
  event_name: string;
  start_date: string;
  end_date: string;
  contact_name: string | null;
  contact_phone: string | null;
};

export type LookupState = { result?: LookupResult; error?: string; reference?: string; phone?: string };

export async function lookupAction(_prev: LookupState, formData: FormData): Promise<LookupState> {
  const reference = str(formData, "reference");
  const phone = str(formData, "phone");
  if (!reference || !phone) return { error: "Enter both your reference and phone number.", reference, phone };

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("lookup_registration", { p_reference: reference, p_phone: phone });
  if (error) return { error: friendlyError(error), reference, phone };
  if (!data) return { error: "No registration matches that reference and phone number.", reference, phone };
  return { result: data as LookupResult, reference, phone };
}
