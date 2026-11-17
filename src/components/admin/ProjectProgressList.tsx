import type { ProjectProgress } from "@/lib/stats";
import ProgressBar from "./ProgressBar";

/** Progres kumulatif project vs target, dua versi: rekap interviewer & data masuk. */
export default function ProjectProgressList({ items, emptyText = "Belum ada project yang masih berjalan." }: {
  items: ProjectProgress[];
  emptyText?: string;
}) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((p) => (
        <div key={p.id} className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{p.code}</span>
            <span className="text-sm text-slate-600">{p.name}</span>
            {p.isPC && <span className="badge-blue">PC</span>}
            {p.status === "SELESAI" && <span className="badge-gray">Selesai</span>}
            {p.target === 0 && <span className="badge-yellow">Target belum diisi</span>}
          </div>
          <div className="space-y-2">
            <ProgressBar label="Rekap interviewer" value={p.fromReports} target={p.target} pct={p.pctReports} />
            <ProgressBar label="Data masuk" value={p.fromMatching} target={p.target} pct={p.pctMatching} color="bg-sky-500" />
          </div>
        </div>
      ))}
    </div>
  );
}
