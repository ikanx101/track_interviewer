// Logika pembentukan baris data untuk tab Pencocokan, Transport PC, dan unduhan (CSV/XLSX).
// Hanya untuk server (memakai Prisma).
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, fromDbDate, isDateString, toDbDate, todayWIB } from "@/lib/dates";
import { PROJECT_STATUS_LABEL, TRANSPORT_LABEL } from "@/lib/report";
import {
  computeSelisih,
  isoToWIBString,
  isTransportStatus,
  matchStatus,
  matchStatusLabel,
  type MatchStatus,
  type TransportStatusKey,
} from "@/lib/matching";

// ---------------------------------------------------------------------------
// Filter

export type Filters = {
  from: string;
  to: string;
  interviewerId: number | null;
  status: TransportStatusKey | null;
};

type SP = URLSearchParams | Record<string, string | string[] | undefined>;

function getParam(sp: SP, key: string): string | undefined {
  if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined;
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Baca from/to/interviewerId/status dari query; tanggal tidak valid diganti default. */
export function parseFilters(sp: SP, defaults: { from: string; to: string }): Filters {
  let from = getParam(sp, "from");
  let to = getParam(sp, "to");
  if (!isDateString(from)) from = defaults.from;
  if (!isDateString(to)) to = defaults.to;
  if (from > to) [from, to] = [to, from];
  const iid = Number(getParam(sp, "interviewerId"));
  const st = getParam(sp, "status");
  return {
    from,
    to,
    interviewerId: Number.isInteger(iid) && iid > 0 ? iid : null,
    status: isTransportStatus(st) ? st : null,
  };
}

/** Default unduhan: 30 hari terakhir (termasuk hari ini). */
export function last30Days(today = todayWIB()) {
  return { from: addDays(today, -29), to: today };
}

function dateWhere(f: { from: string; to: string }) {
  return { gte: toDbDate(f.from), lte: toDbDate(f.to) };
}

// ---------------------------------------------------------------------------
// Pencocokan

export type MatchingRow = {
  key: string; // `${interviewerId}|${projectId}|${date}`
  date: string;
  interviewerId: number;
  interviewerName: string;
  projectId: number;
  projectCode: string;
  projectName: string;
  reportId: number | null;
  revision: number | null;
  area: string | null;
  rekap: number;
  hasReportItem: boolean;
  matchingId: number | null;
  actualCount: number | null;
  selisih: number | null;
  status: MatchStatus;
  note: string | null;
  followedUp: boolean;
};

export type MatchingSummary = { total: number; cocok: number; selisih: number; belum: number };

export async function buildMatchingRows(f: Pick<Filters, "from" | "to" | "interviewerId">): Promise<MatchingRow[]> {
  const repWhere: Prisma.ReportWhereInput = { date: dateWhere(f) };
  if (f.interviewerId) repWhere.interviewerId = f.interviewerId;
  const matchWhere: Prisma.MatchingWhereInput = { date: dateWhere(f) };
  if (f.interviewerId) matchWhere.interviewerId = f.interviewerId;

  const [items, matches] = await Promise.all([
    prisma.reportItem.findMany({
      where: { report: repWhere },
      include: { project: true, report: { include: { interviewer: true } } },
    }),
    prisma.matching.findMany({ where: matchWhere, include: { project: true, interviewer: true } }),
  ]);

  const map = new Map<string, MatchingRow>();
  for (const it of items) {
    const date = fromDbDate(it.report.date);
    const key = `${it.report.interviewerId}|${it.projectId}|${date}`;
    map.set(key, {
      key,
      date,
      interviewerId: it.report.interviewerId,
      interviewerName: it.report.interviewer.name,
      projectId: it.projectId,
      projectCode: it.project.code,
      projectName: it.project.name,
      reportId: it.reportId,
      revision: it.report.revision,
      area: it.area,
      rekap: it.count,
      hasReportItem: true,
      matchingId: null,
      actualCount: null,
      selisih: null,
      status: "BELUM",
      note: null,
      followedUp: false,
    });
  }
  for (const m of matches) {
    const date = fromDbDate(m.date);
    const key = `${m.interviewerId}|${m.projectId}|${date}`;
    let row = map.get(key);
    if (!row) {
      row = {
        key,
        date,
        interviewerId: m.interviewerId,
        interviewerName: m.interviewer.name,
        projectId: m.projectId,
        projectCode: m.project.code,
        projectName: m.project.name,
        reportId: null,
        revision: null,
        area: null,
        rekap: 0,
        hasReportItem: false,
        matchingId: null,
        actualCount: null,
        selisih: null,
        status: "BELUM",
        note: null,
        followedUp: false,
      };
      map.set(key, row);
    }
    row.matchingId = m.id;
    row.actualCount = m.actualCount;
    row.note = m.note;
    row.followedUp = m.followedUp;
  }
  const rows = [...map.values()];
  for (const r of rows) {
    r.selisih = computeSelisih(r.rekap, r.actualCount);
    r.status = matchStatus(r.rekap, r.actualCount);
  }
  rows.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.interviewerName.localeCompare(b.interviewerName) ||
      a.projectCode.localeCompare(b.projectCode),
  );
  return rows;
}

