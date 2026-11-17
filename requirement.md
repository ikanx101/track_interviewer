# Penjelasan

Pada repository ini, saya minta bantuan kamu membuat webapps bernama "Interviewer Monitoring at Nutrifood" disingkat akronim "IMaN".

## Pendahuluan

Membangun webapps untuk memantau kehadiran dan perolehan responden dari setiap interviewer yang mengerjakan beberapa project riset sekaligus. Data disimpan di database server, sehingga perolehan bisa dipantau dan dicocokkan setiap hari.

### Jenis Pengguna

Webapps digunakan oleh dua jenis pengguna:

•	Admin Field: mengelola daftar interviewer dan project, memantau dashboard, mencocokkan data, dan mengelola pembayaran transport.
•	Interviewer: mengisi rekap perolehan di akhir hari dari gadget (mobile)

### Tampilan dan UI

Webapps ini harus bisa adaptif dengan layar pengguna. Sehingga bisa digunakan di layar lebar seperti laptop, PC, dan tablet. Serta juga bisa digunakan menggunakan layar kecil seperti di smartphone.

### Tujuan

Tujuan utama:
• Mengetahui setiap hari siapa (interview mana) yang turun ke lapangan, ke area mana, dan mengerjakan project apa.
• Mencatat perolehan responden per interviewer per project per hari secara tertulis, bukan berdasarkan ingatan.
• Mendeteksi selisih antara rekap interviewer dan data yang benar-benar masuk pada hari yang sama, bukan berminggu-minggu kemudian.
• Mencatat nominal transport project survey beserta status pembayarannya.
• Menyediakan dashboard dan data tabular yang bisa diunduh juga untuk Admin Field.
• Menegaskan definisi metrik:
 - Perolehan = jumlah responden berstatus selesai pada tanggal itu saja (daily), per project. Bukan angka kumulatif dan bukan perolehan sejak rekap sebelumnya.
 - Transport project survey = satu nominal per interviewer per hari, diisi hanya pada hari yang ada perolehan project berkode "PC".

## Ruang Lingkup

Termasuk dalam lingkup:

•	Link pengisian interviewer yang dibuka di browser tanpa login; interviewer memilih namanya dari daftar.
•	Login dashboard Admin Field dengan PIN atau password.
•	Manajemen daftar interviewer oleh Admin Field (tambah, nonaktifkan, aktifkan kembali).
•	Manajemen daftar project oleh Admin Field (tambah, ubah kode/nama/target/tanggal mulai, tandai project PC, ubah status Masih berjalan/Selesai).
•	Form rekap akhir hari: perolehan dan area per project, jam kerja, area lain, catatan, dan transport PC.
•	Perbaikan rekap oleh interviewer hingga 7 hari ke belakang.
•	Penyimpanan data permanen di database server.
•	Dashboard Admin Field: Hari Ini, Riwayat Harian, Rekap per periode, Pencocokan, Transport PC, Kelola Data.
•	Unduh data tabular (CSV & XLSX) sebagai cadangan dan untuk analisis lanjutan.

Di luar lingkup (versi ini):

•	Aplikasi native Android/iOS.
•	Akun dan login per interviewer.
•	Pencatatan per responden (ID responden, status per responden); yang dicatat hanya total per project per hari.
•	Koordinat GPS otomatis; lokasi diisi manual sebagai nama area.
•	Antrean offline di perangkat; pengisian membutuhkan koneksi internet saat menekan Kirim.
•	Integrasi otomatis dengan aplikasi survei atau data klien; angka data masuk untuk pencocokan diisi manual oleh Admin Field.
•	Perhitungan honor interviewer dan proses transfer pembayaran.
•	Dashboard di dalam claude.ai; dashboard dihosting di server yang sama dengan form interviewer.

## Peran & Hak Akses (RBAC)

Dua peran: ADMIN_FIELD dan INTERVIEWER.

### ADMIN_FIELD

•	Masuk ke dashboard dengan PIN atau password.
•	Menambah interviewer baru, menonaktifkan, dan mengaktifkan kembali interviewer. Riwayat interviewer nonaktif tetap tersimpan.
•	Menambah project, mengubah kode, nama, target, dan tanggal mulai, menandai project PC, serta mengubah status Masih berjalan/Selesai.
•	Melihat seluruh rekap semua interviewer: Hari Ini, Riwayat Harian, Rekap per periode, dan progres project terhadap target.
•	Mengisi angka data masuk per interviewer per project per tanggal untuk pencocokan.
•	Mengubah status pembayaran transport (Diajukan, Disetujui, Dibayar).
•	Mengunduh data tabular (CSV & XLSX).
•	Tidak mengisi rekap atas nama interviewer.

