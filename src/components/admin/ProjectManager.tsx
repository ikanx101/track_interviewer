"use client";
import { useCallback, useEffect, useState } from "react";
import ExportButtons from "@/components/ExportButtons";
import { formatDateID, todayWIB } from "@/lib/dates";
import { requestJson } from "./useJson";

type Project = {
  id: number;
  code: string;
  name: string;
  target: number;
  startDate: string;
  isPC: boolean;
  status: "BERJALAN" | "SELESAI";
  fromReports: number;
  fromMatching: number;
};

type FormState = { code: string; name: string; target: string; startDate: string; isPC: boolean };
const emptyForm = (): FormState => ({ code: "", name: "", target: "0", startDate: todayWIB(), isPC: false });

export default function ProjectManager() {
  const [list, setList] = useState<Project[] | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState | null>(null); // null = form tertutup
  const [editId, setEditId] = useState<number | null>(null); // null + form = tambah baru
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await requestJson<{ projects: Project[] }>("/api/admin/projects");
      setList(d.projects);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditId(null); setForm(emptyForm()); setFormError(""); setMsg(""); }
  function openEdit(p: Project) {
    setEditId(p.id);
    setForm({ code: p.code, name: p.name, target: String(p.target), startDate: p.startDate, isPC: p.isPC });
    setFormError(""); setMsg("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const target = Number(form.target);
    if (!form.code.trim() || !form.name.trim()) { setFormError("Kode dan nama project wajib diisi."); return; }
    if (!Number.isInteger(target) || target < 0) { setFormError("Target harus bilangan bulat ≥ 0."); return; }
    if (!form.startDate) { setFormError("Tanggal mulai wajib diisi."); return; }
    setBusy(true); setFormError(""); setError("");
    try {
      const body = JSON.stringify({ ...form, target });
      if (editId) await requestJson(`/api/admin/projects/${editId}`, { method: "PATCH", body });
      else await requestJson("/api/admin/projects", { method: "POST", body });
      setMsg(editId ? `Project ${form.code.trim()} diperbarui.` : `Project ${form.code.trim()} ditambahkan.`);
      setForm(null); setEditId(null);
      await load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(p: Project) {
    const next = p.status === "BERJALAN" ? "SELESAI" : "BERJALAN";
    if (next === "SELESAI" && !confirm(`Tandai ${p.code} sebagai Selesai? Project tidak akan muncul lagi di form pengisian interviewer.`)) return;
    setBusy(true); setError(""); setMsg("");
    try {
      await requestJson(`/api/admin/projects/${p.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      setMsg(`${p.code} ditandai ${next === "SELESAI" ? "Selesai" : "Masih berjalan"}.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <section className="card space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Project</h2>
          {list && <p className="text-xs text-slate-500">{list.filter((p) => p.status === "BERJALAN").length} masih berjalan · {list.filter((p) => p.status === "SELESAI").length} selesai</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButtons dataset="project" />
          {!form && <button className="btn-primary btn-sm" onClick={openAdd}>+ Tambah project</button>}
        </div>
      </div>

      {form && (
        <form onSubmit={save} className="space-y-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
          <h3 className="text-sm font-semibold text-slate-800">{editId ? "Ubah project" : "Project baru"}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label" htmlFor="pj-code">Kode</label>
              <input id="pj-code" className="input" value={form.code} onChange={(e) => set("code", e.target.value)} maxLength={50} required />
            </div>
            <div className="lg:col-span-2">
              <label className="label" htmlFor="pj-name">Nama project</label>
              <input id="pj-name" className="input" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={200} required />
            </div>
            <div>
              <label className="label" htmlFor="pj-target">Target (responden)</label>
              <input id="pj-target" type="number" inputMode="numeric" min={0} step={1} className="input" value={form.target} onChange={(e) => set("target", e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="pj-start">Tanggal mulai</label>
              <input id="pj-start" type="date" className="input" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} required />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:mt-6">
              <input type="checkbox" checked={form.isPC} onChange={(e) => set("isPC", e.target.checked)} />
              Project PC <span className="text-xs text-slate-500">(wajib isi transport)</span>
            </label>
          </div>
          {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{formError}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</button>
            <button type="button" className="btn-secondary" onClick={() => { setForm(null); setEditId(null); }}>Batal</button>
          </div>
        </form>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      {msg && !error && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}

      {list === null ? (
        <p className="text-sm text-slate-500">Memuat…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada project. Tambahkan project yang sedang berjalan.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama</th>
                <th className="text-right">Target</th>
                <th className="text-right">Rekap / Data masuk</th>
                <th>Mulai</th>
                <th>PC</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={p.status === "SELESAI" ? "text-slate-500" : ""}>
                  <td className="whitespace-nowrap font-semibold">{p.code}</td>
                  <td className="min-w-[10rem]">{p.name}</td>
                  <td className="text-right tabular-nums">{p.target.toLocaleString("id-ID")}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">{p.fromReports.toLocaleString("id-ID")} / {p.fromMatching.toLocaleString("id-ID")}</td>
                  <td className="whitespace-nowrap">{formatDateID(p.startDate, false)}</td>
                  <td>{p.isPC ? <span className="badge-blue">PC</span> : "-"}</td>
                  <td>{p.status === "BERJALAN" ? <span className="badge-green">Masih berjalan</span> : <span className="badge-gray">Selesai</span>}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn-secondary btn-sm" disabled={busy} onClick={() => openEdit(p)}>Ubah</button>
                      <button className="btn-secondary btn-sm whitespace-nowrap" disabled={busy} onClick={() => toggleStatus(p)}>
                        {p.status === "BERJALAN" ? "Tandai selesai" : "Buka kembali"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
