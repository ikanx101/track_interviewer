import ExportButtons from "@/components/ExportButtons";
import PeriodFilter from "@/components/admin/PeriodFilter";
import ProjectProgressList from "@/components/admin/ProjectProgressList";
import StatCard from "@/components/admin/StatCard";
import { formatDateID } from "@/lib/dates";
import { getRekap, resolvePeriod } from "@/lib/stats";

export const dynamic = "force-dynamic";

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export default async function RekapPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { from, to } = resolvePeriod({ from: str(sp.from), to: str(sp.to), period: str(sp.period) });
  const data = await getRekap(from, to);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Rekap Periode</h1>
          <p className="text-sm text-slate-500">{formatDateID(from, false)} – {formatDateID(to, false)}</p>
        </div>
        <ExportButtons dataset="rekap" params={{ from, to }} />
      </div>

      <PeriodFilter key={`${from}|${to}`} from={from} to={to} />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total perolehan" value={data.grandTotal.toLocaleString("id-ID")} />
        <StatCard label="Hari turun" value={data.totalHariTurun} hint="total interviewer × hari" />
        <StatCard label="Interviewer turun" value={data.rows.filter((r) => r.hariTurun > 0).length} hint={`dari ${data.rows.length}`} />
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-slate-900">Perolehan per interviewer × project</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="sticky left-0 z-10">Interviewer</th>
                <th className="text-right">Hari turun</th>
                {data.projects.map((p) => (
                  <th key={p.id} className="text-right" title={p.name}>
                    {p.code}
                    {p.status === "SELESAI" && <span className="ml-1 font-normal normal-case text-slate-400">(selesai)</span>}
                  </th>
                ))}
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.interviewerId} className={r.hariTurun === 0 ? "text-slate-400" : ""}>
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white font-medium">
                    {r.interviewerName}
                    {!r.active && <span className="badge-gray ml-2">Nonaktif</span>}
                  </td>
                  <td className="text-right tabular-nums">{r.hariTurun}</td>
                  {data.projects.map((p) => (
                    <td key={p.id} className="text-right tabular-nums">{r.counts[p.id] ?? 0}</td>
                  ))}
                  <td className="text-right font-semibold tabular-nums">{r.total}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold">
              <tr>
                <td className="sticky left-0 z-10 bg-slate-50">Total periode</td>
                <td className="text-right tabular-nums">{data.totalHariTurun}</td>
                {data.projects.map((p) => (
                  <td key={p.id} className="text-right tabular-nums">{data.projectTotals[p.id] ?? 0}</td>
                ))}
                <td className="text-right tabular-nums">{data.grandTotal}</td>
              </tr>
              <tr className="text-xs font-normal text-slate-600">
                <td className="sticky left-0 z-10 bg-slate-50">Target project</td>
                <td />
                {data.projects.map((p) => (
                  <td key={p.id} className="text-right tabular-nums">{p.target > 0 ? p.target.toLocaleString("id-ID") : "-"}</td>
                ))}
                <td />
              </tr>
              <tr className="text-xs font-normal text-slate-600">
                <td className="sticky left-0 z-10 bg-slate-50">Periode ini vs target</td>
                <td />
                {data.projects.map((p) => (
                  <td key={p.id} className="text-right tabular-nums">
                    {p.target > 0 ? `${(Math.round(((data.projectTotals[p.id] ?? 0) / p.target) * 1000) / 10).toLocaleString("id-ID")}%` : "-"}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {data.projects.length === 0 && <p className="text-sm text-slate-500">Belum ada project berjalan atau perolehan pada periode ini.</p>}
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold text-slate-900">Progres kumulatif s.d. {formatDateID(to, false)}</h2>
          <p className="text-xs text-slate-500">Akumulasi sejak awal project hingga akhir periode, versi rekap interviewer dan data masuk.</p>
        </div>
        <ProjectProgressList items={data.progress} emptyText="Tidak ada project untuk ditampilkan." />
      </section>
    </>
  );
}
