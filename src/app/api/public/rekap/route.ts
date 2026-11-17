import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import {
  assertEditableDate,
  getActiveInterviewer,
  getRekap,
  parseInterviewerId,
  saveRekap,
  toPublicRekap,
} from "@/lib/rekap-service";
import { handleError } from "../_handle";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/rekap?interviewerId=N&date=YYYY-MM-DD
 * -> { report: PublicRekap | null }  (hanya satu rekap milik interviewer+tanggal tsb, dalam rentang 7 hari)
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    if (!sp.get("interviewerId") || !sp.get("date")) return fail("Parameter interviewerId dan date wajib diisi.");
    const interviewerId = parseInterviewerId(sp.get("interviewerId"));
    const date = assertEditableDate(sp.get("date"));
    await getActiveInterviewer(interviewerId);
    const r = await getRekap(interviewerId, date);
    return ok({ report: r ? toPublicRekap(r) : null });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * POST /api/public/rekap  body: RekapPayload
 * -> 201 { created: true, report } | 200 { created: false, report } | 4xx { error }
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Data yang dikirim tidak valid.");
  }
  try {
    const res = await saveRekap(body);
    return ok(res, { status: res.created ? 201 : 200 });
  } catch (e) {
    return handleError(e);
  }
}
