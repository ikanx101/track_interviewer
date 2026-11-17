"use client";
import { useCallback, useEffect, useState } from "react";
import ExportButtons from "@/components/ExportButtons";
import { formatDateID } from "@/lib/dates";
import { requestJson } from "./useJson";

type Interviewer = { id: number; name: string; active: boolean; reportCount: number; lastReportDate: string | null };

export default function InterviewerManager() {
  const [list, setList] = useState<Interviewer[] | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await requestJson<{ interviewers: Interviewer[] }>("/api/admin/interviewers");
      setList(d.interviewers);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMsg("");
    try {
      await fn();
      setMsg(success);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (await run(() => requestJson("/api/admin/interviewers", { method: "POST", body: JSON.stringify({ name }) }), `Interviewer "${name}" ditambahkan.`)) setNewName("");
  }

  async function rename(id: number) {
    const name = editName.trim();
    if (!name) { setError("Nama interviewer wajib diisi."); return; }
    if (await run(() => requestJson(`/api/admin/interviewers/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }), "Nama interviewer diperbarui.")) setEditId(null);
  }

  function toggle(i: Interviewer) {
    if (i.active && !confirm(`Nonaktifkan ${i.name}? Ia tidak akan muncul di form pengisian, tetapi riwayatnya tetap tersimpan.`)) return;
    run(
      () => requestJson(`/api/admin/interviewers/${i.id}`, { method: "PATCH", body: JSON.stringify({ active: !i.active }) }),
      i.active ? `${i.name} dinonaktifkan.` : `${i.name} diaktifkan kembali.`,
    );
  }

  const shown = (list ?? []).filter((i) => showInactive || i.active);
  const activeCount = (list ?? []).filter((i) => i.active).length;

  return (
    <section className="card space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Interviewer</h2>
          {list && <p className="text-xs text-slate-500">{activeCount} aktif · {list.length - activeCount} nonaktif</p>}
        </div>
        <ExportButtons dataset="interviewer" />
      </div>

      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
        <input className="input sm:max-w-xs" placeholder="Nama interviewer baru" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={100} />
        <button className="btn-primary" disabled={busy || !newName.trim()}>Tambah interviewer</button>
      </form>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      {msg && !error && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Tampilkan yang nonaktif
      </label>

      {list === null ? (
        <p className="text-sm text-slate-500">Memuat…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada interviewer.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {shown.map((i) => (
            <li key={i.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
              {editId === i.id ? (
                <form className="flex flex-1 flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); rename(i.id); }}>
                  <input className="input flex-1 sm:max-w-xs" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus maxLength={100} />
                  <button className="btn-primary btn-sm" disabled={busy}>Simpan</button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setEditId(null)}>Batal</button>
                </form>
              ) : (
                <>
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <span className={`font-medium ${i.active ? "text-slate-900" : "text-slate-400"}`}>{i.name}</span>
                    {i.active ? <span className="badge-green">Aktif</span> : <span className="badge-gray">Nonaktif</span>}
                    <span className="text-xs text-slate-500">
                      {i.reportCount} rekap{i.lastReportDate ? ` · terakhir ${formatDateID(i.lastReportDate, false)}` : ""}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary btn-sm" disabled={busy} onClick={() => { setEditId(i.id); setEditName(i.name); setError(""); }}>Ubah nama</button>
                    <button className={i.active ? "btn-secondary btn-sm text-red-600" : "btn-secondary btn-sm text-emerald-700"} disabled={busy} onClick={() => toggle(i)}>
                      {i.active ? "Nonaktifkan" : "Aktifkan kembali"}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