export function summarizeMatching(rows: MatchingRow[]): MatchingSummary {
  const s = { total: rows.length, cocok: 0, selisih: 0, belum: 0 };
  for (const r of rows) {
    if (r.status === "COCOK") s.cocok++;
    else if (r.status === "SELISIH") s.selisih++;
    else s.belum++;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Transport PC

export type TransportRow = {
  reportId: number;
  date: string;
  interviewerId: number;
  interviewerName: string;
  revision: number;
  pcItems: { projectCode: string; projectName: string; count: number }[];
  amount: number;
  note: string | null;
  status: TransportStatusKey;
  statusUpdatedAt: string | null; // ISO
};

export type TransportTotals = Record<TransportStatusKey, { count: number; amount: number }> & {
  ALL: { count: number; amount: number };
};

export async function buildTransportRows(f: Filters): Promise<TransportRow[]> {
  const where: Prisma.ReportWhereInput = { date: dateWhere(f), transportAmount: { not: null } };
  if (f.interviewerId) where.interviewerId = f.interviewerId;
  if (f.status) {
    // Rekap lama tanpa status dianggap "Diajukan".
    where.OR = f.status === "DIAJUKAN" ? [{ transportStatus: "DIAJUKAN" }, { transportStatus: null }] : [{ transportStatus: f.status }];
  }
  const reports = await prisma.report.findMany({
    where,
    include: { interviewer: true, items: { include: { project: true }, orderBy: { projectId: "asc" } } },
    orderBy: [{ date: "desc" }, { interviewerId: "asc" }],
  });
  return reports.map((r) => ({
    reportId: r.id,
    date: fromDbDate(r.date),
    interviewerId: r.interviewerId,
    interviewerName: r.interviewer.name,
    revision: r.revision,
    pcItems: r.items
      .filter((i) => i.project.isPC)
      .map((i) => ({ projectCode: i.project.code, projectName: i.project.name, count: i.count })),
    amount: r.transportAmount ?? 0,
    note: r.transportNote,
    status: (r.transportStatus ?? "DIAJUKAN") as TransportStatusKey,
    statusUpdatedAt: r.transportStatusUpdatedAt ? r.transportStatusUpdatedAt.toISOString() : null,
  }));
}

export function transportTotals(rows: TransportRow[]): TransportTotals {
  const z = () => ({ count: 0, amount: 0 });
  const t: TransportTotals = { DIAJUKAN: z(), DISETUJUI: z(), DIBAYAR: z(), ALL: z() };
  for (const r of rows) {
    t[r.status].count++;
    t[r.status].amount += r.amount;
    t.ALL.count++;
    t.ALL.amount += r.amount;
  }
  return t;
}

// ---------------------------------------------------------------------------
// Tabel generik untuk unduhan

export type Cell = string | number | null;
export type Table = { name: string; headers: string[]; rows: Cell[][] };

export async function harianTable(f: Pick<Filters, "from" | "to" | "interviewerId">, name = "Rekap Harian"): Promise<Table> {
  const where: Prisma.ReportWhereInput = { date: dateWhere(f) };
  if (f.interviewerId) where.interviewerId = f.interviewerId;
  const reports = await prisma.report.findMany({
    where,
    include: { interviewer: true, items: { include: { project: true }, orderBy: { projectId: "asc" } } },
  });
  reports.sort((a, b) => a.date.getTime() - b.date.getTime() || a.interviewer.name.localeCompare(b.interviewer.name));
  const rows: Cell[][] = [];
  for (const r of reports) {
    const base = (projCode: Cell, projName: Cell, count: Cell, area: Cell, isPC: Cell): Cell[] => [
      fromDbDate(r.date),
      r.interviewer.name,
      projCode,
      projName,
      isPC,
      count,
      area,
      r.startTime ?? "",
      r.endTime ?? "",
      r.otherAreas ?? "",
      r.notes ?? "",
      r.transportAmount,
      r.transportNote ?? "",
      r.transportAmount !== null ? TRANSPORT_LABEL[r.transportStatus ?? "DIAJUKAN"] : "",
      r.revision - 1,
      isoToWIBString(r.updatedAt),
    ];
    if (r.items.length === 0) rows.push(base("", "", 0, "", ""));
    for (const i of r.items) rows.push(base(i.project.code, i.project.name, i.count, i.area, i.project.isPC ? "Ya" : "Tidak"));
  }
  return {
    name,
    headers: [
      "Tanggal",
      "Interviewer",
      "Kode Project",
      "Nama Project",
      "Project PC",
      "Perolehan",
      "Area",
      "Jam Mulai",
      "Jam Selesai",
      "Area Lain",
      "Catatan",
      "Transport (Rp)",
      "Keterangan Transport",
      "Status Transport",
      "Jumlah Revisi",
      "Terakhir Disimpan (WIB)",
    ],
    rows,
  };
}

export async function rekapTable(f: Pick<Filters, "from" | "to" | "interviewerId">): Promise<Table> {
  const where: Prisma.ReportWhereInput = { date: dateWhere(f) };
  if (f.interviewerId) where.interviewerId = f.interviewerId;
  const reports = await prisma.report.findMany({
    where,
    include: { interviewer: true, items: { include: { project: true } } },
  });
  const projects = new Map<number, { code: string; name: string }>();
  const byInt = new Map<number, { name: string; days: number; counts: Map<number, number> }>();
  for (const r of reports) {
    let e = byInt.get(r.interviewerId);
    if (!e) byInt.set(r.interviewerId, (e = { name: r.interviewer.name, days: 0, counts: new Map() }));
    e.days++;
    for (const i of r.items) {
      projects.set(i.projectId, { code: i.project.code, name: i.project.name });
      e.counts.set(i.projectId, (e.counts.get(i.projectId) ?? 0) + i.count);
    }
  }
  const projIds = [...projects.keys()].sort((a, b) => projects.get(a)!.code.localeCompare(projects.get(b)!.code));
  const ints = [...byInt.values()].sort((a, b) => a.name.localeCompare(b.name));
  const rows: Cell[][] = ints.map((e) => {
    const vals = projIds.map((p) => e.counts.get(p) ?? 0);
    return [e.name, ...vals, vals.reduce((s, v) => s + v, 0), e.days];
  });
  if (ints.length) {
    const col = (idx: number) => rows.reduce((s, r) => s + (r[idx] as number), 0);
    rows.push(["TOTAL", ...projIds.map((_, k) => col(k + 1)), col(projIds.length + 1), col(projIds.length + 2)]);
  }
  return {
    name: "Rekap Periode",
    headers: ["Interviewer", ...projIds.map((p) => `${projects.get(p)!.code} - ${projects.get(p)!.name}`), "Total Perolehan", "Hari Turun"],
    rows,
  };
}

export async function pencocokanTable(f: Pick<Filters, "from" | "to" | "interviewerId">): Promise<Table> {
  const rows = await buildMatchingRows(f);
  return {
    name: "Pencocokan",
    headers: [
      "Tanggal",
      "Interviewer",
      "Kode Project",
      "Nama Project",
      "Rekap Interviewer",
      "Data Masuk",
      "Selisih",
      "Status",
      "Catatan Tindak Lanjut",
      "Sudah Ditindaklanjuti",
    ],
    rows: rows.map((r) => [
      r.date,
      r.interviewerName,
      r.projectCode,
      r.projectName,
      r.rekap,
      r.actualCount,
      r.selisih,
      matchStatusLabel(r.rekap, r.actualCount),
      r.note ?? "",
      r.followedUp ? "Ya" : "Tidak",
    ]),
  };
}

export async function transportTable(f: Filters): Promise<Table> {
  const rows = await buildTransportRows(f);
  return {
    name: "Transport",
    headers: [
      "Tanggal",
      "Interviewer",
      "Project PC & Perolehan",
      "Nominal (Rp)",
      "Keterangan",
      "Status",
      "Perubahan Status Terakhir (WIB)",
    ],
    rows: rows.map((r) => [
      r.date,
      r.interviewerName,
      r.pcItems.map((i) => `${i.projectCode}: ${i.count}`).join("; "),
      r.amount,
      r.note ?? "",
      TRANSPORT_LABEL[r.status],
      r.statusUpdatedAt ? isoToWIBString(new Date(r.statusUpdatedAt)) : "",
    ]),
  };
}

export async function interviewerTable(f: Pick<Filters, "from" | "to">): Promise<Table> {
  const [ints, reports] = await Promise.all([
    prisma.interviewer.findMany({ orderBy: { name: "asc" } }),
    prisma.report.findMany({ where: { date: dateWhere(f) }, include: { items: true } }),
  ]);
  const agg = new Map<number, { days: number; total: number }>();
  for (const r of reports) {
    const a = agg.get(r.interviewerId) ?? { days: 0, total: 0 };
    a.days++;
    a.total += r.items.reduce((s, i) => s + i.count, 0);
    agg.set(r.interviewerId, a);
  }
  return {
    name: "Interviewer",
    headers: ["Nama", "Status", `Hari Turun (${f.from} s.d. ${f.to})`, `Total Perolehan (${f.from} s.d. ${f.to})`],
    rows: ints.map((i) => [i.name, i.active ? "Aktif" : "Nonaktif", agg.get(i.id)?.days ?? 0, agg.get(i.id)?.total ?? 0]),
  };
}

/** Semua project; total perolehan & data masuk dihitung sepanjang waktu (progres terhadap target). */
export async function projectTable(): Promise<Table> {
  const [projects, items, matches] = await Promise.all([
    prisma.project.findMany({ orderBy: { code: "asc" } }),
    prisma.reportItem.groupBy({ by: ["projectId"], _sum: { count: true } }),
    prisma.matching.groupBy({ by: ["projectId"], _sum: { actualCount: true } }),
  ]);
  const rekap = new Map(items.map((i) => [i.projectId, i._sum.count ?? 0]));
  const masuk = new Map(matches.map((m) => [m.projectId, m._sum.actualCount ?? 0]));
  const pct = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 1000) / 10 : null);
  return {
    name: "Project",
    headers: [
      "Kode",
      "Nama",
      "Target",
      "Tanggal Mulai",
      "Project PC",
      "Status",
      "Total Perolehan (Rekap)",
      "Progres Rekap (%)",
      "Total Data Masuk",
      "Progres Data Masuk (%)",
    ],
    rows: projects.map((p) => {
      const r = rekap.get(p.id) ?? 0;
      const m = masuk.get(p.id) ?? 0;
      return [
        p.code,
        p.name,
        p.target,
        fromDbDate(p.startDate),
        p.isPC ? "Ya" : "Tidak",
        PROJECT_STATUS_LABEL[p.status],
        r,
        pct(r, p.target),
        m,
        pct(m, p.target),
      ];
    }),
  };
}

// ---------------------------------------------------------------------------
// CSV

function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV UTF-8 dengan BOM, pemisah koma, baris CRLF. */
export function toCsv(t: Table): string {
  const lines = [t.headers, ...t.rows].map((r) => r.map(csvCell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
