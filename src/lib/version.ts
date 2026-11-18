// Sumber tunggal versi & log revisi aplikasi.
// Saat rilis baru: tambahkan entri di PALING ATAS, samakan "version" di package.json,
// dan perbarui bagian "Log Revisi Versi" di README.md.

export type ChangelogEntry = {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  changes: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "2026-11-18",
    title: "Versi & log revisi di aplikasi",
    changes: [
      "Nomor versi aplikasi tampil di form interviewer dan di header dashboard admin.",
      "Halaman Log Revisi (/versi) berisi riwayat perubahan setiap versi.",
    ],
  },
  {
    version: "1.0.1",
    date: "2026-11-18",
    title: "Keamanan login",
    changes: [
      "Menghapus password admin cadangan yang dipakai bila ADMIN_PASSWORD kosong; login kini ditolak dengan pesan jelas sampai ADMIN_PASSWORD diatur.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-11-17",
    title: "Rilis pertama",
    changes: [
      "Form rekap akhir hari interviewer tanpa login, mobile-first: pilih nama (diingat di perangkat), tanggal (hari ini s.d. 7 hari ke belakang, WIB), perolehan & area per project, jam kerja, area lain, catatan, transport PC.",
      "Perbaikan rekap dengan form terisi otomatis; versi lama disimpan sebagai riwayat; transport terkunci setelah Disetujui/Dibayar.",
      "Saran otomatis (autocomplete) area dari isian sebelumnya.",
      "Dashboard Admin Field dengan login password (sesi 12 jam): Hari Ini, Riwayat Harian, Rekap Periode, Pencocokan, Transport PC, Kelola Data.",
      "Pencocokan data masuk dengan penandaan selisih, status \"Belum dicocokkan\", catatan & status tindak lanjut.",
      "Progres project terhadap target (versi rekap & versi data masuk).",
      "Manajemen interviewer (tambah, ubah nama, nonaktif/aktif) dan project (kode, nama, target, tanggal mulai, Project PC, status).",
      "Unduh CSV (per tab) dan XLSX (6 sheet).",
      "Deploy dengan Docker (start.sh/stop.sh, port 1526) dan Railway.",
    ],
  },
];

export const APP_VERSION = CHANGELOG[0].version;
