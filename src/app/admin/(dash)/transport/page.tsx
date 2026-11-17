import { prisma } from "@/lib/db";
import { formatDateID, periodRange } from "@/lib/dates";
import { buildTransportRows, parseFilters } from "@/lib/export";
import { TRANSPORT_LABEL } from "@/lib/report";
import { TRANSPORT_STATUSES } from "@/lib/matching";
import ExportButtons from "@/components/ExportButtons";
import FilterBar from "../pencocokan/FilterBar";
import TransportTable from "./TransportTable";

export const dynamic = "force-dynamic";

export default async function TransportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const f = parseFilters(sp, periodRange("bulan-ini"));
  const [rows, interviewers] = await Promise.all([
    // Ambil semua status; filter status diterapkan di klien agar total per status tetap lengkap.
    buildTransportRows({ ...f, status: null }),
    prisma.interviewer.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: { id: true, name: true, active: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="page-title">Transport PC</h1>
          <p className="text-sm text-slate-500">
            {f.from === f.to ? formatDateID(f.from) : `${formatDateID(f.from)} – ${formatDateID(f.to)}`}
          </p>
        </div>
        <ExportButtons dataset="transport" params={{ from: f.from, to: f.to, status: f.status, interviewerId: f.interviewerId }} />
      </div>
      <FilterBar
        from={f.from}
        to={f.to}
        interviewerId={f.interviewerId}
        interviewers={interviewers}
        status={f.status}
        statusOptions={TRANSPORT_STATUSES.map((s) => ({ value: s, label: TRANSPORT_LABEL[s] }))}
      />
      <TransportTable key={`${f.from}|${f.to}|${f.interviewerId ?? ""}|${f.status ?? ""}`} initialRows={rows} statusFilter={f.status} />
    </div>
  );
}
