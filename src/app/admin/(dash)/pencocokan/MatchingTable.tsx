"use client";
import { useMemo, useState } from "react";
import type { MatchingRow } from "@/lib/export";
import { formatDateID } from "@/lib/dates";
import { formatSelisih, type MatchStatus } from "@/lib/matching";
import RevisionButton from "@/components/RevisionButton";

type Draft = { actual: string; note: string; followedUp: boolean };
type RowState = MatchingRow & { draft: Draft; saving: boolean; error: string | null; savedFlash: boolean };
type View = "semua" | "selisih" | "belum" | "cocok" | "belum-tl";

const toDraft = (r: MatchingRow): Draft => ({
  actual: r.actualCount === null ? "" : String(r.actualCount),
  note: r.note ?? "",
  followedUp: r.followedUp,
});

const isDirty = (r: RowState) => {
  const d = toDraft(r);
  return d.actual !== r.draft.actual.trim() || d.note !== r.draft.note.trim() || d.followedUp !== r.draft.followedUp;
};

function StatusBadge({ status, selisih }: { status: MatchStatus; selisih: number | null }) {
  if (status === "BELUM") return <span className="badge-gray">Belum dicocokkan</span>;
  if (status === "COCOK") return <span className="badge-green">Cocok</span>;
  return <span className="badge-red">Selisih {formatSelisih(selisih ?? 0)}</span>;
}

/** Selisih pratinjau dari isian yang belum disimpan. */
function previewSelisih(r: RowState): { status: MatchStatus; selisih: number | null } {
  const t = r.draft.actual.trim();
  if (t === "") return { status: "BELUM", selisih: null };
  const n = Number(t);
  if (!Number.isInteger(n) || n < 0) return { status: r.status, selisih: r.selisih };
  const s = r.rekap - n;
  return { status: s === 0 ? "COCOK" : "SELISIH", selisih: s };
}

