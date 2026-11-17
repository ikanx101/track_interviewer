import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { reportInclude, toSnapshot, type ReportSnapshot } from "@/lib/report";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports/:id/history
 * → { reportId, current: ReportSnapshot, history: (ReportSnapshot & { historyId, archivedAt })[] }
 * history diurutkan berdasarkan nomor revisi (naik); current adalah versi aktif (revisi terbaru).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reportId = Number(id);
  if (!Number.isInteger(reportId) || reportId <= 0) return fail("ID rekap tidak valid.");
  const report = await prisma.report.findUnique({ where: { id: reportId }, include: reportInclude });
  if (!report) return fail("Rekap tidak ditemukan.", 404);
  const rows = await prisma.reportHistory.findMany({
    where: { reportId },
    orderBy: [{ revision: "asc" }, { id: "asc" }],
  });
  const history = rows.map((h) => {
    const snap = (h.snapshot ?? {}) as Partial<ReportSnapshot>;
    return {
      ...snap,
      revision: h.revision,
      items: Array.isArray(snap.items) ? snap.items : [],
      savedAt: snap.savedAt ?? h.createdAt.toISOString(),
      historyId: h.id,
      archivedAt: h.createdAt.toISOString(),
    };
  });
  return ok({ reportId, current: toSnapshot(report), history });
}
