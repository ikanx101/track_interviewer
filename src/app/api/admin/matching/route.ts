import { prisma } from "@/lib/db";
import { cleanText, fail, ok, parseNonNegInt } from "@/lib/api";
import { isDateString, toDbDate, todayWIB } from "@/lib/dates";
import { buildMatchingRows, parseFilters, summarizeMatching } from "@/lib/export";
import { computeSelisih, matchStatus } from "@/lib/matching";

export const dynamic = "force-dynamic";

/** GET /api/admin/matching?from&to&interviewerId → { from, to, rows, summary } */
export async function GET(req: Request) {
  const today = todayWIB();
  const f = parseFilters(new URL(req.url).searchParams, { from: today, to: today });
  const rows = await buildMatchingRows(f);
  return ok({ from: f.from, to: f.to, rows, summary: summarizeMatching(rows) });
}

/**
 * PUT /api/admin/matching
 * body: { interviewerId, projectId, date, actualCount: number|null|"", note?, followedUp? }
 * - actualCount terisi → upsert Matching (kunci interviewerId+projectId+date).
 * - actualCount kosong → baris Matching dihapus (catatan & tanda tindak lanjut ikut terhapus),
 *   status kembali "Belum dicocokkan".
 */
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("Data tidak valid.");
  const interviewerId = Number(body.interviewerId);
  const projectId = Number(body.projectId);
  const date = body.date;
  if (!Number.isInteger(interviewerId) || interviewerId <= 0) return fail("Interviewer tidak valid.");
  if (!Number.isInteger(projectId) || projectId <= 0) return fail("Project tidak valid.");
  if (!isDateString(date)) return fail("Tanggal tidak valid.");
  if (date > todayWIB()) return fail("Tanggal tidak boleh melebihi hari ini.");
  const actual = parseNonNegInt(body.actualCount);
  if (Number.isNaN(actual)) return fail("Data masuk harus bilangan bulat ≥ 0.");
  const note = cleanText(body.note, 1000);
  const followedUp = body.followedUp === true;

  const [interviewer, project] = await Promise.all([
    prisma.interviewer.findUnique({ where: { id: interviewerId } }),
    prisma.project.findUnique({ where: { id: projectId } }),
  ]);
  if (!interviewer) return fail("Interviewer tidak ditemukan.", 404);
  if (!project) return fail("Project tidak ditemukan.", 404);

  const key = { interviewerId, projectId, date: toDbDate(date) };
  const item = await prisma.reportItem.findFirst({
    where: { projectId, report: { interviewerId, date: toDbDate(date) } },
  });
  const rekap = item?.count ?? 0;

  if (actual === null) {
    if (note || followedUp) return fail("Isi angka data masuk terlebih dahulu sebelum menyimpan catatan/tindak lanjut.");
    await prisma.matching.deleteMany({ where: key });
    return ok({
      matchingId: null,
      rekap,
      actualCount: null,
      selisih: null,
      status: "BELUM",
      note: null,
      followedUp: false,
      deleted: true,
      hasReportItem: !!item,
    });
  }

  const m = await prisma.matching.upsert({
    where: { interviewerId_projectId_date: key },
    create: { ...key, actualCount: actual, note, followedUp },
    update: { actualCount: actual, note, followedUp },
  });
  return ok({
    matchingId: m.id,
    rekap,
    actualCount: m.actualCount,
    selisih: computeSelisih(rekap, m.actualCount),
    status: matchStatus(rekap, m.actualCount),
    note: m.note,
    followedUp: m.followedUp,
    deleted: false,
    hasReportItem: !!item,
  });
}
