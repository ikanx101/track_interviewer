import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cleanText, parseNonNegInt } from "@/lib/api";
import { fromDbDate, isDateString, isWithinEditWindow, toDbDate, todayWIB, editWindowStart, formatDateID } from "@/lib/dates";
import { reportInclude, toSnapshot, type ReportFull } from "@/lib/report";
import type { PublicProject, PublicRekap, RekapSaveResult } from "@/components/interviewer/types";

/** Error validasi/bisnis dengan pesan ramah untuk interviewer. */
export class RekapError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "RekapError";
  }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const LOCKED_STATUSES = new Set(["DISETUJUI", "DIBAYAR"]);
const AREA_MAX = 200;
const TEXT_MAX = 1000;

type Tx = Prisma.TransactionClient | PrismaClient;

export function isTransportLocked(status: string | null | undefined): boolean {
  return !!status && LOCKED_STATUSES.has(status);
}

export function toPublicRekap(r: ReportFull): PublicRekap {
  return {
    id: r.id,
    interviewerId: r.interviewerId,
    interviewerName: r.interviewer.name,
    date: fromDbDate(r.date),
    revision: r.revision,
    startTime: r.startTime,
    endTime: r.endTime,
    otherAreas: r.otherAreas,
    notes: r.notes,
    transportAmount: r.transportAmount,
    transportNote: r.transportNote,
    transportStatus: r.transportStatus,
    transportLocked: isTransportLocked(r.transportStatus),
    items: r.items.map((i) => ({
      projectId: i.projectId,
      projectCode: i.project.code,
      projectName: i.project.name,
      isPC: i.project.isPC,
      count: i.count,
      area: i.area,
    })),
    totalResponden: r.items.reduce((s, i) => s + i.count, 0),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ---------- Validasi parameter dasar ----------

export function parseInterviewerId(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new RekapError("Nama interviewer belum dipilih.");
  return n;
}

export function assertEditableDate(v: unknown): string {
  if (!isDateString(v)) throw new RekapError("Tanggal tidak valid.");
  const today = todayWIB();
  if (!isWithinEditWindow(v, today)) {
    throw new RekapError(
      `Tanggal hanya boleh hari ini hingga 7 hari ke belakang (${formatDateID(editWindowStart(today), false)} – ${formatDateID(today, false)}).`,
    );
  }
  return v;
}

export async function getActiveInterviewer(id: number, db: Tx = prisma) {
  const iv = await db.interviewer.findUnique({ where: { id } });
  if (!iv || !iv.active) throw new RekapError("Nama interviewer tidak ditemukan atau sudah tidak aktif.", 404);
  return iv;
}

// ---------- Baca ----------

export async function getRekap(interviewerId: number, date: string, db: Tx = prisma): Promise<ReportFull | null> {
  return db.report.findUnique({
    where: { interviewerId_date: { interviewerId, date: toDbDate(date) } },
    include: reportInclude,
  });
}

/**
 * Project untuk form: status BERJALAN (yang sudah mulai pada tanggal tsb),
 * ditambah project apa pun yang sudah ada di rekap interviewer+tanggal ini (mis. sudah SELESAI).
 */
export async function listFormProjects(date: string, interviewerId: number | null): Promise<PublicProject[]> {
  const existingIds = interviewerId
    ? (
        await prisma.reportItem.findMany({
          where: { report: { interviewerId, date: toDbDate(date) } },
          select: { projectId: true },
        })
      ).map((i) => i.projectId)
    : [];
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { status: "BERJALAN", startDate: { lte: toDbDate(date) } },
        ...(existingIds.length ? [{ id: { in: existingIds } }] : []),
      ],
    },
    orderBy: [{ startDate: "desc" }, { code: "asc" }],
  });
  return projects.map((p) => ({ id: p.id, code: p.code, name: p.name, isPC: p.isPC, status: p.status }));
}

