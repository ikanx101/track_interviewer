import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/api";
import { cleanName, isUniqueError } from "@/lib/stats";

export const dynamic = "force-dynamic";

// GET /api/admin/interviewers -> { interviewers: [{id,name,active,reportCount,lastReportDate}] }
export async function GET() {
  const list = await prisma.interviewer.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { reports: true } }, reports: { select: { date: true }, orderBy: { date: "desc" }, take: 1 } },
  });
  return ok({
    interviewers: list.map((i) => ({
      id: i.id,
      name: i.name,
      active: i.active,
      reportCount: i._count.reports,
      lastReportDate: i.reports[0]?.date.toISOString().slice(0, 10) ?? null,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}

// POST /api/admin/interviewers {name}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = cleanName(body?.name);
  if (!name) return fail("Nama interviewer wajib diisi.");
  const dup = await prisma.interviewer.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (dup) return fail(`Nama "${dup.name}" sudah terdaftar${dup.active ? "" : " (nonaktif — aktifkan kembali saja)"}.`, 409);
  try {
    const i = await prisma.interviewer.create({ data: { name } });
    return ok({ interviewer: i }, { status: 201 });
  } catch (e) {
    if (isUniqueError(e)) return fail(`Nama "${name}" sudah terdaftar.`, 409);
    throw e;
  }
}
