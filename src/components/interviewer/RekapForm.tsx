"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editWindowStart, formatDateID, formatRupiah, isWithinEditWindow } from "@/lib/dates";
import type {
  PublicInterviewer,
  PublicProject,
  PublicRekap,
  RekapPayload,
  RekapSaveResult,
} from "@/components/interviewer/types";
import RekapSummary from "@/components/interviewer/RekapSummary";

const LS_KEY = "iman.interviewerId";
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const TRANSPORT_LABEL: Record<string, string> = { DIAJUKAN: "Diajukan", DISETUJUI: "Disetujui", DIBAYAR: "Dibayar" };

type FormState = {
  counts: Record<number, string>;
  areas: Record<number, string>;
  startTime: string;
  endTime: string;
  otherAreas: string;
  notes: string;
  transportAmount: string; // digit saja
  transportNote: string;
};

const EMPTY_FORM: FormState = {
  counts: {},
  areas: {},
  startTime: "",
  endTime: "",
  otherAreas: "",
  notes: "",
  transportAmount: "",
  transportNote: "",
};

function formFromReport(r: PublicRekap | null): FormState {
  if (!r) return EMPTY_FORM;
  const counts: Record<number, string> = {};
  const areas: Record<number, string> = {};
  for (const it of r.items) {
    counts[it.projectId] = String(it.count);
    areas[it.projectId] = it.area;
  }
  return {
    counts,
    areas,
    startTime: r.startTime ?? "",
    endTime: r.endTime ?? "",
    otherAreas: r.otherAreas ?? "",
    notes: r.notes ?? "",
    transportAmount: r.transportAmount === null ? "" : String(r.transportAmount),
    transportNote: r.transportNote ?? "",
  };
}

