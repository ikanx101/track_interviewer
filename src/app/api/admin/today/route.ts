import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api";
import { isDateString, todayWIB } from "@/lib/dates";
import { getToday } from "@/lib/stats";

export const dynamic = "force-dynamic";

// GET /api/admin/today?date=YYYY-MM-DD (default hari ini WIB)
export async function GET(req: NextRequest) {
  const d = req.nextUrl.searchParams.get("date");
  if (d && !isDateString(d)) return fail("Format tanggal tidak valid (YYYY-MM-DD).");
  return ok(await getToday(d || todayWIB()));
}
