"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export const ADMIN_TABS = [
  { href: "/admin", label: "Hari Ini" },
  { href: "/admin/riwayat", label: "Riwayat Harian" },
  { href: "/admin/rekap", label: "Rekap Periode" },
  { href: "/admin/pencocokan", label: "Pencocokan" },
  { href: "/admin/transport", label: "Transport PC" },
  { href: "/admin/kelola", label: "Kelola Data" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/admin" className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-brand-700">IMaN</span>
          <span className="hidden text-xs text-slate-500 sm:inline">Interviewer Monitoring at Nutrifood</span>
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={logout} className="btn-secondary btn-sm hidden lg:inline-flex">Keluar</button>
          <button onClick={() => setOpen(!open)} className="btn-secondary btn-sm lg:hidden" aria-label="Menu">☰ Menu</button>
        </div>
      </div>
      <nav className={`mx-auto max-w-7xl px-4 pb-2 ${open ? "block" : "hidden"} lg:block`}>
        <ul className="flex flex-col gap-1 lg:flex-row lg:gap-1">
          {ADMIN_TABS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${isActive(t.href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {t.label}
              </Link>
            </li>
          ))}
          <li className="lg:hidden">
            <button onClick={logout} className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50">Keluar</button>
          </li>
        </ul>
      </nav>
    </header>
  );
}
