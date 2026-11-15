# Jaga Warga — Layar Web Admin (React)

Acuan token: `design/design-system.md`. Viewport acuan 1440×900; layout fluid dengan `max-width 1120` untuk konten.

## Kerangka

```
┌ sidebar 240 ─┬───────────────────────────────────────────────┐
│ brand mark   │ topbar 64: breadcrumb/h1 + komunitas switcher  │
│              │           + tombol "Buka pengumuman" + user    │
│ nav items    ├───────────────────────────────────────────────┤
│              │ konten padding 32, gap 24                     │
│ (spacer)     │                                               │
│ user mini    │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

- Sidebar: latar `brand.900`, teks `white` 80%; item tinggi 44 radius 8 padding 12; aktif latar `rgba(255,255,255,0.12)` + teks `white`; ikon 20. Urutan: Dasbor, Pembayaran, Tagihan, Kas, Warga, Pengumuman, Alert, (Platform — hanya platform admin).
- Topbar: `surface`, border bawah `line`. Kiri: judul layar `h2`; kanan: komunitas switcher (dropdown 240), badge alert merah bila ada alert aktif, menu user (nama, role, Keluar).
- Konten: kartu `surface` border `line` radius `lg` padding 20.
- Responsif: sidebar 240px hanya ≥1024px; di bawahnya menjadi drawer (tombol hamburger, overlay `ink/40`, tutup otomatis saat navigasi). Topbar 56px di ponsel.
- Grid metrik: 2 kolom di ponsel, 4 kolom ≥1280px. Padding konten `p-4` → `p-8`.
- Tabel padat (tagihan, pembayaran, kas) berubah menjadi daftar kartu di <768px; tabel lain memakai scroll horizontal dengan `min-width` eksplisit dan sel `whitespace-nowrap`.
- Filter periode selalu dropdown nama bulan (`Nov 2026`), bukan kontrol bulan bawaan browser. Tanggal tampil `28 Nov` (tahun berjalan) atau `28 Nov 2027`; pemilih tanggal memakai input native tersembunyi dengan label berformat Indonesia.

## 1. Login

Kartu tengah 400, di atas latar `paper` dengan pola garis halus (`brand.900` 4%).
Logo + "Jaga Warga" `h1`, caption "Masuk untuk mengelola komunitas". Field HP, Password, Primary "Masuk" full width. Error di kotak `danger.100`. Bila >1 membership: setelah submit, tampil pemilih komunitas (kartu radio, nama + role + jumlah anggota).

## 2. Dasbor `/`

Baris 4 kartu metrik (grid 4 kolom, gap 16):
| Kartu | Isi |
|---|---|
| Saldo kas | `display` tabular, caption "per 15 Nov 2026" |
| Tagihan belum lunas | jumlah tagihan + total nominal `h1` |
| Menunggu verifikasi | jumlah pembayaran + badge amber |
| Alert 24 jam | jumlah, merah bila > 0 |

Di bawah: grid 2 kolom (60/40):
- Kiri: kartu "Pembayaran terbaru" — tabel 5 baris (rumah, nominal, bukti thumb 32, waktu, StatusPill) + link "Lihat semua".
- Kanan: kartu "Alert aktif" (live SSE) — baris merah dengan rumah, waktu, tombol "Tangani"; bila kosong: EmptyState kecil "Tidak ada alert aktif".
- Baris bawah: kartu "Pengumuman terbaru" 5 baris judul + waktu + status terbit/draf.

## 3. Pembayaran `/pembayaran`

Toolbar: search rumah, select periode, select status (default `Menunggu`), tombol Refresh. Tabel:

| Rumah | Tagihan | Nominal | Bukti | Dilaporkan | Status | Aksi |
|---|---|---|---|---|---|---|
| A-03 | Iuran Nov 2026 | Rp 150.000 (kanan, money) | thumb 40×52 (klik → lightbox) | 12 Nov 21:04 | StatusPill | `Tinjau` |

Baris diklik → panel kanan 420 (drawer dari kanan, `surface`, shadow): judul "Tinjau pembayaran", detail rumah/tagihan/nominal, foto bukti besar (maks 320 tinggi, klik zoom), catatan pelapor, textarea "Catatan verifikasi" (wajib bila Tolak), tombol Primary "Setujui" + Danger-outline "Tolak". Setelah aksi: panel tertutup, baris hilang dari filter pending, toast sukses, query invalidate (dasbor + tagihan).
Konfirmasi setujui via dialog singkat bila nominal < sisa tagihan: "Pembayaran sebagian — tagihan akan berstatus Sebagian."

## 4. Tagihan `/tagihan`

Toolbar: select periode (default bulan ini), select status, tombol Primary "Buat tagihan massal".
Atas: ringkasan 3 angka (Diterbitkan, Terkumpul, Sisa) dalam satu kartu, nominal tabular.
Tabel: Rumah | Judul | Jatuh tempo | Nominal | Dibayar | Status | Aksi (`Lihat pembayaran`).
Modal buat massal (560): periode (month picker, default bulan depan), judul auto "Iuran {Bulan} {Tahun}" (bisa diubah), nominal `MoneyInput`, jatuh tempo date picker (default tgl 10), pilihan rumah (radio: Semua rumah berpenghuni / Pilih manual → checklist blok). Footer: Secondary "Batal" + Primary "Terbitkan {n} tagihan". Hasil: toast "{created} tagihan dibuat, {skipped} dilewati (sudah ada)".

## 5. Kas `/kas`

Filter: bulan (default bulan ini), kategori, arah (Semua/Masuk/Keluar). Tombol Primary "Tambah transaksi".
Kartu ringkasan: Saldo awal | Masuk | Keluar | Saldo akhir — 4 kolom, angka `h1` tabular, saldo akhir diberi latar `brand.100`.
Tabel ledger: Tanggal | Keterangan | Kategori | Sumber (Iuran/Donasi/Manual) | Nominal (kanan, +/- warna). Footer: total halaman.
Modal tambah (560): arah segmented, kategori select (Iuran, Donasi, Keamanan, Kebersihan, Perbaikan, Kegiatan, Lain-lain), nominal `MoneyInput`, tanggal, deskripsi, lampiran opsional. Validasi inline; setelah simpan muncul di tabel dengan highlight 1 detik.

## 6. Warga `/warga`

Toolbar: search, filter role, tombol Secondary "Impor rumah", Primary "Kode undangan".
Kartu ringkas: total anggota, jumlah rumah berpenghuni, jumlah kepala keluarga.
Tabel: Nama (+ inisial avatar) | Rumah | Role (select inline) | Kepala keluarga (switch) | Status | Aksi (`Reset password`).
Aturan UI: select role `admin` disabled untuk pengurus (hanya admin komunitas yang boleh); switch kepala keluarga menampilkan konfirmasi "Jadikan X kepala keluarga A-03? Kepala keluarga sebelumnya akan dilepas."
Reset password: dialog hasil menampilkan password sementara sekali, tombol Salin, peringatan "Password ini tidak bisa dilihat lagi".
"Kode undangan" modal: pilih role staff (pengurus/bendahara/satpam/warga) + rumah opsional, hasil kode monospace 8 karakter + salin + expiry.
"Impor rumah" modal: textarea placeholder `A,01,Blok A No. 1` per baris, preview count, tombol Primary "Impor {n} rumah".

## 7. Pengumuman `/pengumuman`

Split: kiri daftar (360, kartu baris: judul, kategori pill, waktu, status Draf/Terbit), kanan editor (flex):
judul input `h2`, kategori segmented, switch "Sematkan di atas", upload gambar (drag & drop, preview), isi textarea 16 baris dengan toolbar minimal (bold/italic/list), footer: Secondary "Simpan draf" + Primary "Terbitkan" (bila draf) / "Simpan perubahan".
Pane kanan (38%): preview kartu seperti tampil di aplikasi mobile (latar `paper`, kartu). Ini yang menjamin "biar bagus" di dua klien sekaligus.

## 8. Alert `/alert`

Header: countdown alert aktif (live). Kartu merah per alert aktif: rumah, pemicu, waktu, "Sudah dilihat {n} warga", tombol Primary "Saya merespons" + Secondary "Selesaikan" (modal resolusi: `Ditangani` / `False alarm` + catatan).
Riwayat: tabel (waktu, rumah, jenis, status, respons pertama, durasi) dengan filter tanggal.
Live: badge di sidebar + baris dasbor berubah tanpa reload (SSE).

## 9. Platform `/platform` (hanya `platformAdmin`)

Kartu ringkasan: komunitas, pengguna, media (count + bytes terformat `MB/GB`), alert 24 jam.
Tabel komunitas: Nama (slug) | Anggota | Rumah | Media | Status | Aksi (`Masuk sebagai admin`, `Suspend`/`Aktifkan`).
Tombol Primary "Buat komunitas": modal nama, slug (auto dari nama, editable, validasi `[a-z0-9-]`), alamat. Hasil: kode undangan role admin ditampilkan sekali.
Confirm suspend: dialog destruktif menjelaskan "Anggota tidak bisa login sampai diaktifkan kembali." Setelah suspend, status pill `darurat` "Nonaktif".

## 10. State global

- Loading tabel: skeleton 5 baris, bukan spinner penuh layar.
- Error: banner di atas konten `danger.100` + tombol "Coba lagi"; error 403 → halaman "Tidak punya akses" dengan tautan kembali.
- Sesi habis: redirect ke login dengan pesan "Sesi berakhir, silakan masuk lagi."
- Toast: kanan bawah, 4 detik, `surface` + border `line` + ikon status.
