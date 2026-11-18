import Link from "next/link";
import { APP_VERSION, CHANGELOG } from "@/lib/version";
import { formatDateID } from "@/lib/dates";

export const metadata = { title: "Log Revisi — IMaN" };

export default function VersiPage() {
  return (
    <div className="min-h-screen">
      <header className="bg-brand-700 px-4 pb-4 pt-5 text-white">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-100">IMaN · Nutrifood</p>
          <h1 className="text-xl font-semibold">Log Revisi</h1>
          <p className="text-sm text-brand-100">Versi saat ini: v{APP_VERSION}</p>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="flex gap-2 text-sm">
          <Link href="/" className="btn-secondary btn-sm">← Form rekap</Link>
          <Link href="/admin" className="btn-secondary btn-sm">Dashboard admin</Link>
        </div>
        <ol className="space-y-4">
          {CHANGELOG.map((e, i) => (
            <li key={e.version} className="card">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-lg font-semibold text-slate-900">v{e.version}</h2>
                {i === 0 && <span className="badge-green">Terbaru</span>}
                <span className="text-sm text-slate-500">{formatDateID(e.date, false)}</span>
              </div>
              <p className="mt-0.5 font-medium text-slate-700">{e.title}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {e.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
