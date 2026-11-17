/** Bar progres sederhana. pct null = target belum diisi. */
export default function ProgressBar({ value, target, pct, color = "bg-brand-600", label }: {
  value: number;
  target: number;
  pct: number | null;
  color?: string;
  label: string;
}) {
  const width = pct === null ? 0 : Math.min(100, pct);
  const done = pct !== null && pct >= 100;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium tabular-nums text-slate-800">
          {value.toLocaleString("id-ID")}
          {target > 0 && <> / {target.toLocaleString("id-ID")}</>}
          {pct !== null && <span className={done ? "text-emerald-700" : "text-slate-500"}> ({pct.toLocaleString("id-ID")}%)</span>}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={width} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${done ? "bg-emerald-500" : color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
