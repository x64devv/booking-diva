import type { RegistrationStatus } from "@/lib/types";

const STYLES: Record<RegistrationStatus | "overdue", { label: string; cls: string; icon: string }> = {
  paid: { label: "Paid", cls: "bg-emerald-50 text-emerald-800 ring-emerald-600/20", icon: "✓" },
  reserved: { label: "Reserved – unpaid", cls: "bg-amber-50 text-amber-800 ring-amber-600/25", icon: "◷" },
  overdue: { label: "Overdue", cls: "bg-red-50 text-red-800 ring-red-600/20", icon: "!" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-600 ring-slate-500/20", icon: "×" },
  expired: { label: "Expired", cls: "bg-slate-100 text-slate-600 ring-slate-500/20", icon: "×" },
};

export function StatusBadge({ status, overdue = false }: { status: RegistrationStatus; overdue?: boolean }) {
  const s = STYLES[overdue && status === "reserved" ? "overdue" : status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}
