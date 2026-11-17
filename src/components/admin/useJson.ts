"use client";

/** fetch JSON dengan pesan error berbahasa Indonesia dari API ({error}). */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  } catch {
    throw new Error("Gagal terhubung ke server. Periksa koneksi internet.");
  }
  if (res.status === 401) {
    window.location.href = "/admin/login?next=" + encodeURIComponent(window.location.pathname);
    throw new Error("Sesi berakhir, silakan login kembali.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Terjadi kesalahan di server.");
  return data as T;
}
