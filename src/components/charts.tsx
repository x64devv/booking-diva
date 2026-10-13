/**
 * Lightweight, dependency-free charts for the admin reports.
 * Paid = volt (#2f55d4), Reserved = ember (#e8590c) — palette validated for CVD separation.
 * Every chart also prints its numbers, so colour is never the only carrier of meaning.
 */

export const SERIES = {
  paid: { label: "Paid", color: "var(--color-volt-500)" },
  reserved: { label: "Reserved (unpaid)", color: "var(--color-ember-500)" },
} as const;

export function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-600">
      {Object.values(SERIES).map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** Horizontal stacked bar: paid + reserved, scaled to `max` (capacity or largest row). */
export function StackedBar({ paid, reserved, max, label }: { paid: number; reserved: number; max: number; label: string }) {
  const pct = (n: number) => (max > 0 ? (n / max) * 100 : 0);
  return (
    <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={label}>
      {paid > 0 && (
        <div
          title={`${SERIES.paid.label}: ${paid}`}
          className="h-full rounded-l-full transition-[width] last:rounded-r-full"
          style={{ width: `${pct(paid)}%`, background: SERIES.paid.color }}
        />
      )}
      {reserved > 0 && (
        <div
          title={`${SERIES.reserved.label}: ${reserved}`}
          className={`h-full rounded-r-full ${paid > 0 ? "border-l-2 border-white" : "rounded-l-full"}`}
          style={{ width: `${pct(reserved)}%`, background: SERIES.reserved.color }}
        />
      )}
    </div>
  );
}

/** Simple column chart for a daily count series. */
export function Columns({ data, format = (n: number) => String(n) }: { data: { label: string; value: number }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="py-10 text-center text-sm text-slate-400">No data yet</p>;
  return (
    <div className="flex h-44 items-end gap-1.5 overflow-x-auto pb-6 pt-5">
      {data.map((d) => (
        <div key={d.label} className="group relative flex h-full min-w-7 max-w-14 flex-1 flex-col justify-end" title={`${d.label}: ${format(d.value)}`}>
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-semibold tabular-nums text-slate-700 opacity-0 transition group-hover:opacity-100">
            {format(d.value)}
          </span>
          <div className="rounded-t bg-volt-500 transition group-hover:bg-ink-700" style={{ height: `${(d.value / max) * 100}%`, minHeight: 2 }} />
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
