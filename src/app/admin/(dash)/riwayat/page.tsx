import ExportButtons from "@/components/ExportButtons";
import RevisionButton from "@/components/RevisionButton";
import PeriodFilter from "@/components/admin/PeriodFilter";
import StatCard from "@/components/admin/StatCard";
import { prisma } from "@/lib/db";
import { formatDateID } from "@/lib/dates";
import { getRiwayat, resolvePeriod } from "@/lib/stats";

export const dynamic = "force-dynamic";

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

export default async function RiwayatPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { from, to } = resolvePeriod({ from: str(sp.from), to: str(sp.to), period: str(sp.period) });
  const iidNum = Number(str(sp.interviewerId));
  const interviewerId = Number.isInteger(iidNum) && iidNum > 0 ? iidNum : null;
  const [data, interviewers] = await Promise.all([
    getRiwayat(from, to, interviewerId),
    prisma.interviewer.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: { id: true, name: true, active: true } }),
  ]);

  // Untuk tampilan: kolom per-rekap (jam/area lain/catatan) hanya di baris pertama tiap rekap.
  const firstOfReport = new Set<number>();
  const seen = new Set<number>();
  data.rows.forEach((r, idx) => {
    if (!seen.has(r.reportId)) { seen.add(r.reportId); firstOfReport.add(idx); }
  });

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Riwayat Harian</h1>
          <p className="text-sm text-slate-500">{formatDateID(from, false)} – {formatDateID(to, false)}</p>
        </div>
        <ExportButtons dataset="harian" params={{ from, to, interviewerId: interviewerId ?? undefined }} />
      </div>

      <PeriodFilter key={`${from}|${to}|${interviewerId ?? ""}`} from={from} to={to} interviewerId={interviewerId} interviewers={interviewers} />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Rekap" value={data.summary.reportCount} hint="interviewer × hari" />
        <StatCard label="Interviewer turun" value={data.summary.interviewerCount} />
        <StatCard label="Total perolehan" value={data.summary.totalPerolehan.toLocaleString("id-ID")} />
      </div>

      {data.rows.length === 0 ? (
        <p className="card text-sm text-slate-500">Tidak ada rekap pada periode ini.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Interviewer</th>
                <th>Project</th>
                <th className="text-right">Perolehan</th>
                <th>Area</th>
                <th>Jam</th>
                <th>Area lain</th>
                <th>Catatan</th>
                <th>Revisi</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, idx) => {
                const first = firstOfReport.has(idx);
                return (
                  <tr key={`${r.reportId}-${r.projectId ?? "x"}`} className={first ? "" : "[&>td]:border-t-0"}>
                    <td className="whitespace-nowrap">{first ? formatDateID(r.date) : ""}</td>
                    <td className="whitespace-nowrap font-medium">{first ? r.interviewerName : ""}</td>
                    <td className="whitespace-nowrap">
                      {r.projectCode ? <span title={r.projectName ?? ""}>{r.projectCode}</span> : <span className="badge-gray">Tanpa perolehan</span>}
                    </td>
                    <td className="text-right tabular-nums font-semibold">{r.count ?? "-"}</td>
                    <td className="min-w-[8rem]">{r.area ?? "-"}</td>
                    <td className="whitespace-nowrap">{first ? (r.startTime || r.endTime ? `${r.startTime ?? "?"}–${r.endTime ?? "?"}` : "-") : ""}</td>
                    <td className="min-w-[8rem] whitespace-pre-wrap">{first ? r.otherAreas ?? "-" : ""}</td>
                    <td className="min-w-[10rem] whitespace-pre-wrap">{first ? r.notes ?? "-" : ""}</td>
                    <td>{first && <RevisionButton reportId={r.reportId} revision={r.revision} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
