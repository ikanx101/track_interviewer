"use client";
// Filter periode + interviewer (+ status opsional) yang menulis ke query string halaman.
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { periodRange, todayWIB, type PeriodKey } from "@/lib/dates";

export type FilterBarProps = {
  from: string;
  to: string;
  interviewerId: number | null;
  interviewers: { id: number; name: string; active: boolean }[];
  status?: string | null;
  statusOptions?: { value: string; label: string }[];
};

const SHORTCUTS: { key: PeriodKey | "hari-ini"; label: string }[] = [
  { key: "hari-ini", label: "Hari ini" },
  { key: "minggu-ini", label: "Minggu ini" },
  { key: "bulan-ini", label: "Bulan ini" },
  { key: "bulan-lalu", label: "Bulan lalu" },
];

export default function FilterBar(p: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(p.from);
  const [to, setTo] = useState(p.to);
  const [iid, setIid] = useState(p.interviewerId ? String(p.interviewerId) : "");
  const [status, setStatus] = useState(p.status ?? "");

  function go(next: { from?: string; to?: string; iid?: string; status?: string }) {
    const v = { from, to, iid, status, ...next };
    const sp = new URLSearchParams();
    if (v.from) sp.set("from", v.from);
    if (v.to) sp.set("to", v.to);
    if (v.iid) sp.set("interviewerId", v.iid);
    if (v.status && p.statusOptions) sp.set("status", v.status);
    router.push(`${pathname}?${sp.toString()}`);
  }

  function shortcut(key: PeriodKey | "hari-ini") {
    const t = todayWIB();
    const r = key === "hari-ini" ? { from: t, to: t } : periodRange(key, t);
    setFrom(r.from);
    setTo(r.to);
    go(r);
  }

  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        go({});
      }}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <div>
          <label className="label" htmlFor="f-from">Dari</label>
          <input id="f-from" type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="f-to">Sampai</label>
          <input id="f-to" type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} required />
        </div>
        <div className={p.statusOptions ? "" : "col-span-2 md:col-span-1"}>
          <label className="label" htmlFor="f-int">Interviewer</label>
          <select id="f-int" className="input" value={iid} onChange={(e) => setIid(e.target.value)}>
            <option value="">Semua interviewer</option>
            {p.interviewers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
                {i.active ? "" : " (nonaktif)"}
              </option>
            ))}
          </select>
        </div>
        {p.statusOptions && (
          <div>
            <label className="label" htmlFor="f-status">Status</label>
            <select id="f-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Semua status</option>
              {p.statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
        <div className="col-span-2 flex items-end md:col-span-4 lg:col-span-1">
          <button type="submit" className="btn-primary w-full">Terapkan</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {SHORTCUTS.map((s) => (
          <button key={s.key} type="button" className="btn-secondary btn-sm" onClick={() => shortcut(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
    </form>
  );
}