export default function MatchingTable({
  initialRows,
  interviewers,
  projects,
  defaultDate,
  today,
}: {
  initialRows: MatchingRow[];
  interviewers: { id: number; name: string }[];
  projects: { id: number; code: string; name: string }[];
  defaultDate: string;
  today: string;
}) {
  const [rows, setRows] = useState<RowState[]>(() =>
    initialRows.map((r) => ({ ...r, draft: toDraft(r), saving: false, error: null, savedFlash: false })),
  );
  const [view, setView] = useState<View>("semua");
  const [showAdd, setShowAdd] = useState(false);

  const summary = useMemo(() => {
    const s = { total: rows.length, cocok: 0, selisih: 0, belum: 0, belumTl: 0 };
    for (const r of rows) {
      if (r.status === "COCOK") s.cocok++;
      else if (r.status === "SELISIH") {
        s.selisih++;
        if (!r.followedUp) s.belumTl++;
      } else s.belum++;
    }
    return s;
  }, [rows]);

  const visible = rows.filter((r) => {
    if (view === "selisih") return r.status === "SELISIH";
    if (view === "belum") return r.status === "BELUM";
    if (view === "cocok") return r.status === "COCOK";
    if (view === "belum-tl") return r.status === "SELISIH" && !r.followedUp;
    return true;
  });
  const dirtyCount = rows.filter(isDirty).length;

  function patch(key: string, p: Partial<RowState>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }
  function setDraft(key: string, d: Partial<Draft>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, draft: { ...r.draft, ...d }, error: null, savedFlash: false } : r)));
  }

  async function save(r: RowState): Promise<boolean> {
    const actual = r.draft.actual.trim();
    if (actual === "" && r.matchingId !== null && (r.note || r.followedUp)) {
      if (!confirm("Mengosongkan data masuk akan menghapus catatan dan tanda tindak lanjut baris ini. Lanjutkan?")) return false;
    }
    patch(r.key, { saving: true, error: null });
    try {
      const res = await fetch("/api/admin/matching", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewerId: r.interviewerId,
          projectId: r.projectId,
          date: r.date,
          actualCount: actual,
          note: actual === "" ? "" : r.draft.note,
          followedUp: actual === "" ? false : r.draft.followedUp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan.");
      const updated: MatchingRow = {
        ...r,
        rekap: data.rekap,
        matchingId: data.matchingId,
        actualCount: data.actualCount,
        selisih: data.selisih,
        status: data.status,
        note: data.note,
        followedUp: data.followedUp,
      };
      // Baris tanpa rekap yang data masuknya dikosongkan → hilang dari daftar.
      if (data.deleted && !r.hasReportItem) {
        setRows((rs) => rs.filter((x) => x.key !== r.key));
      } else {
        patch(r.key, { ...updated, draft: toDraft(updated), saving: false, savedFlash: true });
      }
      return true;
    } catch (e) {
      patch(r.key, { saving: false, error: e instanceof Error ? e.message : "Gagal menyimpan." });
      return false;
    }
  }

  async function saveAll() {
    for (const r of rows.filter(isDirty)) await save(r);
  }

  function onAdded(row: MatchingRow) {
    setRows((rs) => {
      const st: RowState = { ...row, draft: toDraft(row), saving: false, error: null, savedFlash: true };
      const exists = rs.some((r) => r.key === row.key);
      return exists ? rs.map((r) => (r.key === row.key ? { ...r, ...st } : r)) : [st, ...rs];
    });
  }

  const viewBtn = (v: View, label: string, n: number, cls: string) => (
    <button
      type="button"
      onClick={() => setView(view === v ? "semua" : v)}
      className={`card flex flex-col items-start !p-3 text-left transition ${view === v ? "ring-2 ring-brand-500" : "hover:bg-slate-50"}`}
    >
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-2xl font-semibold ${cls}`}>{n}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {viewBtn("cocok", "Cocok", summary.cocok, "text-emerald-700")}
        {viewBtn("selisih", "Selisih", summary.selisih, "text-red-700")}
        {viewBtn("belum", "Belum dicocokkan", summary.belum, "text-slate-700")}
        {viewBtn("belum-tl", "Selisih belum ditindaklanjuti", summary.belumTl, "text-amber-700")}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={view === "selisih"} onChange={(e) => setView(e.target.checked ? "selisih" : "semua")} />
            Hanya selisih
          </label>
          <span className="text-slate-500">
            Menampilkan {visible.length} dari {rows.length} baris
            {view !== "semua" && (
              <button type="button" className="ml-2 text-brand-700 underline" onClick={() => setView("semua")}>
                tampilkan semua
              </button>
            )}
          </span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={() => setShowAdd(!showAdd)}>
            + Data masuk tanpa rekap
          </button>
          <button type="button" className="btn-primary btn-sm" disabled={dirtyCount === 0} onClick={saveAll}>
            Simpan semua{dirtyCount ? ` (${dirtyCount})` : ""}
          </button>
        </div>
      </div>

      {showAdd && (
        <AddForm interviewers={interviewers} projects={projects} defaultDate={defaultDate} today={today} onAdded={onAdded} />
      )}

      {rows.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">Belum ada rekap perolehan pada periode ini.</div>
      ) : visible.length === 0 ? (
        <div className="card text-center text-sm text-slate-500">Tidak ada baris untuk filter ini.</div>
      ) : (
        <>
          {/* Tabel (tablet/laptop) */}
          <div className="table-wrap hidden md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Interviewer</th>
                  <th>Project</th>
                  <th className="text-right">Rekap</th>
                  <th>Data masuk</th>
                  <th className="text-right">Selisih</th>
                  <th>Status</th>
                  <th>Catatan tindak lanjut</th>
                  <th>Sudah TL</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const pv = previewSelisih(r);
                  const dirty = isDirty(r);
                  return (
                    <tr key={r.key} className={r.status === "SELISIH" && !r.followedUp ? "bg-red-50/50" : ""}>
                      <td className="whitespace-nowrap">{formatDateID(r.date)}</td>
                      <td className="whitespace-nowrap">
                        {r.interviewerName}
                        {r.reportId && r.revision ? (
                          <div className="mt-0.5">
                            <RevisionButton reportId={r.reportId} revision={r.revision} />
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div className="font-medium">{r.projectCode}</div>
                        <div className="text-xs text-slate-500">{r.projectName}</div>
                        {!r.hasReportItem && <div className="text-xs text-amber-700">Tidak ada di rekap</div>}
                      </td>
                      <td className="text-right font-medium tabular-nums">{r.rekap}</td>
                      <td>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          className="input w-24"
                          value={r.draft.actual}
                          placeholder="—"
                          onChange={(e) => setDraft(r.key, { actual: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && dirty && save(r)}
                          aria-label="Data masuk"
                        />
                      </td>
                      <td className={`text-right tabular-nums ${pv.status === "SELISIH" ? "font-semibold text-red-700" : ""}`}>
                        {pv.selisih === null ? "—" : formatSelisih(pv.selisih)}
                      </td>
                      <td className="whitespace-nowrap">
                        <StatusBadge status={pv.status} selisih={pv.selisih} />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="input min-w-[12rem]"
                          value={r.draft.note}
                          maxLength={1000}
                          placeholder="Catatan…"
                          onChange={(e) => setDraft(r.key, { note: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && dirty && save(r)}
                          aria-label="Catatan tindak lanjut"
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={r.draft.followedUp}
                          onChange={(e) => setDraft(r.key, { followedUp: e.target.checked })}
                          aria-label="Sudah ditindaklanjuti"
                        />
                      </td>
                      <td className="whitespace-nowrap">
                        <SaveCell r={r} dirty={dirty} onSave={() => save(r)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Kartu (ponsel) */}
          <div className="space-y-3 md:hidden">
            {visible.map((r) => {
              const pv = previewSelisih(r);
              const dirty = isDirty(r);
              return (
                <div key={r.key} className={`card space-y-2 ${r.status === "SELISIH" && !r.followedUp ? "border-red-200" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {r.interviewerName} · {r.projectCode}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDateID(r.date)} · {r.projectName}
                      </div>
                      {r.reportId && r.revision ? <RevisionButton reportId={r.reportId} revision={r.revision} /> : null}
                    </div>
                    <StatusBadge status={pv.status} selisih={pv.selisih} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Rekap</div>
                      <div className="py-2 font-semibold">{r.rekap}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Data masuk</div>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className="input"
                        value={r.draft.actual}
                        placeholder="—"
                        onChange={(e) => setDraft(r.key, { actual: e.target.value })}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Selisih</div>
                      <div className={`py-2 font-semibold ${pv.status === "SELISIH" ? "text-red-700" : ""}`}>
                        {pv.selisih === null ? "—" : formatSelisih(pv.selisih)}
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    className="input"
                    value={r.draft.note}
                    maxLength={1000}
                    placeholder="Catatan tindak lanjut…"
                    onChange={(e) => setDraft(r.key, { note: e.target.value })}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={r.draft.followedUp} onChange={(e) => setDraft(r.key, { followedUp: e.target.checked })} />
                      Sudah ditindaklanjuti
                    </label>
                    <SaveCell r={r} dirty={dirty} onSave={() => save(r)} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="text-xs text-slate-500">
        Selisih = rekap interviewer − data masuk. Mengosongkan data masuk lalu menyimpan akan menghapus baris pencocokan (beserta catatan &
        tanda tindak lanjut) sehingga statusnya kembali &ldquo;Belum dicocokkan&rdquo;.
      </p>
    </div>
  );
}

