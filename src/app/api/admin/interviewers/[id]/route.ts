import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { cleanName, isNotFoundError, isUniqueError } from "@/lib/stats";

export const dynamic = "force-dynamic";

// PATCH /api/admin/interviewers/:id {name?, active?}  (tidak ada DELETE — riwayat harus tetap tersimpan)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return fail("ID tidak valid.", 404);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("Data tidak valid.");
  const data: { name?: string; active?: boolean } = {};
  if (body.name !== undefined) {
    const name = cleanName(body.name);
    if (!name) return fail("Nama interviewer wajib diisi.");
    const dup = await prisma.interviewer.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
    });
    if (dup) return fail(`Nama "${dup.name}" sudah dipakai interviewer lain.`, 409);
    data.name = name;
  }
  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") return fail("Status aktif tidak valid.");
    data.active = body.active;
  }
  if (Object.keys(data).length === 0) return fail("Tidak ada perubahan.");
  try {
    const i = await prisma.interviewer.update({ where: { id }, data });
    return ok({ interviewer: i });
  } catch (e) {
    if (isUniqueError(e)) return fail(`Nama "${data.name}" sudah dipakai interviewer lain.`, 409);
    if (isNotFoundError(e)) return fail("Interviewer tidak ditemukan.", 404);
    throw e;
  }
}
