/** Tiny dependency-free presentational charts (server components). */

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 p-4">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-600">{hint}</div>}
    </div>
  );
}

export function Bars({
  items,
  color = "bg-sky-600",
}: {
  items: { label: string; value: number; right?: string }[];
  color?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-1.5">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 truncate text-zinc-400">{i.label}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-zinc-900">
            <div className={`h-full ${color}`} style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          <span className="w-16 shrink-0 text-right text-xs text-zinc-500">{i.right ?? i.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values, height = 40 }: { values: number[]; height?: number }) {
  if (values.length < 2) return <div className="text-xs text-zinc-600">not enough data</div>;
  const width = 320;
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-500" />
    </svg>
  );
}
