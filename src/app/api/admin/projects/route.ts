import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { isUniqueError, parseProjectInput, serializeProject, type ProjectInput } from "@/lib/stats";
import { getProjectProgress } from "@/lib/stats";

export const dynamic = "force-dynamic";

// GET /api/admin/projects -> { projects: [{id,code,name,target,startDate,isPC,status,fromReports,fromMatching,...}] }
export async function GET() {
  const [list, progress] = await Promise.all([
    prisma.project.findMany({ orderBy: [{ status: "asc" }, { code: "asc" }] }),
    getProjectProgress(),
  ]);
  const prog = new Map(progress.map((p) => [p.id, p]));
  return ok({
    projects: list.map((p) => ({
      ...serializeProject(p),
      fromReports: prog.get(p.id)?.fromReports ?? 0,
      fromMatching: prog.get(p.id)?.fromMatching ?? 0,
    })),
  });
}

// POST /api/admin/projects {code,name,target,startDate,isPC}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("Data tidak valid.");
  const { data, error } = parseProjectInput(body, false);
  if (error) return fail(error);
  const dup = await prisma.project.findFirst({ where: { code: { equals: data.code, mode: "insensitive" } } });
  if (dup) return fail(`Kode project "${dup.code}" sudah dipakai.`, 409);
  try {
    const p = await prisma.project.create({ data: data as ProjectInput });
    return ok({ project: serializeProject(p) }, { status: 201 });
  } catch (e) {
    if (isUniqueError(e)) return fail(`Kode project "${data.code}" sudah dipakai.`, 409);
    throw e;
  }
}
