// Helper murni (tanpa Prisma) untuk Pencocokan & Transport — aman diimpor di komponen klien.

export type MatchStatus = "COCOK" | "SELISIH" | "BELUM";

/** Selisih = rekap interviewer − data masuk. null jika data masuk belum diisi. */
export function computeSelisih(rekap: number, actualCount: number | null): number | null {
  return actualCount === null ? null : rekap - actualCount;
}

export function matchStatus(rekap: number, actualCount: number | null): MatchStatus {
  const s = computeSelisih(rekap, actualCount);
  if (s === null) return "BELUM";
  return s === 0 ? "COCOK" : "SELISIH";
}

export function formatSelisih(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** Label status pencocokan (dipakai di halaman & unduhan). */
export function matchStatusLabel(rekap: number, actualCount: number | null): string {
  const st = matchStatus(rekap, actualCount);
  if (st === "BELUM") return "Belum dicocokkan";
  if (st === "COCOK") return "Cocok";
  return `Selisih ${formatSelisih(rekap - (actualCount as number))}`;
}

export const TRANSPORT_STATUSES = ["DIAJUKAN", "DISETUJUI", "DIBAYAR"] as const;
export type TransportStatusKey = (typeof TRANSPORT_STATUSES)[number];

export function isTransportStatus(v: unknown): v is TransportStatusKey {
  return typeof v === "string" && (TRANSPORT_STATUSES as readonly string[]).includes(v);
}

/** Perubahan status hanya boleh satu langkah maju atau mundur. */
export function canTransition(from: TransportStatusKey | null, to: TransportStatusKey): boolean {
  const a = TRANSPORT_STATUSES.indexOf(from ?? "DIAJUKAN");
  const b = TRANSPORT_STATUSES.indexOf(to);
  return Math.abs(a - b) === 1;
}

/** "2026-11-17T03:04:00Z" -> "17/11/2026 10.04" (WIB). */
export function formatDateTimeWIB(iso: string | Date | null | undefined): string {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d) + " WIB";
}

/** "YYYY-MM-DD HH:mm" (WIB) untuk unduhan. */
export function isoToWIBString(d: Date | null | undefined): string {
  if (!d) return "";
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
}
