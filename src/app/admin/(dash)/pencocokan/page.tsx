import { prisma } from "@/lib/db";
import { formatDateID, todayWIB } from "@/lib/dates";
import { buildMatchingRows, parseFilters } from "@/lib/export";
import ExportButtons from "@/components/ExportButtons";
import FilterBar from "./FilterBar";
import MatchingTable from "./MatchingTable";

export const dynamic = "force-dynamic";

export default async function PencocokanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const today = todayWIB();
  const f = parseFilters(sp, { from: today, to: today });
  const [rows, interviewers, projects] = await Promise.all([
    buildMatchingRows(f),
    prisma.interviewer.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: { id: true, name: true, active: true } }),
    prisma.project.findMany({ orderBy: [{ status: "asc" }, { code: "asc" }], select: { id: true, code: true, name: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="page-title">Pencocokan</h1>
          <p className="text-sm text-slate-500">
            {f.from === f.to ? formatDateID(f.from) : `${formatDateID(f.from)} – ${formatDateID(f.to)}`}
          </p>
        </div>
        <ExportButtons dataset="pencocokan" params={{ from: f.from, to: f.to, interviewerId: f.interviewerId }} />
      </div>
      <FilterBar from={f.from} to={f.to} interviewerId={f.interviewerId} interviewers={interviewers} />
      <MatchingTable
        key={`${f.from}|${f.to}|${f.interviewerId ?? ""}`}
        initialRows={rows}
        interviewers={interviewers.filter((i) => i.active || i.id === f.interviewerId)}
        projects={projects}
        defaultDate={f.to}
        today={today}
      />
    </div>
  );
}
