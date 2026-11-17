import { fail } from "@/lib/api";
import { RekapError } from "@/lib/rekap-service";

/** Ubah error menjadi respons JSON { error } dengan pesan ramah. */
export function handleError(e: unknown) {
  if (e instanceof RekapError) return fail(e.message, e.status);
  console.error("[api/public]", e);
  return fail("Terjadi kesalahan pada server. Silakan coba lagi beberapa saat.", 500);
}
