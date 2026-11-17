"use client";
import { usePathname, useRouter } from "next/navigation";
import { addDays } from "@/lib/dates";

/** Pemilih tanggal untuk tab Hari Ini (navigasi via ?date=). */
export default function DatePicker({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (d: string) => router.push(d === today ? pathname : `${pathname}?date=${d}`);
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn-secondary btn-sm" onClick={() => go(addDays(date, -1))} aria-label="Hari sebelumnya">‹</button>
      <input type="date" className="input w-auto py-1" value={date} max={today} onChange={(e) => e.target.value && go(e.target.value)} />
      <button type="button" className="btn-secondary btn-sm" onClick={() => go(addDays(date, 1))} disabled={date >= today} aria-label="Hari berikutnya">›</button>
      {date !== today && (
        <button type="button" className="btn-secondary btn-sm" onClick={() => go(today)}>Hari ini</button>
      )}
    </div>
  );
}
