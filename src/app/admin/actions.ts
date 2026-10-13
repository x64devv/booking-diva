"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import { fromLocalInput } from "@/lib/format";

export type ActionState = { ok?: boolean; error?: string; message?: string };

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function recordPaymentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const amount = Number(s(fd, "amount"));
  const { data, error } = await supabase.rpc("record_payment", {
    p_registration_id: s(fd, "registration_id"),
    p_amount: amount,
    p_receipt_no: s(fd, "receipt_no") || null,
    p_notes: s(fd, "notes") || null,
    p_method: s(fd, "method") || "Cash",
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  const d = data as { reference: string; status: string };
  return { ok: true, message: `${d.reference} — ${d.status === "paid" ? "paid in full" : "part payment recorded"}` };
}

export async function voidPaymentAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_payment", { p_payment_id: s(fd, "payment_id"), p_reason: s(fd, "reason") });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true, message: "Payment voided." };
}

export async function cancelRegistrationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_registration", {
    p_registration_id: s(fd, "registration_id"),
    p_reason: s(fd, "reason") || null,
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true, message: "Registration cancelled and seat released." };
}

export async function reinstateRegistrationAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reinstate_registration", { p_registration_id: s(fd, "registration_id") });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true, message: "Registration reinstated." };
}

export async function releaseOverdueAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("release_overdue_reservations", { p_event_id: s(fd, "event_id") });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true, message: `${data ?? 0} unpaid seat(s) released.` };
}

export async function updateEventAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const id = s(fd, "id");
  const fee = Number(s(fd, "fee_amount"));
  if (!Number.isFinite(fee) || fee < 0) return { error: "Fee must be zero or more." };
  const roles = s(fd, "roles").split("\n").map((r) => r.trim()).filter(Boolean);
  if (roles.length === 0) return { error: "Add at least one role." };
  const payment_deadline = fromLocalInput(s(fd, "payment_deadline"));

  const { error } = await supabase
    .from("events")
    .update({
      name: s(fd, "name"),
      theme: s(fd, "theme") || null,
      organiser: s(fd, "organiser") || null,
      start_date: s(fd, "start_date"),
      end_date: s(fd, "end_date"),
      venue_summary: s(fd, "venue_summary") || null,
      fee_amount: fee,
      currency: s(fd, "currency") || "USD",
      registration_deadline: fromLocalInput(s(fd, "registration_deadline")),
      payment_deadline,
      contact_name: s(fd, "contact_name") || null,
      contact_phone: s(fd, "contact_phone") || null,
      ref_prefix: (s(fd, "ref_prefix") || "REG").toUpperCase(),
      roles,
      is_open: fd.get("is_open") === "on",
    })
    .eq("id", id);
  if (error) return { error: error.message };

  if (fd.get("apply_deadline") === "on") {
    const { error: e2 } = await supabase
      .from("registrations")
      .update({ reserved_until: payment_deadline })
      .eq("event_id", id)
      .eq("status", "reserved");
    if (e2) return { error: e2.message };
  }
  refresh();
  return { ok: true, message: "Event settings saved." };
}

export async function saveVenueAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const capRaw = s(fd, "capacity");
  const capacity = capRaw === "" ? null : Number(capRaw);
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 0)) return { error: "Capacity must be a whole number (or blank for unlimited)." };
  const row = {
    name: s(fd, "name"),
    capacity,
    sort_order: Number(s(fd, "sort_order") || 0),
    is_active: fd.get("is_active") === "on",
  };
  if (!row.name) return { error: "Venue name is required." };

  const id = s(fd, "id");
  const { error } = id
    ? await supabase.from("venues").update(row).eq("id", id)
    : await supabase.from("venues").insert({ ...row, event_id: s(fd, "event_id") });
  if (error) return { error: error.code === "23505" ? "A venue with that name already exists." : error.message };
  refresh();
  return { ok: true, message: id ? "Venue saved." : "Venue added." };
}
