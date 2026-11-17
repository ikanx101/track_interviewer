import type { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { assertEditableDate, listFormProjects, parseInterviewerId } from "@/lib/rekap-service";
import { handleError } from "../_handle";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/projects?date=YYYY-MM-DD[&interviewerId=N]
 * -> { projects: {id,code,name,isPC,status}[] }
 * Project BERJALAN yang sudah mulai pada tanggal tsb + project yang sudah ada di rekap interviewer itu.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const date = assertEditableDate(sp.get("date"));
    const ivRaw = sp.get("interviewerId");
    const interviewerId = ivRaw ? parseInterviewerId(ivRaw) : null;
    return ok({ projects: await listFormProjects(date, interviewerId) });
  } catch (e) {
    return handleError(e);
  }
}
