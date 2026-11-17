"use client";
// STUB — diimplementasikan penuh oleh pekerjaan Pencocokan/Transport/Export (riwayat revisi rekap).
// Kontrak props: reportId (id Report), revision (Report.revision). Tampilkan hanya jika revision > 1.
export default function RevisionButton({ reportId, revision }: { reportId: number; revision: number }) {
  if (revision <= 1) return null;
  return <span className="badge-yellow" data-report-id={reportId}>Diubah {revision - 1}×</span>;
}
