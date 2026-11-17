"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { periodRange, type PeriodKey } from "@/lib/dates";

const SHORTCUTS: { key: PeriodKey; label: string }[] = [
  { key: "minggu-ini", label: "Minggu ini" },
  { key: "bulan-ini", label: "Bulan ini" },
  { key: "bulan-lalu", label: "Bulan lalu" },
];

/** Filter periode (rentang bebas + 3 pintasan) dan opsional interviewer. Menulis ke query string. */
export default function PeriodFilter({
  from,
  to,
  interviewerId,
  interviewers,
}: {
  from: string;
  to: string;
  interviewerId?: number | null;
  interviewers?: { id: number; name: string; active: boolean }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [iid, setIid] = useState(interviewerId ? String(interviewerId) : "");

  function go(nf: string, nt: string, ni: string) {
    const sp = new URLSearchParams({ from: nf, to: nt });
    if (ni) sp.set("interviewerId", ni);
    router.push(`${pathname}?${sp.toString()}`);
  }

  function shortcut(k: PeriodKey) {
    const r = periodRange(k);
    setF(r.from);
    setT(r.to);
    go(r.from, r.to, iid);
  }

  const activeShortcut = SHORTCUTS.find((s) => {
    const r = periodRange(s.key);
    return r.from === from && r.to === to;
  })?.key;

  return (
    <form
      className="card flex flex-col gap-3 lg:flex-row lg:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (f && t) go(f <= t ? f : t, f <= t ? t : f, iid);
      }}
    >
      <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
        <div>
          <label className="label" htmlFor="pf-from">Dari</label>
          <input id="pf-from" type="date" className="input" value={f} max={t || undefined} onChange={(e) => setF(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="pf-to">Sampai</label>
          <input id="pf-to" type="date" className="input" value={t} min={f || undefined} onChange={(e) => setT(e.target.value)} required />
        </div>
      </div>
      {interviewers && (
        <div className="sm:w-56">
          <label className="label" htmlFor="pf-iid">Interviewer</label>
          <select id="pf-iid" className="input" value={iid} onChange={(e) => { setIid(e.target.value); go(f, t, e.target.value); }}>
            <option value="">Semua interviewer</option>
            {interviewers.map((i) => (
              <option key={i.id} value={i.id}>{i.name}{i.active ? "" : " (nonaktif)"}</option>
            ))}
          </select>
        </div>
      )}
      <button type="submit" className="btn-primary">Tampilkan</button>
      <div className="flex flex-wrap gap-2 lg:ml-auto">
        {SHORTCUTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => shortcut(s.key)}
            className={`btn-sm ${activeShortcut === s.key ? "btn-primary" : "btn-secondary"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </form>
  );
}
