import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { periodRange } from "@/lib/dates";
import { buildTransportRows, parseFilters, transportTotals } from "@/lib/export";
import { canTransition, isTransportStatus, type TransportStatusKey } from "@/lib/matching";

export const dynamic = "force-dynamic";

/** GET /api/admin/transport?from&to&status&interviewerId → { from, to, rows, totals } (default: bulan ini) */
export async function GET(req: Request) {
  const f = parseFilters(new URL(req.url).searchParams, periodRange("bulan-ini"));
  const rows = await buildTransportRows(f);
  // Total per status dihitung tanpa filter status agar ringkasan tetap lengkap.
  const all = f.status ? await buildTransportRows({ ...f, status: null }) : rows;
  return ok({ from: f.from, to: f.to, rows, totals: transportTotals(all) });
}

/**
 * PATCH /api/admin/transport
 * body: { ids: number[] (reportId), status: "DIAJUKAN"|"DISETUJUI"|"DIBAYAR" }
 * Hanya perpindahan satu langkah (maju atau mundur) yang diterima; selain itu dilewati.
 * → { updated: number[], skipped: { id, reason }[], updatedAt }
 */
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (!isTransportStatus(status)) return fail("Status tidak valid.");
  const ids: number[] = Array.isArray(body?.ids)
    ? [...new Set<number>(body.ids.map(Number).filter((n: number) => Number.isInteger(n) && n > 0))]
    : [];
  if (!ids.length) return fail("Pilih minimal satu rekap.");
  if (ids.length > 1000) return fail("Terlalu banyak data sekaligus.");

  const reports = await prisma.report.findMany({
    where: { id: { in: ids } },
    select: { id: true, transportAmount: true, transportStatus: true },
  });
  const found = new Map(reports.map((r) => [r.id, r]));
  const updatable: number[] = [];
  const skipped: { id: number; reason: string }[] = [];
  for (const id of ids) {
    const r = found.get(id);
    if (!r) skipped.push({ id, reason: "Rekap tidak ditemukan" });
    else if (r.transportAmount === null) skipped.push({ id, reason: "Rekap tanpa transport" });
    else if ((r.transportStatus ?? "DIAJUKAN") === status) skipped.push({ id, reason: "Status sudah sama" });
    else if (!canTransition(r.transportStatus as TransportStatusKey | null, status))
      skipped.push({ id, reason: "Status hanya bisa diubah satu langkah" });
    else updatable.push(id);
  }
  const now = new Date();
  if (updatable.length) {
    // SQL langsung agar kolom updatedAt (= waktu terakhir rekap disimpan interviewer, dipakai di
    // riwayat revisi) tidak ikut berubah oleh aksi admin.
    await prisma.$executeRaw`
      UPDATE "Report"
      SET "transportStatus" = ${status}::"TransportStatus", "transportStatusUpdatedAt" = ${now}
      WHERE "id" IN (${Prisma.join(updatable)})`;
  }
  return ok({ updated: updatable, skipped, updatedAt: now.toISOString() });
}
