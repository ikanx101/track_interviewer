"use client";
// Tombol "Diubah N×" yang membuka riwayat versi rekap (GET /api/admin/reports/:id/history).
// Kontrak props: reportId (id Report), revision (Report.revision). Tampil hanya jika revision > 1.
import { useEffect, useState } from "react";
import { formatDateID, formatRupiah } from "@/lib/dates";
import { formatDateTimeWIB } from "@/lib/matching";
import { TRANSPORT_LABEL, type ReportSnapshot } from "@/lib/report";

type Version = ReportSnapshot & { historyId?: number; current?: boolean };

const FIELDS: { key: keyof ReportSnapshot; label: string; fmt?: (v: unknown) => string }[] = [
  { key: "startTime", label: "Jam mulai" },
  { key: "endTime", label: "Jam selesai" },
  { key: "otherAreas", label: "Area lain" },
  { key: "notes", label: "Catatan" },
  { key: "transportAmount", label: "Transport", fmt: (v) => (v === null || v === undefined ? "-" : formatRupiah(v as number)) },
  { key: "transportNote", label: "Ket. transport" },
  { key: "transportStatus", label: "Status transport", fmt: (v) => (v ? TRANSPORT_LABEL[String(v)] ?? String(v) : "-") },
];

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "-" : String(v));

function itemKey(i: ReportSnapshot["items"][number]) {
  return `${i.count}|${i.area}`;
}

export default function RevisionButton({ reportId, revision }: { reportId: number; revision: number }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function load() {
    setOpen(true);
    setError(null);
    setVersions(null);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/history`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat riwayat.");
      setVersions([...data.history, { ...data.current, current: true }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat riwayat.");
    }
  }

  if (revision <= 1) return null;

  return (
    <>
      <button type="button" onClick={load} className="badge-yellow hover:bg-amber-200" title="Lihat riwayat perubahan rekap">
        Diubah {revision - 1}×
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:max-w-2xl sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Riwayat revisi rekap</h2>
                {versions?.length ? (
                  <p className="text-xs text-slate-500">
                    {versions[versions.length - 1].interviewerName} · {formatDateID(versions[versions.length - 1].date)}
                  </p>
                ) : null}
              </div>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(false)}>
                Tutup
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {!versions && !error && <p className="text-sm text-slate-500">Memuat…</p>}
            {versions && (
              <>
                <p className="mb-3 text-xs text-slate-500">
                  <span className="rounded bg-amber-100 px-1">Kuning</span> = nilai yang diubah pada versi berikutnya.
                </p>
                <ol className="space-y-3">
                  {[...versions.keys()].reverse().map((idx) => {
                    const v = versions[idx];
                    const next = versions[idx + 1];
                    const nextItems = new Map((next?.items ?? []).map((i) => [i.projectId, i]));
                    const changed = (k: keyof ReportSnapshot) => !!next && JSON.stringify(v[k] ?? null) !== JSON.stringify(next[k] ?? null);
                    const hl = (c: boolean) => (c ? "rounded bg-amber-100 px-1" : "");
                    const removedInNext = next ? (next.items ?? []).filter((n) => !v.items.some((i) => i.projectId === n.projectId)) : [];
                    return (
                      <li key={`${v.revision}-${v.historyId ?? "cur"}`} className={`rounded-lg border p-3 ${v.current ? "border-brand-500" : "border-slate-200"}`}>
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold">Revisi {v.revision}</span>
                          {v.current ? <span className="badge-green">Versi aktif</span> : <span className="badge-gray">Versi lama</span>}
                          <span className="text-xs text-slate-500">disimpan {formatDateTimeWIB(v.savedAt)}</span>
                        </div>
                        <div className="text-sm">
                          <div className="mb-1 text-xs font-semibold uppercase text-slate-500">Perolehan</div>
                          {v.items.length === 0 ? (
                            <p className="text-slate-500">Tidak ada perolehan</p>
                          ) : (
                            <ul className="mb-2 space-y-0.5">
                              {v.items.map((i) => {
                                const n = nextItems.get(i.projectId);
                                const c = !!next && (!n || itemKey(n) !== itemKey(i));
                                return (
                                  <li key={i.projectId}>
                                    <span className={hl(c)}>
                                      <b>{i.projectCode}</b> {i.projectName}: {i.count} responden — {show(i.area)}
                                    </span>
                                    {c && !n && <span className="ml-1 text-xs text-slate-500">(dihapus di versi berikutnya)</span>}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          {removedInNext.length > 0 && (
                            <p className="mb-2 text-xs text-slate-500">
                              Ditambahkan di versi berikutnya: {removedInNext.map((i) => i.projectCode).join(", ")}
                            </p>
                          )}
                          <dl className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
                            {FIELDS.map((f) => (
                              <div key={f.key} className="flex gap-1">
                                <dt className="shrink-0 text-slate-500">{f.label}:</dt>
                                <dd className={`break-words ${hl(changed(f.key))}`}>{f.fmt ? f.fmt(v[f.key]) : show(v[f.key])}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
