export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4 sm:p-8">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
    </div>
  );
}