function SaveCell({ r, dirty, onSave }: { r: RowState; dirty: boolean; onSave: () => void }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {dirty ? (
        <button type="button" className="btn-primary btn-sm" disabled={r.saving} onClick={onSave}>
          {r.saving ? "Menyimpan…" : "Simpan"}
        </button>
      ) : r.savedFlash ? (
        <span className="text-xs text-emerald-700">Tersimpan ✓</span>
      ) : null}
      {r.error && <span className="max-w-[12rem] text-xs text-red-600">{r.error}</span>}
    </div>
  );
}

function AddForm({
  interviewers,
  projects,
  defaultDate,
  today,
  onAdded,
}: {
  interviewers: { id: number; name: string }[];
  projects: { id: number; code: string; name: string }[];
  defaultDate: string;
  today: string;
  onAdded: (r: MatchingRow) => void;
}) {
  const [iid, setIid] = useState("");
  const [pid, setPid] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [count, setCount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/matching", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewerId: Number(iid), projectId: Number(pid), date, actualCount: count, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan.");
      const it = interviewers.find((i) => i.id === Number(iid))!;
      const pr = projects.find((p) => p.id === Number(pid))!;
      onAdded({
        key: `${it.id}|${pr.id}|${date}`,
        date,
        interviewerId: it.id,
        interviewerName: it.name,
        projectId: pr.id,
        projectCode: pr.code,
        projectName: pr.name,
        reportId: null,
        revision: null,
        area: null,
        rekap: data.rekap,
        hasReportItem: data.hasReportItem,
        matchingId: data.matchingId,
        actualCount: data.actualCount,
        selisih: data.selisih,
        status: data.status,
        note: data.note,
        followedUp: data.followedUp,
      });
      setCount("");
      setNote("");
      setMsg({ ok: true, text: "Data masuk tersimpan." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Gagal menyimpan." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <p className="text-sm text-slate-600">
        Catat data masuk untuk interviewer/project/tanggal yang tidak ada di rekap (rekap dihitung 0). Jika kombinasi sudah ada, angkanya diperbarui.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <select className="input" value={iid} onChange={(e) => setIid(e.target.value)} required aria-label="Interviewer">
          <option value="">Interviewer…</option>
          {interviewers.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
        <select className="input" value={pid} onChange={(e) => setPid(e.target.value)} required aria-label="Project">
          <option value="">Project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
        <input type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} required aria-label="Tanggal" />
        <input type="number" min={0} inputMode="numeric" className="input" placeholder="Data masuk" value={count} onChange={(e) => setCount(e.target.value)} required />
        <input type="text" className="input col-span-2 md:col-span-1" placeholder="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary btn-sm" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
