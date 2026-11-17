// Semua tanggal bisnis memakai string "YYYY-MM-DD" dalam zona WIB (Asia/Jakarta).
// Di database disimpan sebagai kolom DATE (DateTime UTC tengah malam).

export const TZ = "Asia/Jakarta";
export const EDIT_WINDOW_DAYS = 7;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Tanggal hari ini menurut WIB, "YYYY-MM-DD". */
export function todayWIB(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "YYYY-MM-DD" -> Date untuk kolom @db.Date. */
export function toDbDate(s: string): Date {
  return new Date(s + "T00:00:00Z");
}

/** Date dari kolom @db.Date -> "YYYY-MM-DD". */
export function fromDbDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string {
  const d = toDbDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDbDate(d);
}

/** Tanggal paling awal yang masih boleh diisi/diperbaiki interviewer. */
export function editWindowStart(today: string = todayWIB()): string {
  return addDays(today, -EDIT_WINDOW_DAYS);
}

/** true jika tanggal berada di rentang hari ini s.d. 7 hari ke belakang (WIB). */
export function isWithinEditWindow(s: string, today: string = todayWIB()): boolean {
  return isDateString(s) && s <= today && s >= editWindowStart(today);
}

/** Daftar tanggal dari `from` s.d. `to` inklusif. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export type PeriodKey = "minggu-ini" | "bulan-ini" | "bulan-lalu";

/** Pintasan periode: Minggu ini (Senin–hari ini), Bulan ini, Bulan lalu. */
export function periodRange(key: PeriodKey, today: string = todayWIB()): { from: string; to: string } {
  const d = toDbDate(today);
  if (key === "minggu-ini") {
    const dow = (d.getUTCDay() + 6) % 7; // Senin = 0
    return { from: addDays(today, -dow), to: today };
  }
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (key === "bulan-ini") {
    return { from: fromDbDate(new Date(Date.UTC(y, m, 1))), to: today };
  }
  return { from: fromDbDate(new Date(Date.UTC(y, m - 1, 1))), to: fromDbDate(new Date(Date.UTC(y, m, 0))) };
}

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2026-11-17" -> "Selasa, 17 Nov 2026" */
export function formatDateID(s: string, withDay = true): string {
  const d = toDbDate(s);
  const base = `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return withDay ? `${HARI[d.getUTCDay()]}, ${base}` : base;
}

export function formatRupiah(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return "Rp " + n.toLocaleString("id-ID");
}
