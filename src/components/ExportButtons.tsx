"use client";

/**
 * Tombol unduh. CSV = data sesuai tab ini (`dataset`); XLSX = semua sheet untuk periode/filter yang sama.
 * Endpoint: GET /api/admin/export?format=csv|xlsx&dataset=...&from=...&to=...&interviewerId=...
 */
export default function ExportButtons({
  dataset,
  params = {},
}: {
  dataset: "harian" | "rekap" | "pencocokan" | "transport" | "interviewer" | "project" | "hari-ini";
  params?: Record<string, string | number | undefined | null>;
}) {
  const qs = (format: string) => {
    const sp = new URLSearchParams({ format, dataset });
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
    return `/api/admin/export?${sp.toString()}`;
  };
  return (
    <div className="flex gap-2">
      <a href={qs("csv")} className="btn-secondary btn-sm">⬇ CSV</a>
      <a href={qs("xlsx")} className="btn-secondary btn-sm">⬇ XLSX</a>
    </div>
  );
}
