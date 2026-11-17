import { type NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { getRiwayat, resolvePeriod } from "@/lib/stats";

export const dynamic = "force-dynamic";

// GET /api/admin/riwayat?from=&to=&period=minggu-ini|bulan-ini|bulan-lalu&interviewerId=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const { from, to } = resolvePeriod({ from: sp.get("from"), to: sp.get("to"), period: sp.get("period") });
  const iid = Number(sp.get("interviewerId"));
  return ok(await getRiwayat(from, to, Number.isInteger(iid) && iid > 0 ? iid : null));
}