function lsGet(): number | null {
  try {
    const v = Number(window.localStorage.getItem(LS_KEY));
    return Number.isInteger(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}
function lsSet(id: number | null) {
  try {
    if (id === null) window.localStorage.removeItem(LS_KEY);
    else window.localStorage.setItem(LS_KEY, String(id));
  } catch {
    /* abaikan: penyimpanan tidak tersedia */
  }
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Gagal memuat data. Periksa koneksi internet.");
  return data as T;
}

const toInt = (s: string | undefined) => (s && /^\d+$/.test(s) ? Number(s) : 0);

export default function RekapForm({ serverToday }: { serverToday: string }) {
  const today = serverToday;
  const minDate = editWindowStart(today);

  const [interviewers, setInterviewers] = useState<PublicInterviewer[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [interviewerId, setInterviewerId] = useState<number | null>(null);
  const [date, setDate] = useState(today);

  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [report, setReport] = useState<PublicRekap | null>(null);
  const [areaSuggestions, setAreaSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<RekapSaveResult | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reqId = useRef(0);

  const interviewer = interviewers?.find((i) => i.id === interviewerId) ?? null;
  const dateValid = isWithinEditWindow(date, today);

  // Daftar interviewer aktif + pilihan tersimpan di perangkat.
  const loadInterviewers = useCallback(() => {
    setListError(null);
    getJSON<{ interviewers: PublicInterviewer[] }>("/api/public/interviewers")
      .then(({ interviewers }) => {
        setInterviewers(interviewers);
        const stored = lsGet();
        if (stored && interviewers.some((i) => i.id === stored)) setInterviewerId(stored);
        else if (stored) lsSet(null);
      })
      .catch((e: Error) => setListError(e.message));
  }, []);
  useEffect(loadInterviewers, [loadInterviewers]);

  const loadAreas = useCallback(() => {
    getJSON<{ areas: string[] }>("/api/public/areas")
      .then(({ areas }) => setAreaSuggestions(areas))
      .catch(() => {});
  }, []);
  useEffect(loadAreas, [loadAreas]);

  // Muat project + rekap yang sudah ada setiap kali nama/tanggal berubah.
  useEffect(() => {
    if (!interviewerId || !dateValid) return;
    const id = ++reqId.current;
    setLoading(true);
    setLoadError(null);
    setSaved(null);
    setErrors({});
    setSubmitError(null);
    const q = `interviewerId=${interviewerId}&date=${date}`;
    Promise.all([
      getJSON<{ projects: PublicProject[] }>(`/api/public/projects?${q}`),
      getJSON<{ report: PublicRekap | null }>(`/api/public/rekap?${q}`),
    ])
      .then(([p, r]) => {
        if (id !== reqId.current) return;
        setProjects(p.projects);
        setReport(r.report);
        setForm(formFromReport(r.report));
        setDirty(false);
      })
      .catch((e: Error) => {
        if (id !== reqId.current) return;
        setLoadError(e.message);
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, [interviewerId, date, dateValid, reloadKey]);

  const confirmDiscard = () => !dirty || window.confirm("Isian yang belum dikirim akan hilang. Lanjutkan?");

  const chooseInterviewer = (id: number) => {
    lsSet(id);
    setInterviewerId(id);
  };
  const changeName = () => {
    if (!confirmDiscard()) return;
    lsSet(null);
    setInterviewerId(null);
    setReport(null);
    setForm(EMPTY_FORM);
    setDirty(false);
    setSaved(null);
  };
  const changeDate = (d: string) => {
    if (d === date) return;
    if (!confirmDiscard()) return;
    setDate(d);
  };

  const update = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };
  const setCount = (pid: number, v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 5);
    setForm((f) => ({ ...f, counts: { ...f.counts, [pid]: clean } }));
    setDirty(true);
    setErrors((e) => ({ ...e, [`count-${pid}`]: "", [`area-${pid}`]: "" }));
  };
  const setArea = (pid: number, v: string) => {
    setForm((f) => ({ ...f, areas: { ...f.areas, [pid]: v } }));
    setDirty(true);
    setErrors((e) => ({ ...e, [`area-${pid}`]: "" }));
  };

  const pcIds = useMemo(() => new Set(projects.filter((p) => p.isPC).map((p) => p.id)), [projects]);
  const hasPC = projects.some((p) => pcIds.has(p.id) && toInt(form.counts[p.id]) > 0);
  const total = projects.reduce((s, p) => s + toInt(form.counts[p.id]), 0);
  const transportLocked = !!report?.transportLocked;
  const showTransport = hasPC || transportLocked;
  const isUpdate = !!report;

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    let anyItem = false;
    for (const p of projects) {
      const c = toInt(form.counts[p.id]);
      if (c > 0) {
        anyItem = true;
        if (!form.areas[p.id]?.trim()) errs[`area-${p.id}`] = "Area wajib diisi karena ada perolehan.";
      }
    }
    if (form.startTime && !TIME_RE.test(form.startTime)) errs.startTime = "Format jam tidak valid.";
    if (form.endTime && !TIME_RE.test(form.endTime)) errs.endTime = "Format jam tidak valid.";
    if (hasPC && !transportLocked && form.transportAmount === "") {
      errs.transportAmount = "Nominal transport wajib diisi (isi 0 jika tidak ada biaya).";
    }
    if (transportLocked && !hasPC) {
      errs.transportAmount =
        "Transport sudah " +
        (report?.transportStatus === "DIBAYAR" ? "dibayar" : "disetujui") +
        ", perolehan project PC tidak bisa dikosongkan.";
    }
    if (!anyItem && !form.otherAreas.trim() && !form.notes.trim()) {
      errs.general = "Isi minimal satu perolehan, area lain, atau catatan.";
    }
    return errs;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!interviewerId || submitting) return;
    setSubmitError(null);
    const errs = validate();
    setErrors(errs);
    const firstKey = Object.keys(errs)[0];
    if (firstKey) {
      setSubmitError(errs.general || "Periksa kembali isian yang ditandai merah.");
      const el = document.getElementById(`f-${firstKey}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true });
      return;
    }
    const payload: RekapPayload = {
      interviewerId,
      date,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      otherAreas: form.otherAreas.trim() || null,
      notes: form.notes.trim() || null,
      transportAmount: hasPC && !transportLocked ? form.transportAmount : null,
      transportNote: hasPC && !transportLocked ? form.transportNote.trim() || null : null,
      items: projects
        .filter((p) => toInt(form.counts[p.id]) > 0)
        .map((p) => ({ projectId: p.id, count: toInt(form.counts[p.id]), area: form.areas[p.id]?.trim() ?? "" })),
    };
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/rekap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan rekap. Silakan coba lagi.");
      const result = data as RekapSaveResult;
      setReport(result.report);
      setForm(formFromReport(result.report));
      setDirty(false);
      setSaved(result);
      loadAreas();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitError(
        err instanceof TypeError
          ? "Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi."
          : (err as Error).message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------- Render ----------------

  const header = (
    <header className="bg-brand-700 px-4 pb-4 pt-5 text-white">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-100">IMaN · Nutrifood</p>
        <h1 className="text-xl font-semibold">Rekap Akhir Hari</h1>
      </div>
    </header>
  );

  if (!interviewers) {
    return (
      <div>
        {header}
        <main className="mx-auto max-w-xl p-4">
          {listError ? (
            <div className="card space-y-3 border-red-200 bg-red-50 text-red-800">
              <p>{listError}</p>
              <button className="btn-secondary w-full py-3" onClick={loadInterviewers}>
                Coba lagi
              </button>
            </div>
          ) : (
            <p className="card text-center text-slate-500">Memuat daftar interviewer…</p>
          )}
        </main>
      </div>
    );
  }

  if (!interviewerId || !interviewer) {
    return (
      <div>
        {header}
        <main className="mx-auto max-w-xl space-y-3 p-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Siapa nama Anda?</h2>
            <p className="text-sm text-slate-500">Pilihan akan diingat di HP ini untuk kunjungan berikutnya.</p>
          </div>
          {interviewers.length === 0 ? (
            <p className="card text-slate-500">Belum ada interviewer aktif. Hubungi Admin Field.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {interviewers.map((iv) => (
                <button
                  key={iv.id}
                  type="button"
                  onClick={() => chooseInterviewer(iv.id)}
                  className="min-h-[56px] rounded-xl border border-slate-300 bg-white px-3 py-3 text-base font-medium text-slate-800 shadow-sm active:bg-brand-50 hover:border-brand-500"
                >
                  {iv.name}
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div>
      {header}
      <main className="mx-auto max-w-xl space-y-4 p-4 pb-32">
        {/* Nama & tanggal */}
        <section className="card space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Interviewer</p>
              <p className="truncate text-lg font-semibold text-slate-900">{interviewer.name}</p>
            </div>
            <button type="button" className="btn-secondary shrink-0 py-2.5" onClick={changeName}>
              Ganti nama
            </button>
          </div>
          <div>
            <label className="label" htmlFor="f-date">
              Tanggal turun lapangan
            </label>
            <div className="flex gap-2">
              <input
                id="f-date"
                type="date"
                className="input py-2.5 text-base"
                value={date}
                min={minDate}
                max={today}
                onChange={(e) => e.target.value && changeDate(e.target.value)}
              />
              {date !== today && (
                <button type="button" className="btn-secondary shrink-0" onClick={() => changeDate(today)}>
                  Hari ini
                </button>
              )}
            </div>
            {dateValid ? (
              <p className="mt-1 text-sm text-slate-600">
                {formatDateID(date)}
                {date === today && <span className="ml-1 text-brand-700">(hari ini)</span>}
              </p>
            ) : (
              <p className="mt-1 text-sm text-red-600">
                Pilih tanggal antara {formatDateID(minDate, false)} dan {formatDateID(today, false)}.
              </p>
            )}
          </div>
        </section>

        {!dateValid ? null : loading ? (
          <p className="card text-center text-slate-500">Memuat data rekap…</p>
        ) : loadError ? (
          <div className="card space-y-3 border-red-200 bg-red-50 text-red-800">
            <p>{loadError}</p>
            <button type="button" className="btn-secondary w-full py-3" onClick={() => setReloadKey((k) => k + 1)}>
              Coba lagi
            </button>
          </div>
        ) : saved ? (
          <RekapSummary
            result={saved}
            onEdit={() => setSaved(null)}
            onOtherDate={() => {
              setSaved(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
              document.getElementById("f-date")?.focus();
            }}
          />
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            {isUpdate && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Rekap tanggal ini sudah dikirim
                {report!.revision > 1 ? ` (sudah diperbarui ${report!.revision - 1}×)` : ""}. Ubah isian yang salah lalu
                tekan <b>Perbarui rekap</b>.
              </div>
            )}

            {/* Perolehan per project */}
            <section className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Perolehan per project</h2>
                <p className="text-sm text-slate-500">Kosongkan project yang tidak dikerjakan hari itu.</p>
              </div>
              {projects.length === 0 && (
                <p className="card text-sm text-slate-500">
                  Belum ada project berjalan untuk tanggal ini. Anda tetap bisa mengisi area lain atau catatan.
                </p>
              )}
              {projects.map((p) => {
                const c = form.counts[p.id] ?? "";
                const active = toInt(c) > 0;
                const countErr = errors[`count-${p.id}`];
                const areaErr = errors[`area-${p.id}`];
                return (
                  <div key={p.id} className={`card space-y-3 ${active ? "border-brand-500 ring-1 ring-brand-100" : ""}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold text-slate-900">{p.code}</span>
                      {p.isPC && <span className="badge-blue">PC</span>}
                      {p.status === "SELESAI" && <span className="badge-gray">Selesai</span>}
                      <span className="w-full text-sm text-slate-600">{p.name}</span>
                    </div>
                    <div className="grid grid-cols-[6.5rem_1fr] gap-3">
                      <div>
                        <label className="label" htmlFor={`f-count-${p.id}`}>
                          Responden
                        </label>
                        <input
                          id={`f-count-${p.id}`}
                          className={`input py-2.5 text-center text-lg font-semibold ${countErr ? "border-red-500" : ""}`}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="off"
                          placeholder="–"
                          value={c}
                          onChange={(e) => setCount(p.id, e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor={`f-area-${p.id}`}>
                          Area {active && <span className="text-red-600">*</span>}
                        </label>
                        <input
                          id={`f-area-${p.id}`}
                          className={`input py-2.5 text-base ${areaErr ? "border-red-500" : ""}`}
                          list="area-suggestions"
                          autoComplete="off"
                          maxLength={200}
                          placeholder="Nama area"
                          value={form.areas[p.id] ?? ""}
                          onChange={(e) => setArea(p.id, e.target.value)}
                        />
                      </div>
                    </div>
                    {(countErr || areaErr) && <p className="text-sm text-red-600">{countErr || areaErr}</p>}
                  </div>
                );
              })}
              <datalist id="area-suggestions">
                {areaSuggestions.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </section>

            {/* Transport PC */}
            {showTransport && (
              <section className="card space-y-3 border-sky-200 bg-sky-50/50">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900">Transport project PC</h2>
                  {report?.transportStatus && (
                    <span
                      className={
                        report.transportStatus === "DIBAYAR"
                          ? "badge-green"
                          : report.transportStatus === "DISETUJUI"
                            ? "badge-blue"
                            : "badge-yellow"
                      }
                    >
                      {TRANSPORT_LABEL[report.transportStatus]}
                    </span>
                  )}
                </div>
                {transportLocked ? (
                  <>
                    <p className="text-sm text-slate-600">
                      Transport sudah {report!.transportStatus === "DIBAYAR" ? "dibayar" : "disetujui"} sehingga tidak
                      dapat diubah. Hubungi Admin Field bila ada kesalahan.
                    </p>
                    <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
                      <dt className="text-slate-500">Nominal</dt>
                      <dd className="font-semibold">{formatRupiah(report!.transportAmount)}</dd>
                      <dt className="text-slate-500">Keterangan</dt>
                      <dd>{report!.transportNote || "-"}</dd>
                    </dl>
                    {errors.transportAmount && (
                      <p id="f-transportAmount" className="text-sm text-red-600">
                        {errors.transportAmount}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <label className="label" htmlFor="f-transportAmount">
                        Nominal transport (Rp) <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
                          Rp
                        </span>
                        <input
                          id="f-transportAmount"
                          className={`input py-2.5 pl-10 text-base ${errors.transportAmount ? "border-red-500" : ""}`}
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="0"
                          value={form.transportAmount === "" ? "" : Number(form.transportAmount).toLocaleString("id-ID")}
                          onChange={(e) => {
                            update({ transportAmount: e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 9) });
                            setErrors((er) => ({ ...er, transportAmount: "" }));
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Isi 0 jika tidak ada biaya.</p>
                      {errors.transportAmount && <p className="mt-1 text-sm text-red-600">{errors.transportAmount}</p>}
                    </div>
                    <div>
                      <label className="label" htmlFor="f-transportNote">
                        Keterangan transport
                      </label>
                      <input
                        id="f-transportNote"
                        className="input py-2.5 text-base"
                        maxLength={1000}
                        placeholder="Mis. ojek PP ke lokasi"
                        value={form.transportNote}
                        onChange={(e) => update({ transportNote: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </section>
            )}

            {/* Jam kerja */}
            <section className="card space-y-3">
              <h2 className="text-base font-semibold text-slate-900">
                Jam kerja <span className="text-sm font-normal text-slate-500">(opsional)</span>
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="f-startTime">
                    Jam mulai
                  </label>
                  <input
                    id="f-startTime"
                    type="time"
                    className={`input py-2.5 text-base ${errors.startTime ? "border-red-500" : ""}`}
                    value={form.startTime}
                    onChange={(e) => update({ startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="f-endTime">
                    Jam selesai
                  </label>
                  <input
                    id="f-endTime"
                    type="time"
                    className={`input py-2.5 text-base ${errors.endTime ? "border-red-500" : ""}`}
                    value={form.endTime}
                    onChange={(e) => update({ endTime: e.target.value })}
                  />
                </div>
              </div>
              {(errors.startTime || errors.endTime) && (
                <p className="text-sm text-red-600">{errors.startTime || errors.endTime}</p>
              )}
            </section>

            {/* Area lain & catatan */}
            <section className="card space-y-3">
              <div>
                <label className="label" htmlFor="f-otherAreas">
                  Area lain <span className="font-normal text-slate-500">(opsional)</span>
                </label>
                <textarea
                  id="f-otherAreas"
                  rows={2}
                  maxLength={1000}
                  className="input text-base"
                  placeholder="Area yang didatangi tapi belum dapat responden"
                  value={form.otherAreas}
                  onChange={(e) => {
                    update({ otherAreas: e.target.value });
                    setErrors((er) => ({ ...er, general: "" }));
                  }}
                />
              </div>
              <div>
                <label className="label" htmlFor="f-notes">
                  Catatan / kendala <span className="font-normal text-slate-500">(opsional)</span>
                </label>
                <textarea
                  id="f-notes"
                  rows={3}
                  maxLength={1000}
                  className="input text-base"
                  placeholder="Mis. hujan, responden menolak, dll."
                  value={form.notes}
                  onChange={(e) => {
                    update({ notes: e.target.value });
                    setErrors((er) => ({ ...er, general: "" }));
                  }}
                />
              </div>
            </section>

            {/* Tombol kirim melekat di bawah */}
            <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] backdrop-blur">
              <div className="mx-auto max-w-xl space-y-2">
                {submitError && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {submitError}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <div className="shrink-0 text-center">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-lg font-bold leading-tight text-slate-900">{total}</p>
                  </div>
                  <button type="submit" className="btn-primary flex-1 py-3.5 text-base" disabled={submitting}>
                    {submitting ? "Menyimpan…" : isUpdate ? "Perbarui rekap" : "Kirim rekap"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
