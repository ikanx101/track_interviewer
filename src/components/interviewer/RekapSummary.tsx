"use client";

import { formatDateID, formatRupiah } from "@/lib/dates";
import type { RekapSaveResult } from "@/components/interviewer/types";

const TRANSPORT_LABEL: Record<string, string> = { DIAJUKAN: "Diajukan", DISETUJUI: "Disetujui", DIBAYAR: "Dibayar" };

/** Konfirmasi setelah rekap berhasil disimpan. */
export default function RekapSummary({
  result,
  onEdit,
  onOtherDate,
}: {
  result: RekapSaveResult;
  onEdit: () => void;
  onOtherDate: () => void;
}) {
  const r = result.report;
  const time = new Date(r.updatedAt).toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <section className="space-y-4" aria-live="polite">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <p className="text-lg font-semibold">✓ Rekap berhasil {result.created ? "dikirim" : "diperbarui"}</p>
        <p className="text-sm">
          {r.interviewerName} · {formatDateID(r.date)} · tersimpan pukul {time} WIB
          {r.revision > 1 ? ` · revisi ke-${r.revision}` : ""}
        </p>
      </div>

      <div className="card space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-900">Ringkasan</h2>
          <p className="text-sm text-slate-600">
            Total responden: <span className="text-xl font-bold text-slate-900">{r.totalResponden}</span>
          </p>
        </div>
        {r.items.length ? (
          <ul className="divide-y divide-slate-100">
            {r.items.map((it) => (
              <li key={it.projectId} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {it.projectCode} {it.isPC && <span className="badge-blue ml-1">PC</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">{it.projectName}</p>
                  <p className="text-sm text-slate-700">Area: {it.area}</p>
                </div>
                <p className="shrink-0 text-lg font-semibold">{it.count}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Tidak ada perolehan responden.</p>
        )}
        <dl className="grid grid-cols-[7.5rem_1fr] gap-y-1 border-t border-slate-100 pt-3 text-sm">
          <dt className="text-slate-500">Jam kerja</dt>
          <dd>{r.startTime || r.endTime ? `${r.startTime ?? "?"} – ${r.endTime ?? "?"}` : "-"}</dd>
          <dt className="text-slate-500">Area lain</dt>
          <dd className="whitespace-pre-line">{r.otherAreas || "-"}</dd>
          <dt className="text-slate-500">Catatan</dt>
          <dd className="whitespace-pre-line">{r.notes || "-"}</dd>
          {r.transportStatus && (
            <>
              <dt className="text-slate-500">Transport</dt>
              <dd>
                {formatRupiah(r.transportAmount)}{" "}
                <span className="text-slate-500">({TRANSPORT_LABEL[r.transportStatus]})</span>
                {r.transportNote && <span className="block text-slate-600">{r.transportNote}</span>}
              </dd>
            </>
          )}
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" className="btn-secondary py-3 text-base" onClick={onEdit}>
          Ubah rekap ini
        </button>
        <button type="button" className="btn-secondary py-3 text-base" onClick={onOtherDate}>
          Isi tanggal lain
        </button>
      </div>
    </section>
  );
}
