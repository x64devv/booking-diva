import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getAdminEvent, parseFilters, queryRegistrations } from "@/lib/admin-data";
import { isOverdue } from "@/lib/types";

export async function GET(request: NextRequest) {
  await requireAdmin();
  const event = await getAdminEvent();
  const filters = parseFilters(Object.fromEntries(request.nextUrl.searchParams));
  const { rows } = await queryRegistrations(event.id, filters, { all: true });

  const header = [
    "Reference", "Full name", "Phone", "Email", "Gender", "Role", "Branch/zone", "Venue",
    "Status", "Overdue", "Amount due", "Amount paid", "Balance", "Pay by", "Paid at", "Registered at", "Cancel reason",
  ];
  const lines = rows.map((r) => [
    r.reference, r.full_name, r.phone, r.email ?? "", r.gender ?? "", r.role, r.branch ?? "", r.venues?.name ?? "",
    r.status, isOverdue(r) ? "yes" : "", r.amount_due, r.amount_paid,
    Math.max(0, Number(r.amount_due) - Number(r.amount_paid)), r.reserved_until ?? "", r.paid_at ?? "", r.created_at, r.cancel_reason ?? "",
  ]);

  const csv = [header, ...lines]
    .map((row) => row.map((v) => {
      const s = String(v ?? "");
      // quote, and neutralise spreadsheet formula injection
      const safe = /^[=+\-@]/.test(s) && !/^[+-]?\d/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    }).join(","))
    .join("\r\n");

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registrations-${event.slug}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
