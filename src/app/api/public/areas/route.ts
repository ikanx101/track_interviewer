import { ok } from "@/lib/api";
import { listAreaSuggestions } from "@/lib/rekap-service";
import { handleError } from "../_handle";

export const dynamic = "force-dynamic";

/** GET /api/public/areas -> { areas: string[] } (terbaru dulu, maks 100) */
export async function GET() {
  try {
    return ok({ areas: await listAreaSuggestions(100) });
  } catch (e) {
    return handleError(e);
  }
}
