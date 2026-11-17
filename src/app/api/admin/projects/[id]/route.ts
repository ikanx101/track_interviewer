import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { isNotFoundError, isUniqueError, parseProjectInput, serializeProject } from "@/lib/stats";

export const dynamic = "force-dynamic";

// PATCH /api/admin/projects/:id {code?,name?,target?,startDate?,isPC?,status?}  (tidak ada DELETE)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return fail("ID tidak valid.", 404);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("Data tidak valid.");
  const { data, error } = parseProjectInput(body, true);
  if (error) return fail(error);
  if (Object.keys(data).length === 0) return fail("Tidak ada perubahan.");
  if (data.code) {
    const dup = await prisma.project.findFirst({ where: { code: { equals: data.code, mode: "insensitive" }, NOT: { id } } });
    if (dup) return fail(`Kode project "${dup.code}" sudah dipakai project lain.`, 409);
  }
  try {
    const p = await prisma.project.update({ where: { id }, data });
    return ok({ project: serializeProject(p) });
  } catch (e) {
    if (isUniqueError(e)) return fail(`Kode project "${data.code}" sudah dipakai project lain.`, 409);
    if (isNotFoundError(e)) return fail("Project tidak ditemukan.", 404);
    throw e;
  }
}