### INTERVIEWER

•	Membuka link pengisian tanpa login dan memilih namanya dari daftar interviewer aktif.
•	Mengirim rekap akhir hari untuk tanggal hari ini atau hingga 7 hari ke belakang.
•	Melihat dan memperbarui rekap yang sudah ia kirim untuk tanggal yang sama.
•	Hanya melihat project berstatus Masih berjalan.
•	Tidak dapat membuka dashboard, melihat rekap interviewer lain, mengubah daftar interviewer/project, atau mengunduh data.

Catatan: karena interviewer tidak login, sistem tidak memverifikasi bahwa yang mengisi adalah orang yang namanya dipilih. Link pengisian hanya dibagikan di dalam tim.

# Alur Kerja

## Admin Field

1.	Membuka link dashboard dan masuk dengan PIN atau password.
2.	Membuka menu Kelola Data:
    o	Memastikan daftar interviewer aktif (awal: Dwiki, Ingrid, Kodirin, Maria, Merry, Suharyuni, Yani).
    o	Menambahkan project yang sedang berjalan: kode, nama, target, tanggal mulai, dan tanda project PC.
3.	Membagikan link pengisian ke interviewer (via WhatsApp/Telegram).
4.	Memantau tab Hari Ini: siapa yang sudah/belum mengirim rekap, perolehan dan area per project, total, transport, catatan, serta progres project terhadap target.
5.	Memeriksa tab Riwayat Harian: hari apa tiap interviewer turun, ke area mana, dan dapat berapa per project (filter periode dan interviewer).
6.	Mengisi angka data masuk di tab Pencocokan; sistem menandai selisih terhadap rekap interviewer pada hari yang sama.
7.	Menindaklanjuti selisih dengan interviewer terkait.
8.	Memperbarui status pembayaran di tab Transport PC (Diajukan → Disetujui → Dibayar).
9.	Mengubah status project menjadi Selesai saat target tercapai atau project ditutup.
10.	Mengunduh data tabular secara berkala sebagai cadangan dan untuk analisis lanjutan.

### Interviewer — Rekap Akhir Hari

1.	Membuka link pengisian di browser HP (tanpa login).
2.	Memilih nama dari daftar (tersimpan di perangkat untuk kunjungan berikutnya).
3.	Memilih tanggal turun lapangan (default hari ini).
4.	Mengisi form rekap:
    o	Untuk setiap project yang dikerjakan: jumlah responden selesai dan area yang didatangi (wajib jika jumlah lebih dari 0). Project yang tidak dikerjakan dikosongkan.
    o	Jam mulai dan jam selesai (opsional).
    o	Area lain yang didatangi tapi belum dapat responden (opsional).
    o	Catatan atau kendala (opsional).
    o	Nominal transport dan keterangannya (wajib jika ada perolehan project PC; isi 0 jika tidak ada biaya).
5.	Menekan Kirim rekap. Sistem menyimpan data secara permanen dan menampilkan konfirmasi.
6.	Jika belum ada perolehan sama sekali, rekap tetap dapat dikirim dengan mengisi area lain atau catatan.

#### Interviewer — Perbaikan Rekap

1.	Membuka link pengisian dan memilih nama.
2.	Memilih tanggal yang ingin diperbaiki (hari ini hingga 7 hari ke belakang).
3.	Form terisi otomatis dengan rekap yang sudah dikirim untuk tanggal tersebut.
4.	Mengubah isian yang salah, lalu menekan Perbarui rekap.
5.	Sistem menimpa rekap lama untuk tanggal dan interviewer yang sama, sehingga tidak ada data ganda. Data tidak boleh hilang.

# Teknologi

Silakan gunakan semua teknologi dan metode yang dibutuhkan untuk membangun webapps ini. Database saya ingin disimpan menggunakan backend postgresql.

# Deploy

Ada dua pilihan untuk melakukan deploy webapps ini:

1. Menggunakan docker.
   - Buatkan Dockerfile untuk mengakomodir webapps ini.
   - Buatkan juga skrip bash "start.sh" untuk memulai webapps ini. Buatkan juga skrip bash "stop.sh" untuk menghentikan webapps ini.
   - Kelas webapps ini akan berjalan di port "1526".
2. Menggunakan deploy ke railway.
   - Buat panduan dan setting ke railway dengan mudah.
