"use client";
import { useMemo, useState } from "react";
import type { TransportRow } from "@/lib/export";
import { formatDateID, formatRupiah } from "@/lib/dates";
import { TRANSPORT_LABEL } from "@/lib/report";
import { canTransition, formatDateTimeWIB, TRANSPORT_STATUSES, type TransportStatusKey } from "@/lib/matching";
import RevisionButton from "@/components/RevisionButton";

const BADGE: Record<TransportStatusKey, string> = {
  DIAJUKAN: "badge-yellow",
  DISETUJUI: "badge-blue",
  DIBAYAR: "badge-green",
};

const NEXT_LABEL: Record<TransportStatusKey, string> = {
  DIAJUKAN: "Kembalikan ke Diajukan",
  DISETUJUI: "Setujui",
  DIBAYAR: "Tandai Dibayar",
};

function neighbors(s: TransportStatusKey) {
  const i = TRANSPORT_STATUSES.indexOf(s);
  return { prev: i > 0 ? TRANSPORT_STATUSES[i - 1] : null, next: i < TRANSPORT_STATUSES.length - 1 ? TRANSPORT_STATUSES[i + 1] : null };
}

export default function TransportTable({ initialRows, statusFilter }: { initialRows: TransportRow[]; statusFilter: TransportStatusKey | null }) {
  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const totals = useMemo(() => {
    const t = Object.fromEntries([...TRANSPORT_STATUSES, "ALL"].map((k) => [k, { count: 0, amount: 0 }])) as Record<
      TransportStatusKey | "ALL",
      { count: number; amount: number }
    >;
    for (const r of rows) {
      t[r.status].count++;
      t[r.status].amount += r.amount;
      t.ALL.count++;
      t.ALL.amount += r.amount;
    }
    return t;
  }, [rows]);

  const visible = statusFilter ? rows.filter((r) => r.status === statusFilter) : rows;
  const visibleIds = visible.map((r) => r.reportId);
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const selectedRows = rows.filter((r) => selected.has(r.reportId));

  function toggle(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function change(ids: number[], status: TransportStatusKey) {
    const target = TRANSPORT_STATUSES.indexOf(status);
    const backward = rows.some((r) => ids.includes(r.reportId) && TRANSPORT_STATUSES.indexOf(r.status) > target);
    if (backward && !confirm(`Kembalikan status ke ${TRANSPORT_LABEL[status]}? Gunakan hanya untuk koreksi.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/transport", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status.");
      const upd = new Set<number>(data.updated);
      setRows((rs) => rs.map((r) => (upd.has(r.reportId) ? { ...r, status, statusUpdatedAt: data.updatedAt } : r)));
      setSelected((s) => new Set([...s].filter((id) => !upd.has(id))));
      const skipped = data.skipped as { id: number; reason: string }[];
      setMsg({
        ok: skipped.length === 0,
        text:
          `${upd.size} rekap diubah menjadi ${TRANSPORT_LABEL[status]}.` +
          (skipped.length ? ` ${skipped.length} dilewati (status hanya bisa maju/mundur satu langkah).` : ""),
      });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Gagal mengubah status." });
    } finally {
      setBusy(false);
    }
  }

  const bulkTargets = TRANSPORT_STATUSES.filter((s) => selectedRows.some((r) => canTransition(r.status, s)));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TRANSPORT_STATUSES.map((s) => (
          <div key={s} className={`card !p-3 ${statusFilter === s ? "ring-2 ring-brand-500" : ""}`}>
            <div className="flex items-center justify-between">
              <span className={BADGE[s]}>{TRANSPORT_LABEL[s]}</span>
              <span className="text-xs text-slate-500">{totals[s].count} rekap</span>
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{formatRupiah(totals[s].amount)}</div>
          </div>
        ))}
        <div className="card !p-3">
          <div className="flex items-center justify-between">
            <span className="badge-gray">Total</span>
            <span className="text-xs text-slate-500">{totals.ALL.count} rekap</span>
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{formatRupiah(totals.ALL.amount)}</div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="card sticky top-16 z-20 flex flex-wrap items-center gap-2 !p-3">
          <span className="text-sm font-medium">{selected.size} dipilih</span>
          <span className="text-sm text-slate-500">({formatRupiah(selectedRows.reduce((s, r) => s + r.amount, 0))})</span>
          {bulkTargets.map((s) => (
            <button
              key={s}
              type="button"
              className={s === "DIAJUKAN" ? "btn-secondary btn-sm" : "btn-primary btn-sm"}
              disabled={busy}
              onClick={() => change([...selected], s)}
            >
              {NEXT_LABEL[s]}
            </button>
          ))}
          <button type="button" className="btn-secondary btn-sm" onClick={() => setSelected(new Set())}>
            Batal pilih
          </button>
        </div>
      )}
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-amber-700"}`}>{msg.text}</p>}

      {visible.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">Tidak ada pengajuan transport pada periode/filter ini.</div>
      ) : (
        <>
          <div className="table-wrap hidden md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Pilih semua"
                      checked={allChecked}
                      onChange={() => setSelected(allChecked ? new Set() : new Set(visibleIds))}
                    />
                  </th>
                  <th>Tanggal</th>
                  <th>Interviewer</th>
                  <th>Project PC & perolehan</th>
                  <th className="text-right">Nominal</th>
                  <th>Keterangan</th>
                  <th>Status</th>
                  <th>Perubahan terakhir</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const nb = neighbors(r.status);
                  return (
                    <tr key={r.reportId} className={selected.has(r.reportId) ? "bg-brand-50" : ""}>
                      <td>
                        <input type="checkbox" aria-label="Pilih" checked={selected.has(r.reportId)} onChange={() => toggle(r.reportId)} />
                      </td>
                      <td className="whitespace-nowrap">{formatDateID(r.date)}</td>
                      <td className="whitespace-nowrap">
                        {r.interviewerName}
                        <div className="mt-0.5">
                          <RevisionButton reportId={r.reportId} revision={r.revision} />
                        </div>
                      </td>
                      <td>
                        <PcItems r={r} />
                      </td>
                      <td className="whitespace-nowrap text-right font-medium tabular-nums">{formatRupiah(r.amount)}</td>
                      <td className="max-w-xs break-words">{r.note || <span className="text-slate-400">-</span>}</td>
                      <td>
                        <span className={BADGE[r.status]}>{TRANSPORT_LABEL[r.status]}</span>
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-500">{r.statusUpdatedAt ? formatDateTimeWIB(r.statusUpdatedAt) : "-"}</td>
                      <td className="whitespace-nowrap">
                        <RowActions prev={nb.prev} next={nb.next} busy={busy} onChange={(s) => change([r.reportId], s)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(visibleIds))} />
              Pilih semua ({visible.length})
            </label>
            {visible.map((r) => {
              const nb = neighbors(r.status);
              return (
                <div key={r.reportId} className={`card space-y-2 ${selected.has(r.reportId) ? "ring-2 ring-brand-500" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex items-start gap-2">
                      <input type="checkbox" className="mt-1" checked={selected.has(r.reportId)} onChange={() => toggle(r.reportId)} />
                      <span>
                        <span className="font-medium">{r.interviewerName}</span>
                        <span className="block text-xs text-slate-500">{formatDateID(r.date)}</span>
                      </span>
                    </label>
                    <span className={BADGE[r.status]}>{TRANSPORT_LABEL[r.status]}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <PcItems r={r} />
                    <span className="whitespace-nowrap font-semibold tabular-nums">{formatRupiah(r.amount)}</span>
                  </div>
                  {r.note && <p className="text-sm text-slate-600">{r.note}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                      {r.statusUpdatedAt ? `Diubah ${formatDateTimeWIB(r.statusUpdatedAt)}` : ""}{" "}
                      <RevisionButton reportId={r.reportId} revision={r.revision} />
                    </span>
                    <RowActions prev={nb.prev} next={nb.next} busy={busy} onChange={(s) => change([r.reportId], s)} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="text-xs text-slate-500">
        Alur status: Diajukan → Disetujui → Dibayar. Untuk koreksi, status dapat dikembalikan satu langkah. Nominal yang sudah Disetujui/Dibayar
        terkunci bagi interviewer.
      </p>
    </div>
  );
}

function PcItems({ r }: { r: TransportRow }) {
  if (!r.pcItems.length) return <span className="text-xs text-slate-400">Tidak ada perolehan PC</span>;
  return (
    <ul className="text-sm">
      {r.pcItems.map((i) => (
        <li key={i.projectCode}>
          <b>{i.projectCode}</b>: {i.count}
        </li>
      ))}
    </ul>
  );
}

function RowActions({
  prev,
  next,
  busy,
  onChange,
}: {
  prev: TransportStatusKey | null;
  next: TransportStatusKey | null;
  busy: boolean;
  onChange: (s: TransportStatusKey) => void;
}) {
  return (
    <div className="flex gap-1">
      {prev && (
        <button type="button" className="btn-secondary btn-sm" disabled={busy} title={`Kembalikan ke ${TRANSPORT_LABEL[prev]}`} onClick={() => onChange(prev)}>
          ← {TRANSPORT_LABEL[prev]}
        </button>
      )}
      {next && (
        <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={() => onChange(next)}>
          {NEXT_LABEL[next]} →
        </button>
      )}
    </div>
  );
}
