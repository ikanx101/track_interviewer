import { prisma } from "@/lib/db";
import { ok } from "@/lib/api";
import { handleError } from "../_handle";

export const dynamic = "force-dynamic";

/** GET /api/public/interviewers -> { interviewers: {id,name}[] } (hanya yang aktif) */
export async function GET() {
  try {
    const interviewers = await prisma.interviewer.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return ok({ interviewers });
  } catch (e) {
    return handleError(e);
  }
}
