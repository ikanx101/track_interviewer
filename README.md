# IMaN — Interviewer Monitoring at Nutrifood

**IMaN** adalah webapp untuk memantau kehadiran dan perolehan responden setiap interviewer yang mengerjakan beberapa project riset sekaligus. Interviewer mengirim rekap akhir hari dari HP, dan Admin Field memantau, mencocokkan, serta mengelola transport dari dashboard. Semua data disimpan permanen di PostgreSQL.

- **Form Interviewer**: `http://<host>:1526/` (tanpa login)
- **Dashboard Admin Field**: `http://<host>:1526/admin` (login dengan password)
- **Health check**: `http://<host>:1526/api/health` → `{"status":"ok"}`

Versi saat ini: **v1.0.0** (17 November 2026)

---

## Daftar Isi

1. [Fitur per Peran](#1-fitur-per-peran)
2. [Teknologi](#2-teknologi)
3. [Arsitektur & Struktur Folder](#3-arsitektur--struktur-folder)
4. [Model Data](#4-model-data)
5. [Definisi Metrik](#5-definisi-metrik)
6. [Menjalankan dengan Docker](#6-menjalankan-dengan-docker)
7. [Deploy ke Railway](#7-deploy-ke-railway)
8. [Pengembangan Lokal](#8-pengembangan-lokal)
9. [Panduan Pengguna — Admin Field](#9-panduan-pengguna--admin-field)
10. [Panduan Pengguna — Interviewer](#10-panduan-pengguna--interviewer)
11. [Backup & Restore](#11-backup--restore)
12. [Catatan Keamanan](#12-catatan-keamanan)
13. [FAQ & Troubleshooting](#13-faq--troubleshooting)
14. [Perjalanan Pembuatan](#14-perjalanan-pembuatan)
15. [Log Revisi Versi](#15-log-revisi-versi)

---

## 1. Fitur per Peran

### Admin Field (`ADMIN_FIELD`)
- Login dashboard dengan satu password bersama (`ADMIN_PASSWORD`), sesi berlaku 12 jam.
- **Hari Ini**: siapa yang sudah/belum mengirim rekap, perolehan & area per project, total, transport, catatan, progres project terhadap target.
- **Riwayat Harian**: hari apa setiap interviewer turun, ke area mana, dan berapa perolehannya per project (filter periode & interviewer).
- **Rekap Periode**: rentang tanggal bebas + pintasan *Minggu ini*, *Bulan ini*, *Bulan lalu*.
- **Pencocokan**: mengisi angka data masuk per interviewer per project per tanggal; sistem menandai selisih, plus catatan tindak lanjut dan status "Sudah ditindaklanjuti".
- **Transport PC**: mengubah status pembayaran transport (Diajukan → Disetujui → Dibayar).
- **Kelola Data**: tambah/ubah nama/nonaktifkan/aktifkan kembali interviewer; tambah/ubah project (kode, nama, target, tanggal mulai, tanda *Project PC*, status Masih berjalan/Selesai).
- Melihat jumlah revisi rekap dan isi versi sebelumnya (audit log).
- Unduh data: **XLSX** (sheet Rekap Harian, Rekap Periode, Pencocokan, Transport, Interviewer, Project) dan **CSV** (sesuai tab yang sedang dibuka).
- Admin **tidak** dapat menghapus rekap dan tidak mengisi rekap atas nama interviewer.

### Interviewer (`INTERVIEWER`)
- Membuka link tanpa login, memilih nama dari daftar interviewer aktif (nama diingat di perangkat).
- Mengirim rekap akhir hari untuk hari ini atau hingga 7 hari ke belakang (WIB).
- Mengisi per project: jumlah responden selesai + area (wajib jika jumlah > 0), jam mulai/selesai, area lain, catatan, serta transport PC (wajib jika ada perolehan project PC; isi 0 bila tidak ada biaya).
- Memperbaiki rekap yang sudah dikirim (form terisi otomatis); rekap lama ditimpa, versi sebelumnya disimpan di riwayat.
- Hanya melihat project berstatus *Masih berjalan* (kecuali project Selesai yang sudah punya perolehan di tanggal yang diperbaiki).

---

## 2. Teknologi

| Lapisan | Teknologi |
|---|---|
| Framework | Next.js 15.5 (App Router) — frontend + API dalam satu aplikasi, output `standalone` |
| Bahasa | TypeScript, React 19 |
| Database | PostgreSQL 16 |
| ORM | Prisma 6.16 (migrasi di `prisma/migrations`) |
| UI | Tailwind CSS 3, desain mobile-first responsif, Bahasa Indonesia |
| Autentikasi admin | Cookie HTTP-only bertanda tangan (JWT HS256 via `jose`) |
| Ekspor | `exceljs` (XLSX) + CSV |
| Deploy | Docker / Docker Compose, Railway |

---

## 3. Arsitektur & Struktur Folder

```
Browser HP (Interviewer) ──► /            ─┐
Browser Laptop (Admin)   ──► /admin/*     ─┼─► Next.js (server.js, port 1526) ──► Prisma ──► PostgreSQL
                             /api/public/* │      middleware: lindungi /admin/* & /api/admin/*
                             /api/admin/*  ─┘
```

```
.
├── prisma/
│   ├── schema.prisma          # model data
│   ├── migrations/            # migrasi SQL (dijalankan otomatis saat container start)
│   └── seed.mjs               # seed 7 interviewer awal (hanya jika tabel kosong)
├── src/
│   ├── app/
│   │   ├── page.tsx           # "/"  — form rekap interviewer
│   │   ├── admin/
│   │   │   ├── login/         # "/admin/login"
│   │   │   └── (dash)/        # "/admin", "/admin/riwayat", "/admin/rekap",
│   │   │                      # "/admin/pencocokan", "/admin/transport", "/admin/kelola"
│   │   └── api/
│   │       ├── health/        # GET /api/health
│   │       ├── public/        # API tanpa login untuk form interviewer
│   │       └── admin/         # API dashboard (butuh sesi admin) + ekspor
│   ├── components/            # komponen UI (AdminNav, ExportButtons, form interviewer, dsb.)
│   ├── lib/                   # db, auth, tanggal WIB, logika rekap, pencocokan, ekspor
│   └── middleware.ts          # proteksi rute admin
├── Dockerfile                 # image multi-stage node:22-alpine
├── docker-entrypoint.sh       # migrate deploy → seed → node server.js
├── scripts/copy-runtime-deps.mjs  # melengkapi dependensi exceljs di image standalone
├── docker-compose.yml         # service app + db (PostgreSQL 16)
├── start.sh / stop.sh         # skrip menjalankan/menghentikan via Docker
├── railway.json               # konfigurasi deploy Railway
└── requirement.md             # requirement & keputusan klarifikasi
```

**Rute utama**

| Rute | Keterangan |
|---|---|
| `/` | Form rekap interviewer (tanpa login) |
| `/admin/login` | Login Admin Field |
| `/admin` | Tab **Hari Ini** |
| `/admin/riwayat` | Tab **Riwayat Harian** |
| `/admin/rekap` | Tab **Rekap Periode** |
| `/admin/pencocokan` | Tab **Pencocokan** |
| `/admin/transport` | Tab **Transport PC** |
| `/admin/kelola` | Tab **Kelola Data** |
| `/versi` | Halaman **Log Revisi** (versi aplikasi & riwayat perubahan) |
| `/api/health` | Health check (cek koneksi database) |
| `/api/public/*` | API form interviewer (daftar interviewer aktif, project, area, rekap) |
| `/api/admin/*` | API dashboard & ekspor (butuh login) |

---

## 4. Model Data

| Tabel | Isi | Kunci unik |
|---|---|---|
| `Interviewer` | nama, status aktif | `name` |
| `Project` | kode, nama, target total, tanggal mulai, `isPC`, status `BERJALAN`/`SELESAI` | `code` |
| `Report` | rekap akhir hari: jam mulai/selesai, area lain, catatan, nominal & keterangan transport, status transport (`DIAJUKAN`/`DISETUJUI`/`DIBAYAR`), nomor revisi | (`interviewerId`, `date`) — satu rekap per interviewer per tanggal |
| `ReportItem` | perolehan per project dalam satu rekap: jumlah + area | (`reportId`, `projectId`) |
| `ReportHistory` | snapshot JSON versi rekap sebelumnya (audit log) | — |
| `Matching` | angka data masuk dari Admin Field, catatan tindak lanjut, status sudah ditindaklanjuti | (`interviewerId`, `projectId`, `date`) |

Tanggal bisnis disimpan sebagai kolom `DATE` dan dihitung menurut zona **WIB (Asia/Jakarta)**.

---

## 5. Definisi Metrik

- **Perolehan** = jumlah responden berstatus *selesai* **pada tanggal itu saja** (harian), per project. Bukan angka kumulatif, bukan perolehan sejak rekap sebelumnya.
- **Transport PC** = **satu** nominal per interviewer per hari, diisi hanya pada hari yang memiliki perolehan di project bertanda **Project PC** (checkbox yang ditandai Admin Field, bukan berdasarkan teks kode). Rekap baru dengan transport otomatis berstatus *Diajukan*; bila sudah *Disetujui*/*Dibayar*, nominal & keterangan terkunci untuk interviewer.
- **Selisih** = perolehan menurut rekap interviewer − angka data masuk yang diisi Admin Field (per interviewer, per project, per tanggal).
  - Selisih ≠ 0 → ditandai **merah** (tanpa toleransi).
  - Rekap ada tetapi data masuk belum diisi → **"Belum dicocokkan"** (bukan selisih).
- **Progres project** ditampilkan dua versi: berdasarkan rekap interviewer dan berdasarkan data masuk, terhadap target total project.

---

## 6. Menjalankan dengan Docker

### Prasyarat
- Docker Desktop (macOS/Windows) atau Docker Engine + Compose v2 (Linux).
- `curl` (untuk menunggu health check di `start.sh`).

### Menjalankan

```bash
git clone <url-repo> iman && cd iman
bash start.sh
```

Cukup satu perintah itu: PostgreSQL, migrasi database, data awal, dan aplikasi semuanya ikut berjalan.

Yang dilakukan `start.sh`:
1. Memeriksa Docker & Docker Compose (di macOS, Docker Desktop dinyalakan otomatis bila belum berjalan) dan memastikan port 1526 belum dipakai program lain.
2. Menyiapkan `.env`: dibuat dari `.env.example` bila belum ada, dan variabel yang belum terisi (`SESSION_SECRET`, `POSTGRES_PASSWORD`) dilengkapi otomatis dengan nilai acak.
3. **Menanyakan password Admin Field** di terminal (input tersembunyi, diketik dua kali):
   - minimal 6 karakter, tanpa spasi, tanda kutip, `$`, `\` atau backtick;
   - tekan **ENTER** untuk tetap memakai password yang sekarang (atau, saat pertama kali, membuat password acak yang ditampilkan di layar);
   - password disimpan di `.env` (`ADMIN_PASSWORD`) dan langsung berlaku.
   - Tanpa prompt (otomatisasi): `IMAN_ADMIN_PASSWORD=PasswordKu123 bash start.sh`.
4. `docker compose up -d --build` → membangun image, menjalankan PostgreSQL + aplikasi.
5. Saat container aplikasi start: `prisma migrate deploy` → seed 7 interviewer awal (Dwiki, Ingrid, Kodirin, Maria, Merry, Suharyuni, Yani; hanya jika tabel masih kosong) → server.
6. Menunggu `/api/health` siap, lalu menampilkan (bila gagal, log terakhir langsung ditampilkan):
   - Form Interviewer: **http://localhost:1526**
   - Dashboard Admin: **http://localhost:1526/admin**

Opsi lain:

```bash
./start.sh --no-build      # jalankan tanpa build ulang image
./start.sh --external-db   # hanya container app, pakai DATABASE_URL di .env
./start.sh --internal-db   # paksa pakai PostgreSQL bawaan walau DATABASE_URL diisi
```

### Menghentikan

```bash
./stop.sh                # hentikan container; data tetap aman di volume Docker
./stop.sh --hapus-data   # hentikan + HAPUS volume database (minta konfirmasi ketik HAPUS)
```

### Variabel `.env`

| Variabel | Wajib | Default | Keterangan |
|---|---|---|---|
| `ADMIN_PASSWORD` | Ya | ditanyakan oleh `start.sh` | Password login dashboard Admin Field |
| `SESSION_SECRET` | Ya | dibuat acak oleh `start.sh` | Secret penandatangan cookie sesi (≥ 32 karakter acak). Mengganti nilai ini membuat semua sesi admin logout |
| `POSTGRES_PASSWORD` | Tidak | dibuat acak oleh `start.sh` | Password PostgreSQL bawaan (hanya berlaku saat volume pertama kali dibuat) |
| `POSTGRES_USER` / `POSTGRES_DB` | Tidak | `iman` / `iman` | User & nama database bawaan |
| `DATABASE_URL` | Tidak | database bawaan (`db:5432`) | Isi dengan URL PostgreSQL **eksternal** untuk memakai database di luar Docker Compose |
| `APP_PORT` | Tidak | `1526` | Port di komputer host |
| `COOKIE_SECURE` | Tidak | `false` | Set `true` jika diakses lewat HTTPS (mis. di belakang reverse proxy) |

> Catatan: `.env.example` berisi `DATABASE_URL` ke `localhost` untuk pengembangan lokal. `start.sh` **mengabaikan** `DATABASE_URL` yang menunjuk ke `localhost`/`127.0.0.1` dan memakai PostgreSQL bawaan, karena dari dalam container `localhost` bukan komputer host.

### Memakai Database Eksternal

1. Isi `DATABASE_URL` di `.env`, contoh:
   ```env
   DATABASE_URL="postgresql://user:pass@db.example.com:5432/iman?schema=public"
   ```
   Untuk PostgreSQL yang berjalan di komputer host, gunakan `host.docker.internal` sebagai host.
2. Jalankan:
   ```bash
   ./start.sh --external-db
   # setara dengan: docker compose up -d --build --no-deps app
   ```
   (Jika `DATABASE_URL` diisi dengan host selain localhost, `start.sh` otomatis memakai mode eksternal.)
3. Migrasi & seed dijalankan otomatis ke database eksternal tersebut.

### Perintah Docker berguna

```bash
docker compose ps                 # status container
docker compose logs -f app        # log aplikasi
docker compose exec db psql -U iman iman   # masuk ke PostgreSQL bawaan
docker compose up -d --build app  # build ulang setelah update kode
```

---

## 7. Deploy ke Railway

Repo ini sudah berisi `railway.json` (builder **Dockerfile**, health check `/api/health`, restart otomatis saat gagal). Aplikasi membaca variabel `PORT` dari Railway secara otomatis (default 1526).

### Langkah-langkah

1. **Push repo ke GitHub** (repo privat juga bisa).
2. Buka [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** → pilih repo IMaN. Railway akan mendeteksi `railway.json` dan membangun dari `Dockerfile`.
3. **Tambahkan PostgreSQL**: di kanvas project klik **+ Create** (atau **New**) → **Database** → **Add PostgreSQL**. Railway membuat service bernama `Postgres`.
4. **Atur variabel** pada service aplikasi (tab **Variables** → *Raw Editor*):
   ```env
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ADMIN_PASSWORD=<password-admin-yang-kuat>
   SESSION_SECRET=<string-acak-minimal-32-karakter>
   COOKIE_SECURE=true
   ```
   - `${{Postgres.DATABASE_URL}}` adalah referensi variabel Railway; sesuaikan `Postgres` jika nama service database berbeda.
   - Buat `SESSION_SECRET` misalnya dengan `openssl rand -hex 32`.
   - **Jangan** mengatur `PORT` secara manual; Railway mengisinya sendiri.
5. Simpan → Railway melakukan deploy ulang. Saat start, container menjalankan `prisma migrate deploy` dan seed interviewer awal secara otomatis.
6. **Buat domain publik**: service aplikasi → **Settings** → **Networking** → **Generate Domain**. Railway memberi URL seperti `https://iman-production.up.railway.app`.
7. **Bagikan link**:
   - Interviewer (via WhatsApp/Telegram grup tim): `https://<domain>/`
   - Admin Field: `https://<domain>/admin`
8. Cek `https://<domain>/api/health` → harus `{"status":"ok"}`.

### Update aplikasi
Setiap push ke branch yang terhubung (mis. `main`) otomatis memicu build & deploy ulang. Migrasi baru dijalankan otomatis saat container start.

### Troubleshooting Railway
| Gejala | Penyebab & solusi |
|---|---|
| Deploy gagal di health check | Lihat **Deploy Logs**. Biasanya `DATABASE_URL` belum diatur/salah referensi. Pastikan `${{Postgres.DATABASE_URL}}` dan service Postgres sudah *running* |
| Log: `migrasi gagal setelah 30 percobaan` | Database tidak bisa dijangkau. Cek nama service di referensi variabel dan status plugin Postgres |
| Login admin berhasil tapi langsung kembali ke halaman login | `COOKIE_SECURE=true` tetapi diakses lewat `http://`. Gunakan domain `https://` dari Railway |
| "Application failed to respond" | Jangan set `PORT` manual; jangan ubah start command. Pastikan builder = Dockerfile |
| Password admin lupa | Ganti `ADMIN_PASSWORD` di tab Variables → deploy ulang otomatis |

---

## 8. Pengembangan Lokal

Prasyarat: Node.js 22, npm, PostgreSQL (lokal atau via Docker).

```bash
# 1. Dependensi (field "allowScripts" di package.json sudah mengizinkan
#    install script Prisma yang diblokir npm 11, jadi tidak perlu approve manual)
npm install

# 2. Siapkan PostgreSQL, contoh via Docker:
docker run -d --name iman-pg -e POSTGRES_USER=iman -e POSTGRES_PASSWORD=iman_password \
  -e POSTGRES_DB=iman -p 5432:5432 postgres:16-alpine

# 3. Konfigurasi
cp .env.example .env        # sesuaikan DATABASE_URL, ADMIN_PASSWORD, SESSION_SECRET

# 4. Migrasi & seed
npx prisma migrate dev      # membuat tabel + generate Prisma Client
npm run db:seed             # 7 interviewer awal (hanya jika tabel kosong)

# 5. Jalankan dev server
npm run dev                 # http://localhost:1526
```

Script npm lain:

| Script | Fungsi |
|---|---|
| `npm run build` | `prisma generate && next build` |
| `npm run start` | Menjalankan hasil build (port `$PORT`, default 1526) |
| `npm run db:deploy` | `prisma migrate deploy` (produksi) |
| `npm run db:seed` | Seed interviewer awal |
| `npx tsc --noEmit` | Pemeriksaan tipe TypeScript |

Mengubah skema: edit `prisma/schema.prisma` → `npx prisma migrate dev --name <nama-perubahan>` → commit folder migrasi baru.

---

## 9. Panduan Pengguna — Admin Field

1. Buka `/admin`, masukkan password (`ADMIN_PASSWORD`). Sesi berlaku 12 jam; klik **Keluar** untuk logout.
2. **Kelola Data** (`/admin/kelola`) — lakukan pertama kali:
   - Pastikan daftar interviewer aktif. Tambah interviewer baru, ubah nama, **Nonaktifkan** (riwayat tetap tersimpan, nama hilang dari form) atau **Aktifkan kembali**.
   - Tambah project: **kode**, **nama**, **target** total, **tanggal mulai**, centang **Project PC** jika transport berlaku. Ubah status ke **Selesai** saat target tercapai/project ditutup (project hilang dari form interviewer).
3. Bagikan link form (`/`) ke grup interviewer.
4. **Hari Ini** (`/admin`): siapa yang sudah/belum kirim rekap, perolehan & area per project, total, transport, catatan, progres project (versi rekap & versi data masuk). Tombol riwayat revisi menampilkan isi versi sebelumnya bila rekap pernah diperbaiki.
5. **Riwayat Harian** (`/admin/riwayat`): filter periode & interviewer untuk melihat hari turun lapangan, area, dan perolehan per project.
6. **Rekap Periode** (`/admin/rekap`): pilih rentang bebas atau pintasan *Minggu ini / Bulan ini / Bulan lalu*; total per interviewer & per project.
7. **Pencocokan** (`/admin/pencocokan`): isi **angka data masuk** per interviewer/project/tanggal. Baris dengan selisih ≠ 0 berwarna merah; yang belum diisi berstatus *Belum dicocokkan*. Tulis catatan tindak lanjut dan centang **Sudah ditindaklanjuti** setelah dikonfirmasi ke interviewer.
8. **Transport PC** (`/admin/transport`): ubah status **Diajukan → Disetujui → Dibayar**. Setelah Disetujui/Dibayar, interviewer tidak bisa lagi mengubah nominalnya.
9. **Unduh data**: tombol **CSV** (data tab yang sedang dibuka) dan **XLSX** (semua sheet: Rekap Harian, Rekap Periode, Pencocokan, Transport, Interviewer, Project). Unduh berkala sebagai cadangan.

## 10. Panduan Pengguna — Interviewer

**Rekap akhir hari (dari HP):**
1. Buka link yang dibagikan admin (tanpa login). Tips: *Tambahkan ke Layar Utama* agar mudah dibuka.
2. Pilih **nama** Anda (akan diingat di HP untuk kunjungan berikutnya).
3. Pilih **tanggal** turun lapangan (default hari ini; bisa mundur hingga 7 hari).
4. Untuk setiap project yang dikerjakan hari itu: isi **jumlah responden selesai hari ini saja** dan **area** yang didatangi. Kosongkan project yang tidak dikerjakan.
5. Opsional: jam mulai/selesai, area lain yang didatangi tapi belum dapat responden, catatan/kendala.
6. Jika ada perolehan di project PC: isi **nominal transport** dan keterangannya (isi **0** jika tidak ada biaya).
7. Tekan **Kirim rekap** dan tunggu konfirmasi. Butuh koneksi internet saat menekan Kirim.
8. Belum dapat responden sama sekali? Tetap kirim rekap dengan mengisi area lain atau catatan.

**Perbaikan rekap:**
1. Buka link, pilih nama, lalu pilih tanggal yang ingin diperbaiki (hari ini s.d. 7 hari ke belakang).
2. Form terisi otomatis dengan rekap yang sudah dikirim. Ubah yang salah, tekan **Perbarui rekap**.
3. Rekap lama ditimpa (tidak ada data ganda); versi lama tetap tersimpan untuk admin. Transport yang sudah Disetujui/Dibayar tidak dapat diubah.

---

## 11. Backup & Restore

Backup otomatis belum termasuk v1.0; lakukan backup manual secara berkala (selain unduhan XLSX dari dashboard).

### Docker Compose (database bawaan)

```bash
# Backup
mkdir -p backups
docker compose exec -T db pg_dump -U iman -d iman --clean --if-exists \
  | gzip > backups/iman-$(date +%F).sql.gz

# Restore (menimpa isi database saat ini)
gunzip -c backups/iman-2026-11-17.sql.gz | docker compose exec -T db psql -U iman -d iman
docker compose restart app
```

> Sesuaikan `-U`/`-d` jika `POSTGRES_USER`/`POSTGRES_DB` diubah. Contoh cron harian (Linux/macOS):
> `0 22 * * * cd /path/iman && docker compose exec -T db pg_dump -U iman -d iman | gzip > backups/iman-$(date +\%F).sql.gz`

### Railway

1. Service **Postgres** → tab **Variables** → salin `DATABASE_PUBLIC_URL` (koneksi dari luar Railway).
2. Backup dari komputer Anda (butuh `pg_dump` versi ≥ server, atau pakai container):
   ```bash
   docker run --rm postgres:16-alpine pg_dump "<DATABASE_PUBLIC_URL>" --clean --if-exists \
     | gzip > iman-railway-$(date +%F).sql.gz
   ```
3. Restore:
   ```bash
   gunzip -c iman-railway-2026-11-17.sql.gz | docker run --rm -i postgres:16-alpine psql "<DATABASE_PUBLIC_URL>"
   ```
   Lalu *Redeploy* service aplikasi.

Railway juga menyediakan fitur *Backups* pada volume database (tergantung paket) yang dapat diaktifkan di tab **Backups** service Postgres.

---

## 12. Catatan Keamanan

- **Interviewer tidak login.** Sistem tidak memverifikasi bahwa pengisi adalah orang yang namanya dipilih. Bagikan link form **hanya di grup internal tim**.
- **Ganti password admin** dari nilai default; `start.sh` sudah membuatnya acak. Simpan di password manager, jangan dibagikan di grup interviewer.
- `ADMIN_PASSWORD` **wajib** diisi. Tidak ada password bawaan; jika kosong, login dashboard selalu ditolak.
- `SESSION_SECRET` harus acak dan rahasia (≥ 32 karakter). Mengganti nilainya memaksa semua admin login ulang.
- Gunakan HTTPS untuk akses dari internet (Railway sudah HTTPS) dan set `COOKIE_SECURE=true`.
- PostgreSQL bawaan Docker **tidak** di-expose ke host/jaringan secara default.
- Jangan commit file `.env` (sudah ada di `.gitignore`).
- Container berjalan sebagai user non-root.

---

## 13. FAQ & Troubleshooting

**Port 1526 sudah dipakai.** Set `APP_PORT=15260` (misalnya) di `.env`, lalu `./start.sh`. Aplikasi di dalam container tetap di 1526.

**`start.sh`: "Docker daemon tidak berjalan".** Buka Docker Desktop dan tunggu hingga statusnya *running*.

**Aplikasi tidak sehat / tidak merespons.** `docker compose logs -f app`. Pesan `Database belum siap` berarti PostgreSQL belum bisa dijangkau — cek `DATABASE_URL` (mode eksternal) atau `docker compose ps` (mode bawaan).

**Lupa password admin.** Lihat/ubah `ADMIN_PASSWORD` di `.env`, lalu `docker compose up -d app` (Railway: ubah di tab Variables).

**Mengubah `POSTGRES_PASSWORD` setelah volume dibuat tidak berpengaruh.** PostgreSQL hanya membaca nilai ini saat inisialisasi volume pertama. Ubah password lewat `ALTER USER` di psql, atau backup → `./stop.sh --hapus-data` → start ulang → restore.

**Nama interviewer tidak muncul di form.** Pastikan interviewer berstatus aktif di **Kelola Data**.

**Project tidak muncul di form.** Hanya project berstatus *Masih berjalan* yang muncul. Ubah status di **Kelola Data**.

**Interviewer tidak bisa mengisi tanggal lebih dari 7 hari lalu.** Sesuai aturan; batas dihitung menurut WIB.

**Login admin selalu kembali ke halaman login.** Jika diakses via `http://`, pastikan `COOKIE_SECURE` tidak bernilai `true`.

**Seed menambah interviewer lagi setiap restart?** Tidak. Seed hanya berjalan jika tabel interviewer kosong. Untuk melewatinya sama sekali, set `SKIP_SEED=true`.

**Apakah bisa dipakai offline?** Tidak; koneksi internet dibutuhkan saat menekan Kirim.

---

## 14. Perjalanan Pembuatan

1. **Requirement awal** — Kebutuhan ditulis di [`requirement.md`](requirement.md): tujuan memantau kehadiran & perolehan harian interviewer, dua peran (Admin Field & Interviewer), alur kerja, ruang lingkup, serta dua opsi deploy (Docker port 1526 & Railway).
2. **Sesi klarifikasi** — Menghasilkan 16 keputusan tambahan (bagian *Klarifikasi & Keputusan Tambahan v1.0*):
   1. Satu password admin bersama via `ADMIN_PASSWORD`, sesi 12 jam (cookie HTTP-only bertanda tangan, `SESSION_SECRET`).
   2. Selisih = rekap − data masuk; setiap selisih ≠ 0 merah; belum diisi = "Belum dicocokkan"; ada catatan & status tindak lanjut.
   3. Data tidak boleh hilang: rekap ditimpa, versi lama disimpan di tabel riwayat (audit log).
   4. Transport baru = Diajukan; terkunci bila Disetujui/Dibayar.
   5. Penanda project PC lewat checkbox manual.
   6. Target total per project; progres versi rekap & versi data masuk.
   7. Area: teks bebas dengan autocomplete.
   8. Rekap periode: rentang bebas + pintasan Minggu ini / Bulan ini / Bulan lalu.
   9. Zona waktu WIB untuk "hari ini" dan batas 7 hari.
   10. Project Selesai tetap muncul di form perbaikan bila tanggal tersebut punya perolehannya.
   11. Admin dapat mengubah nama interviewer, tidak dapat menghapus rekap.
   12. XLSX multi-sheet; CSV sesuai tab yang dibuka.
   13. Stack: Next.js + Prisma + PostgreSQL + Tailwind, mobile-first.
   14. Docker: `start.sh` menjalankan app + PostgreSQL via docker-compose dengan volume persisten; mendukung `DATABASE_URL` eksternal; port 1526.
   15. Backup otomatis di luar lingkup; panduan `pg_dump` di README.
   16. UI Bahasa Indonesia, tampilan netral/bersih; logo menyusul.
3. **Scaffolding** — Proyek Next.js 15 (App Router, output standalone), skema Prisma + migrasi awal, seed 7 interviewer, autentikasi admin (JWT cookie + middleware), utilitas tanggal WIB, health check, serta komponen bersama (navigasi admin, tombol ekspor, tombol riwayat revisi).
4. **Pembangunan paralel oleh beberapa agen** — Pekerjaan dibagi agar bisa dikerjakan bersamaan tanpa saling bertabrakan:
   - Agen 1: **Form interviewer** (`/`) + API publik (interviewer aktif, project, autocomplete area, simpan/perbarui rekap dengan audit log).
   - Agen 2: **Tab monitoring admin** — Hari Ini, Riwayat Harian, Rekap Periode, Kelola Data.
   - Agen 3: **Pencocokan, Transport PC, dan ekspor** CSV/XLSX.
   - Agen 4: **Deploy & dokumentasi** — Dockerfile, docker-compose, `start.sh`/`stop.sh`, Railway, README ini.
5. **Integrasi & pengujian** — Pemeriksaan tipe (`tsc --noEmit`), build image Docker, uji `docker compose up` penuh (migrasi, seed 7 interviewer, `/api/health`, API daftar interviewer), uji end-to-end alur lengkap pada build produksi (login admin → buat project → kirim & perbaiki rekap → pencocokan → setujui transport → transport terkunci → riwayat revisi → ekspor CSV/XLSX), perbaikan dependensi exceljs di image Docker, lalu penyelarasan antarbagian.

---

## 15. Log Revisi Versi

> Log revisi juga tampil di dalam aplikasi pada halaman **`/versi`** (klik nomor versi di form interviewer atau di header dashboard). Sumber datanya `src/lib/version.ts`. Saat rilis baru, tambahkan entri di paling atas file itu, samakan `version` di `package.json`, lalu perbarui bagian ini.

### v1.1.1 — 2026-11-18 — Satu perintah `bash start.sh`
- `start.sh` menanyakan password Admin Field saat start (ENTER = tetap memakai password lama); mendukung `IMAN_ADMIN_PASSWORD` untuk mode tanpa prompt.
- `start.sh` melengkapi otomatis `.env` yang belum lengkap, menyalakan Docker Desktop (macOS), mengecek port bentrok, dan menampilkan log bila aplikasi gagal start.
- Docker Compose tidak lagi memakai password admin bawaan `admin`.
- Form interviewer: pesan "Periksa kembali isian…" hilang otomatis setelah semua isian merah diperbaiki.

### v1.1.0 — 2026-11-18 — Versi & log revisi di aplikasi
- Nomor versi aplikasi tampil di form interviewer dan di header dashboard admin.
- Halaman Log Revisi (`/versi`) berisi riwayat perubahan setiap versi.

### v1.0.1 — 2026-11-18 — Keamanan login
- Menghapus password admin cadangan (`admin`) yang dipakai bila `ADMIN_PASSWORD` kosong. Kini login ditolak dengan pesan jelas sampai `ADMIN_PASSWORD` diatur.

### v1.0.0 — 2026-11-17 — Rilis pertama
- Form rekap akhir hari interviewer tanpa login, mobile-first: pilih nama (diingat di perangkat), tanggal (hari ini s.d. 7 hari ke belakang, WIB), perolehan & area per project, jam kerja, area lain, catatan, transport PC.
- Perbaikan rekap dengan form terisi otomatis; versi lama disimpan sebagai audit log; transport terkunci setelah Disetujui/Dibayar.
- Autocomplete area dari isian sebelumnya.
- Dashboard Admin Field dengan login password (sesi 12 jam): Hari Ini, Riwayat Harian, Rekap Periode, Pencocokan, Transport PC, Kelola Data.
- Pencocokan data masuk dengan penandaan selisih, status "Belum dicocokkan", catatan & status tindak lanjut.
- Progres project terhadap target (versi rekap & versi data masuk).
- Manajemen interviewer (tambah, ubah nama, nonaktif/aktif) dan project (kode, nama, target, tanggal mulai, Project PC, status).
- Ekspor CSV (per tab) dan XLSX (6 sheet: Rekap Harian, Rekap Periode, Pencocokan, Transport, Interviewer, Project).
- Deploy: Dockerfile multi-stage (node:22-alpine, non-root, health check), docker-compose dengan PostgreSQL 16 + volume persisten, `start.sh`/`stop.sh`, dukungan database eksternal, konfigurasi Railway.
- Migrasi database & seed 7 interviewer awal otomatis saat container start.
