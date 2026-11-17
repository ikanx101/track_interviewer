import ExportButtons from "@/components/ExportButtons";
import RevisionButton from "@/components/RevisionButton";
import DatePicker from "@/components/admin/DatePicker";
import ProjectProgressList from "@/components/admin/ProjectProgressList";
import StatCard from "@/components/admin/StatCard";
import { formatDateID, formatRupiah, isDateString, todayWIB } from "@/lib/dates";
import { TRANSPORT_LABEL } from "@/lib/report";
import { getToday, type TodayRow } from "@/lib/stats";

export const dynamic = "force-dynamic";

const TRANSPORT_BADGE: Record<string, string> = { DIAJUKAN: "badge-yellow", DISETUJUI: "badge-blue", DIBAYAR: "badge-green" };

export default async function HariIniPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const today = todayWIB();
  const raw = typeof sp.date === "string" ? sp.date : "";
  const date = isDateString(raw) && raw <= today ? raw : today;
  const data = await getToday(date);
  const { summary } = data;
  const belum = data.rows.filter((r) => !r.submitted);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">{date === today ? "Hari Ini" : "Rekap Tanggal"}</h1>
          <p className="text-sm text-slate-500">{formatDateID(date)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker date={date} today={today} />
          <ExportButtons dataset="hari-ini" params={{ date }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sudah mengirim" value={<>{summary.submittedCount}<span className="text-base font-normal text-slate-500"> / {summary.activeCount}</span></>} hint="interviewer aktif" />
        <StatCard label="Belum mengirim" value={belum.length} hint={belum.length ? belum.map((b) => b.interviewerName).join(", ") : "Semua sudah mengirim"} />
        <StatCard label="Total responden" value={summary.totalResponden.toLocaleString("id-ID")} hint="perolehan pada tanggal ini" />
        <StatCard
          label="Transport PC"
          value={formatRupiah(data.rows.reduce((s, r) => s + (r.report?.transportAmount ?? 0), 0))}
          hint={`${data.rows.filter((r) => r.report?.transportAmount != null).length} pengajuan`}
        />
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900">Rekap interviewer</h2>
        {data.rows.length === 0 ? (
          <p className="card text-sm text-slate-500">Belum ada interviewer aktif. Tambahkan di Kelola Data.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.rows.map((r) => <InterviewerCard key={r.interviewerId} row={r} />)}
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="font-semibold text-slate-900">Progres project terhadap target</h2>
          <p className="text-xs text-slate-500">Kumulatif seluruh tanggal untuk project yang masih berjalan — versi rekap interviewer dan versi data masuk (Pencocokan).</p>
        </div>
        <ProjectProgressList items={data.progress} />
      </section>
    </>
  );
}

function InterviewerCard({ row }: { row: TodayRow }) {
  const r = row.report;
  return (
    <div className={`card space-y-3 ${r ? "" : "border-dashed bg-slate-50"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-900">{row.interviewerName}</span>
        {r ? <span className="badge-green">Sudah kirim</span> : <span className="badge-red">Belum kirim</span>}
        {!row.active && <span className="badge-gray">Nonaktif</span>}
        {r && <RevisionButton reportId={r.id} revision={r.revision} />}
        {r && <span className="ml-auto text-xl font-semibold tabular-nums text-slate-900" title="Total perolehan">{r.total}</span>}
      </div>
      {r && (
        <>
          {r.items.length > 0 ? (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 text-sm">
              {r.items.map((i) => (
                <li key={i.projectId} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800">
                      {i.projectCode} {i.isPC && <span className="badge-blue ml-1">PC</span>}
                    </div>
                    <div className="truncate text-xs text-slate-500" title={i.area}>📍 {i.area}</div>
                  </div>
                  <span className="font-semibold tabular-nums">{i.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Tidak ada perolehan.</p>
          )}
          <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500">Jam</dt>
            <dd>{r.startTime || r.endTime ? `${r.startTime ?? "?"} – ${r.endTime ?? "?"}` : "-"}</dd>
            <dt className="text-slate-500">Area lain</dt>
            <dd className="whitespace-pre-wrap">{r.otherAreas || "-"}</dd>
            <dt className="text-slate-500">Transport</dt>
            <dd>
              {r.transportAmount == null ? "-" : (
                <span className="flex flex-wrap items-center gap-2">
                  {formatRupiah(r.transportAmount)}
                  {r.transportStatus && <span className={TRANSPORT_BADGE[r.transportStatus] ?? "badge-gray"}>{TRANSPORT_LABEL[r.transportStatus] ?? r.transportStatus}</span>}
                  {r.transportNote && <span className="text-xs text-slate-500">{r.transportNote}</span>}
                </span>
              )}
            </dd>
            <dt className="text-slate-500">Catatan</dt>
            <dd className="whitespace-pre-wrap">{r.notes || "-"}</dd>
          </dl>
        </>
      )}
    </div>
  );
}
