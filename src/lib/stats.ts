// Query & agregasi untuk dashboard admin (Hari Ini, Riwayat Harian, Rekap Periode, progres project).
// Perolehan selalu angka harian (per tanggal); hanya progres project yang kumulatif.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseNonNegInt } from "@/lib/api";
import { addDays, fromDbDate, isDateString, periodRange, toDbDate, todayWIB, type PeriodKey } from "@/lib/dates";

export type ProjectBrief = { id: number; code: string; name: string; isPC: boolean; status: string; target: number };

/* ------------------------------------------------------------------ */
/* Periode                                                             */
/* ------------------------------------------------------------------ */

/** Normalisasi filter periode dari query string. Default: 7 hari terakhir (WIB). */
export function resolvePeriod(input: { from?: string | null; to?: string | null; period?: string | null }): {
  from: string;
  to: string;
} {
  const today = todayWIB();
  if (input.period === "minggu-ini" || input.period === "bulan-ini" || input.period === "bulan-lalu") {
    return periodRange(input.period as PeriodKey, today);
  }
  let to = isDateString(input.to) ? input.to : today;
  let from = isDateString(input.from) ? input.from : addDays(to, -6);
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

/* ------------------------------------------------------------------ */
/* Progres project terhadap target                                    */
/* ------------------------------------------------------------------ */

export type ProjectProgress = ProjectBrief & {
  startDate: string;
  fromReports: number; // kumulatif dari rekap interviewer (sum ReportItem.count)
  fromMatching: number; // kumulatif dari data masuk (sum Matching.actualCount)
  pctReports: number | null; // null jika target 0
  pctMatching: number | null;
};

function pct(v: number, target: number): number | null {
  return target > 0 ? Math.round((v / target) * 1000) / 10 : null;
}

/** Progres kumulatif per project. `upTo` (opsional) membatasi tanggal s.d. inklusif. */
export async function getProjectProgress(opts: { status?: "BERJALAN" | "SELESAI"; upTo?: string } = {}): Promise<
  ProjectProgress[]
> {
  const projects = await prisma.project.findMany({
    where: opts.status ? { status: opts.status } : undefined,
    orderBy: [{ status: "asc" }, { code: "asc" }],
  });
  if (projects.length === 0) return [];
  const ids = projects.map((p) => p.id);
  const dateFilter = opts.upTo ? { lte: toDbDate(opts.upTo) } : undefined;
  const [rep, mat] = await Promise.all([
    prisma.reportItem.groupBy({
      by: ["projectId"],
      where: { projectId: { in: ids }, ...(dateFilter ? { report: { date: dateFilter } } : {}) },
      _sum: { count: true },
    }),
    prisma.matching.groupBy({
      by: ["projectId"],
      where: { projectId: { in: ids }, ...(dateFilter ? { date: dateFilter } : {}) },
      _sum: { actualCount: true },
    }),
  ]);
  const repMap = new Map(rep.map((r) => [r.projectId, r._sum.count ?? 0]));
  const matMap = new Map(mat.map((r) => [r.projectId, r._sum.actualCount ?? 0]));
  return projects.map((p) => {
    const fromReports = repMap.get(p.id) ?? 0;
    const fromMatching = matMap.get(p.id) ?? 0;
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      isPC: p.isPC,
      status: p.status,
      target: p.target,
      startDate: fromDbDate(p.startDate),
      fromReports,
      fromMatching,
      pctReports: pct(fromReports, p.target),
      pctMatching: pct(fromMatching, p.target),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Hari Ini                                                            */
/* ------------------------------------------------------------------ */

export type TodayItem = { projectId: number; projectCode: string; projectName: string; isPC: boolean; count: number; area: string };

export type TodayRow = {
  interviewerId: number;
  interviewerName: string;
  active: boolean;
  submitted: boolean;
  report: null | {
    id: number;
    revision: number;
    startTime: string | null;
    endTime: string | null;
    otherAreas: string | null;
    notes: string | null;
    transportAmount: number | null;
    transportNote: string | null;
    transportStatus: string | null;
    total: number;
    items: TodayItem[];
    updatedAt: string;
  };
};

export type TodayData = {
  date: string;
  today: string;
  summary: { activeCount: number; submittedCount: number; totalResponden: number };
  rows: TodayRow[];
  progress: ProjectProgress[];
};

export async function getToday(date: string): Promise<TodayData> {
  const [interviewers, reports, progress] = await Promise.all([
    prisma.interviewer.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.report.findMany({
      where: { date: toDbDate(date) },
      include: { interviewer: true, items: { include: { project: true }, orderBy: { project: { code: "asc" } } } },
    }),
    getProjectProgress({ status: "BERJALAN" }),
  ]);
  const byInterviewer = new Map(reports.map((r) => [r.interviewerId, r]));
  // Interviewer aktif + interviewer nonaktif yang tetap punya rekap di tanggal ini.
  const people = [
    ...interviewers.map((i) => ({ id: i.id, name: i.name, active: true })),
    ...reports
      .filter((r) => !r.interviewer.active)
      .map((r) => ({ id: r.interviewer.id, name: r.interviewer.name, active: false })),
  ];
  const rows: TodayRow[] = people.map((p) => {
    const r = byInterviewer.get(p.id);
    if (!r) return { interviewerId: p.id, interviewerName: p.name, active: p.active, submitted: false, report: null };
    const items = r.items.map((i) => ({
      projectId: i.projectId,
      projectCode: i.project.code,
      projectName: i.project.name,
      isPC: i.project.isPC,
      count: i.count,
      area: i.area,
    }));
    return {
      interviewerId: p.id,
      interviewerName: p.name,
      active: p.active,
      submitted: true,
      report: {
        id: r.id,
        revision: r.revision,
        startTime: r.startTime,
        endTime: r.endTime,
        otherAreas: r.otherAreas,
        notes: r.notes,
        transportAmount: r.transportAmount,
        transportNote: r.transportNote,
        transportStatus: r.transportStatus,
        total: items.reduce((s, i) => s + i.count, 0),
        items,
        updatedAt: r.updatedAt.toISOString(),
      },
    };
  });
  // Yang sudah mengirim di atas, lalu urut nama.
  rows.sort((a, b) => Number(b.submitted) - Number(a.submitted) || a.interviewerName.localeCompare(b.interviewerName));
  return {
    date,
    today: todayWIB(),
    summary: {
      activeCount: interviewers.length,
      submittedCount: reports.filter((r) => r.interviewer.active).length,
      totalResponden: rows.reduce((s, r) => s + (r.report?.total ?? 0), 0),
    },
    rows,
    progress,
  };
}

/* ------------------------------------------------------------------ */
/* Riwayat Harian                                                      */
/* ------------------------------------------------------------------ */

export type RiwayatRow = {
  reportId: number;
  revision: number;
  date: string;
  interviewerId: number;
  interviewerName: string;
  projectId: number | null; // null = rekap tanpa perolehan
  projectCode: string | null;
  projectName: string | null;
  count: number | null;
  area: string | null;
  startTime: string | null;
  endTime: string | null;
  otherAreas: string | null;
  notes: string | null;
};

export type RiwayatData = {
  from: string;
  to: string;
  interviewerId: number | null;
  rows: RiwayatRow[];
  summary: { reportCount: number; totalPerolehan: number; interviewerCount: number };
};

export async function getRiwayat(from: string, to: string, interviewerId: number | null): Promise<RiwayatData> {
  const reports = await prisma.report.findMany({
    where: {
      date: { gte: toDbDate(from), lte: toDbDate(to) },
      ...(interviewerId ? { interviewerId } : {}),
    },
    include: { interviewer: true, items: { include: { project: true }, orderBy: { project: { code: "asc" } } } },
    orderBy: [{ date: "desc" }, { interviewer: { name: "asc" } }],
  });
  const rows: RiwayatRow[] = [];
  for (const r of reports) {
    const base = {
      reportId: r.id,
      revision: r.revision,
      date: fromDbDate(r.date),
      interviewerId: r.interviewerId,
      interviewerName: r.interviewer.name,
      startTime: r.startTime,
      endTime: r.endTime,
      otherAreas: r.otherAreas,
      notes: r.notes,
    };
    if (r.items.length === 0) {
      rows.push({ ...base, projectId: null, projectCode: null, projectName: null, count: null, area: null });
    } else {
      for (const i of r.items) {
        rows.push({
          ...base,
          projectId: i.projectId,
          projectCode: i.project.code,
          projectName: i.project.name,
          count: i.count,
          area: i.area,
        });
      }
    }
  }
  return {
    from,
    to,
    interviewerId,
    rows,
    summary: {
      reportCount: reports.length,
      totalPerolehan: rows.reduce((s, r) => s + (r.count ?? 0), 0),
      interviewerCount: new Set(reports.map((r) => r.interviewerId)).size,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Rekap Periode (pivot Interviewer × Project)                        */
/* ------------------------------------------------------------------ */

export type RekapData = {
  from: string;
  to: string;
  projects: ProjectBrief[];
  rows: {
    interviewerId: number;
    interviewerName: string;
    active: boolean;
    hariTurun: number;
    counts: Record<number, number>; // projectId -> jumlah perolehan dalam periode
    total: number;
  }[];
  projectTotals: Record<number, number>;
  grandTotal: number;
  totalHariTurun: number;
  progress: ProjectProgress[]; // kumulatif s.d. akhir periode, untuk project yang tampil
};

export async function getRekap(from: string, to: string): Promise<RekapData> {
  const range = { gte: toDbDate(from), lte: toDbDate(to) };
  const [interviewers, reports] = await Promise.all([
    prisma.interviewer.findMany({ orderBy: { name: "asc" } }),
    prisma.report.findMany({ where: { date: range }, include: { items: true } }),
  ]);

  const counts = new Map<number, Record<number, number>>();
  const days = new Map<number, Set<string>>();
  const projectIdsUsed = new Set<number>();
  for (const r of reports) {
    const d = days.get(r.interviewerId) ?? new Set<string>();
    d.add(fromDbDate(r.date));
    days.set(r.interviewerId, d);
    const c = counts.get(r.interviewerId) ?? {};
    for (const i of r.items) {
      c[i.projectId] = (c[i.projectId] ?? 0) + i.count;
      projectIdsUsed.add(i.projectId);
    }
    counts.set(r.interviewerId, c);
  }

  // Kolom: project yang punya perolehan dalam periode + project yang masih berjalan.
  const allProgress = await getProjectProgress({ upTo: to });
  const shown = allProgress.filter((p) => projectIdsUsed.has(p.id) || p.status === "BERJALAN");
  const projects: ProjectBrief[] = shown.map(({ id, code, name, isPC, status, target }) => ({ id, code, name, isPC, status, target }));

  // Baris: interviewer aktif + interviewer nonaktif yang punya rekap dalam periode.
  const rows = interviewers
    .filter((i) => i.active || days.has(i.id))
    .map((i) => {
      const c = counts.get(i.id) ?? {};
      return {
        interviewerId: i.id,
        interviewerName: i.name,
        active: i.active,
        hariTurun: days.get(i.id)?.size ?? 0,
        counts: c,
        total: Object.values(c).reduce((s, n) => s + n, 0),
      };
    });

  const projectTotals: Record<number, number> = {};
  for (const p of projects) projectTotals[p.id] = rows.reduce((s, r) => s + (r.counts[p.id] ?? 0), 0);

  return {
    from,
    to,
    projects,
    rows,
    projectTotals,
    grandTotal: rows.reduce((s, r) => s + r.total, 0),
    totalHariTurun: rows.reduce((s, r) => s + r.hariTurun, 0),
    progress: shown,
  };
}

/* ------------------------------------------------------------------ */
/* Kelola Data: validasi interviewer & project                         */
/* ------------------------------------------------------------------ */


export function isUniqueError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}
export function isNotFoundError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
}

/** Nama interviewer: trim + rapikan spasi ganda. */
export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, 100) : null;
}

export type ProjectInput = { code: string; name: string; target: number; startDate: Date; isPC: boolean };

/** Validasi body project. partial=true untuk PATCH (hanya field yang dikirim). */
export function parseProjectInput(
  body: Record<string, unknown>,
  partial: boolean,
): { data: Partial<ProjectInput> & { status?: "BERJALAN" | "SELESAI" }; error?: string } {
  const data: Partial<ProjectInput> & { status?: "BERJALAN" | "SELESAI" } = {};
  if (!partial || body.code !== undefined) {
    const code = typeof body.code === "string" ? body.code.trim().replace(/\s+/g, " ").slice(0, 50) : "";
    if (!code) return { data, error: "Kode project wajib diisi." };
    data.code = code;
  }
  if (!partial || body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 200) : "";
    if (!name) return { data, error: "Nama project wajib diisi." };
    data.name = name;
  }
  if (!partial || body.target !== undefined) {
    const t = parseNonNegInt(body.target);
    if (t === null || Number.isNaN(t)) return { data, error: "Target harus bilangan bulat ≥ 0." };
    if (t > 100_000_000) return { data, error: "Target terlalu besar." };
    data.target = t;
  }
  if (!partial || body.startDate !== undefined) {
    if (!isDateString(body.startDate)) return { data, error: "Tanggal mulai wajib diisi (format YYYY-MM-DD)." };
    data.startDate = toDbDate(body.startDate);
  }
  if (!partial || body.isPC !== undefined) data.isPC = body.isPC === true || body.isPC === "true";
  if (body.status !== undefined) {
    if (body.status !== "BERJALAN" && body.status !== "SELESAI") return { data, error: "Status project tidak valid." };
    data.status = body.status;
  }
  return { data };
}

export function serializeProject<
  T extends { startDate: Date; createdAt: Date; updatedAt: Date },
>(p: T) {
  return { ...p, startDate: fromDbDate(p.startDate), createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() };
}