/** Saran area: area perolehan + potongan "area lain", terbaru dulu, unik (tanpa beda huruf besar/kecil). */
export async function listAreaSuggestions(limit = 100): Promise<string[]> {
  const [itemAreas, others] = await Promise.all([
    prisma.reportItem.groupBy({
      by: ["area"],
      _max: { id: true },
      orderBy: { _max: { id: "desc" } },
      take: limit * 2,
    }),
    prisma.report.findMany({
      where: { otherAreas: { not: null } },
      select: { otherAreas: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const a = raw.trim().replace(/\s+/g, " ");
    if (a.length < 2 || a.length > AREA_MAX) return;
    const k = a.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(a);
  };
  for (const g of itemAreas) push(g.area);
  for (const r of others) for (const part of (r.otherAreas ?? "").split(/[,;\n/]+/)) push(part);
  return out.slice(0, limit);
}

// ---------- Simpan ----------

type CleanItem = { projectId: number; count: number; area: string };

function parseTime(v: unknown, label: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !TIME_RE.test(v.trim())) throw new RekapError(`${label} harus berformat JJ:MM.`);
  return v.trim();
}

function parseItems(v: unknown): CleanItem[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new RekapError("Format perolehan tidak valid.");
  const out: CleanItem[] = [];
  const seen = new Set<number>();
  for (const raw of v) {
    if (!raw || typeof raw !== "object") throw new RekapError("Format perolehan tidak valid.");
    const r = raw as Record<string, unknown>;
    const projectId = Number(r.projectId);
    if (!Number.isInteger(projectId) || projectId <= 0) throw new RekapError("Project tidak valid.");
    if (seen.has(projectId)) throw new RekapError("Project yang sama terisi lebih dari sekali.");
    seen.add(projectId);
    const count = parseNonNegInt(r.count);
    if (Number.isNaN(count)) throw new RekapError("Jumlah responden harus bilangan bulat 0 atau lebih.");
    if (count === null || count === 0) continue; // tidak dikerjakan
    if (count > 10000) throw new RekapError("Jumlah responden terlalu besar. Periksa kembali isian.");
    const area = cleanText(r.area, AREA_MAX);
    if (!area) throw new RekapError("Area wajib diisi untuk project yang ada perolehannya.");
    out.push({ projectId, count, area });
  }
  return out;
}

/**
 * Simpan rekap (buat baru atau perbarui) untuk interviewer+tanggal.
 * Saat memperbarui: versi lama disimpan di ReportHistory, item diganti, revision +1.
 */
export async function saveRekap(body: unknown): Promise<RekapSaveResult> {
  if (!body || typeof body !== "object") throw new RekapError("Data tidak valid.");
  const b = body as Record<string, unknown>;

  const interviewerId = parseInterviewerId(b.interviewerId);
  const date = assertEditableDate(b.date);
  const startTime = parseTime(b.startTime, "Jam mulai");
  const endTime = parseTime(b.endTime, "Jam selesai");
  const otherAreas = cleanText(b.otherAreas, TEXT_MAX);
  const notes = cleanText(b.notes, TEXT_MAX);
  const items = parseItems(b.items);

  if (items.length === 0 && !otherAreas && !notes) {
    throw new RekapError("Isi minimal satu perolehan, area lain, atau catatan.");
  }

  const run = () =>
    prisma.$transaction(async (tx) => {
      await getActiveInterviewer(interviewerId, tx);
      const existing = await getRekap(interviewerId, date, tx);
      const existingProjectIds = new Set(existing?.items.map((i) => i.projectId) ?? []);

      // Validasi project
      const projects = items.length
        ? await tx.project.findMany({ where: { id: { in: items.map((i) => i.projectId) } } })
        : [];
      const byId = new Map(projects.map((p) => [p.id, p]));
      for (const it of items) {
        const p = byId.get(it.projectId);
        if (!p) throw new RekapError("Project tidak ditemukan. Muat ulang halaman lalu coba lagi.");
        if (existingProjectIds.has(p.id)) continue; // sudah ada di rekap ini (boleh walau SELESAI)
        if (p.status !== "BERJALAN") {
          throw new RekapError(`Project ${p.code} sudah selesai dan tidak bisa diisi lagi. Muat ulang halaman.`);
        }
        if (fromDbDate(p.startDate) > date) {
          throw new RekapError(`Project ${p.code} baru dimulai ${formatDateID(fromDbDate(p.startDate), false)}.`);
        }
      }
      const hasPC = items.some((it) => byId.get(it.projectId)?.isPC);

      // Transport
      let transport: {
        transportAmount: number | null;
        transportNote: string | null;
        transportStatus: "DIAJUKAN" | "DISETUJUI" | "DIBAYAR" | null;
        transportStatusUpdatedAt: Date | null;
      };
      if (existing && isTransportLocked(existing.transportStatus)) {
        if (!hasPC) {
          throw new RekapError(
            `Transport rekap ini sudah ${existing.transportStatus === "DIBAYAR" ? "dibayar" : "disetujui"}, ` +
              "jadi perolehan project PC tidak bisa dihapus semua. Hubungi Admin Field bila ada kesalahan.",
          );
        }
        transport = {
          transportAmount: existing.transportAmount,
          transportNote: existing.transportNote,
          transportStatus: existing.transportStatus,
          transportStatusUpdatedAt: existing.transportStatusUpdatedAt,
        };
      } else if (hasPC) {
        const amount = parseNonNegInt(b.transportAmount);
        if (amount === null || Number.isNaN(amount)) {
          throw new RekapError("Nominal transport wajib diisi (angka rupiah, isi 0 jika tidak ada biaya).");
        }
        if (amount > 100_000_000) throw new RekapError("Nominal transport terlalu besar. Periksa kembali isian.");
        const keepTime = existing?.transportStatus === "DIAJUKAN" && existing.transportStatusUpdatedAt;
        transport = {
          transportAmount: amount,
          transportNote: cleanText(b.transportNote, TEXT_MAX),
          transportStatus: "DIAJUKAN",
          transportStatusUpdatedAt: keepTime ? existing!.transportStatusUpdatedAt : new Date(),
        };
      } else {
        transport = { transportAmount: null, transportNote: null, transportStatus: null, transportStatusUpdatedAt: null };
      }

      const fields = { startTime, endTime, otherAreas, notes, ...transport };
      let reportId: number;
      if (existing) {
        await tx.reportHistory.create({
          data: { reportId: existing.id, revision: existing.revision, snapshot: toSnapshot(existing) as unknown as Prisma.InputJsonValue },
        });
        // Optimistic lock: gagal jika ada penyimpanan lain di antara baca dan tulis.
        const upd = await tx.report.updateMany({
          where: { id: existing.id, revision: existing.revision },
          data: { ...fields, revision: existing.revision + 1 },
        });
        if (upd.count !== 1) throw new RekapError("Rekap ini baru saja diperbarui dari perangkat lain. Muat ulang lalu coba lagi.", 409);
        await tx.reportItem.deleteMany({ where: { reportId: existing.id } });
        reportId = existing.id;
      } else {
        const created = await tx.report.create({ data: { interviewerId, date: toDbDate(date), ...fields } });
        reportId = created.id;
      }
      if (items.length) {
        await tx.reportItem.createMany({ data: items.map((it) => ({ reportId, ...it })) });
      }
      const saved = await tx.report.findUniqueOrThrow({ where: { id: reportId }, include: reportInclude });
      return { created: !existing, report: toPublicRekap(saved) };
    });

  // Penyimpanan bersamaan (mis. tombol ditekan dua kali / dua HP): yang kalah melanggar unique
  // (interviewerId, date) atau optimistic lock -> ulangi; percobaan berikutnya menjadi update biasa.
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (e) {
      const retryable =
        (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") ||
        (e instanceof RekapError && e.status === 409);
      if (!retryable || attempt >= 3) throw e;
    }
  }
}
