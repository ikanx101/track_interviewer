import { type NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { getRekap, resolvePeriod } from "@/lib/stats";

export const dynamic = "force-dynamic";

// GET /api/admin/rekap?from=&to=&period=minggu-ini|bulan-ini|bulan-lalu
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const { from, to } = resolvePeriod({ from: sp.get("from"), to: sp.get("to"), period: sp.get("period") });
  return ok(await getRekap(from, to));
}
