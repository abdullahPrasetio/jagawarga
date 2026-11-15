# Jaga Warga — Layar Mobile (Flutter)

Acuan token: `design/design-system.md`. Semua ukuran dp, padding layar 16, app bar tinggi 56 tanpa shadow dengan judul `h1`.

## Navigasi

`StatefulShellRoute`, bottom nav 4 tab (warga) / 5 tab (pengurus|bendahara|satpam):

```
Beranda      (home)       Icons.home_outlined / home
Keuangan     (receipt)    Icons.receipt_long_outlined / receipt_long
Warga        (people)     Icons.people_outline / people
Profil       (person)     Icons.person_outline / person
Kelola *     (shield)     Icons.shield_outlined / shield      * hanya pengurus/satpam
```

Tab aktif: ikon terisi + label `brand.700`; non-aktif `inkMuted`. Tinggi 64 + safe area. Badge notifikasi: titik `danger.600` 8dp di kanan atas ikon Beranda.

## 1. Login

```
[spasi 56]
(logo 56: lingkaran brand.100 + ikon shield brand.700)
[24] "Masuk ke Jaga Warga"            h1
[8]  "Gunakan nomor HP yang terdaftar di komunitas Anda." caption inkMuted
[32] Label "Nomor HP" + field (keyboard phone, prefix +62)
[16] Label "Password" + field (obscure, suffix ikon mata)
[8]  Teks kanan "Lupa password?" ghost → sheet instruksi hubungi pengurus
[24] Primary "Masuk" (full width, 52)
[16] Teks tengah: "Punya kode undangan? Aktivasi" (teks tombol brand.700)
[spasi sisa]
```
Error: field merah + `caption danger.700`; error umum di atas tombol dalam kotak `danger.100`.
State loading: tombol spinner, field disabled. Sukses → Beranda (atau pemilih komunitas bila >1, atau `/web-only` bila platform admin tanpa komunitas).

## 2. Aktivasi (kode undangan)

Judul "Aktivasi akun", field: Kode undangan (uppercase otomatis, 8 karakter, monospace `bodyStrong`, letterSpacing 2), Nama lengkap, Nomor HP, Password (min 8, helper "Minimal 8 karakter"). CTA "Aktivasi". Di bawah: "Sudah punya akun? Masuk".
Setelah sukses, tampilkan dialog satu kali: "Anda terdaftar di **Blok A No. 3**. Kepala keluarga: Budi." (bila undangan membawa rumah).
Error `household_full` → kotak `danger.100`: "Rumah ini sudah mencapai batas 6 anggota. Hubungi pengurus."

## 3. Beranda

```
AppBar: "Halo, Sari" (h1) + caption "Blok A No. 3"      [ikon lonceng + badge]
[16]
[banner darurat — hanya bila ada alert aktif]
  danger.100, radius lg, ikon warning, "PANIC AKTIF — Blok B No. 2"  h3 danger.700
  caption "Dipicu 2 menit lalu · belum ada yang merespons"
  tombol Danger kecil "Lihat"
[12]
[kartu panic — brand.900, radius xl, padding 24]
  "Panic Button"  h2 white
  "Kirim sinyal darurat ke seluruh warga."  caption white 70%
  [16] tombol lingkaran 200 danger.600 di tengah, ring progres
  [12] caption white 70% "Tahan 1,5 detik untuk mengirim"
[16] [seksi "Kas warga"  h2 + "Lihat" ghost kanan]
  kartu: "Saldo" caption, "Rp 4.250.000" display tabular,
         "Masuk bulan ini Rp 1.800.000 · Keluar Rp 350.000" caption
[16] [seksi "Pengumuman" h2 + "Semua" ghost]
  3 baris kartu: judul h3, caption "Keamanan · 2 jam lalu", pinned → ikon pin brand.600
[16] [EmptyState bila belum ada pengumuman]
```
Pull-to-refresh. Kartu saldo hanya tampil untuk role yang boleh `ledger.read`.

## 4. Panic aktif (`/panic/:id`)

Layar penuh `danger.600`, tanpa bottom nav, status bar terang.

```
[spasi 48]
"PANIC AKTIF"            label white 80%
[8]  "Blok A No. 3"      display white   (rumah pemicu)
[8]  "Dipicu 21:04 · 12 warga sudah melihat" caption white 90%
[24] Kotak putih radius lg:
     status h2 ink  ("Menunggu respons" / "Sedang ditangani" / "Selesai")
     caption: "Budi (pengurus) merespons 21:06"
     [12] daftar responder: avatar inisial + nama + waktu, maks 3, "+2 lainnya"
[24] Primary putih "Saya merespons" (teks danger.700)   [pengurus/satpam, bila belum ada yang merespons]
[12] Secondary putih-outline "Selesaikan"               [pengurus/satpam]
[12] Ghost putih "Batalkan sinyal"                      [pemicu, <=10 detik]
[spasi sisa]
caption tengah white 80% "Timeline lengkap tersimpan otomatis."
```
Bila pengguna bukan pemicu & bukan responder: hanya kotak status + tombol "Saya merespons".
Bila sudah selesai: latar berubah `brand.900`, tombol "Tutup" (Secondary putih), status menampilkan resolusi (`False alarm` / `Ditangani`).

## 5. Keuangan

AppBar "Keuangan". Segmented control (2 segmen, tinggi 40, radius 12, latar `neutral.100`, aktif `surface` + shadow tipis): **Tagihan** | **Kas**.

Tagihan:
```
kartu ringkasan: "Total belum dibayar" caption + "Rp 450.000" h1 tabular
[12] daftar kartu tagihan:
  baris 1: "Iuran November 2026"  h3        [StatusPill]
  baris 2: "Jatuh tempo 30 Nov 2026" caption
  baris 3: "Rp 150.000" money kanan
  divider
  tombol Secondary "Lapor bayar" (bila belum lunas/menunggu) / teks "Terverifikasi 12 Nov" caption
[EmptyState] "Belum ada tagihan" / "Tagihan baru muncul setelah pengurus menerbitkannya."
```
Lapor bayar (sheet, radius lg, drag handle):
```
"Lapor pembayaran" h2
"Blok A No. 3 · Iuran November 2026" caption
[16] Upload: kotak dashed `line` radius 12 tinggi 160, tengah ikon image 32 + "Tambah bukti transfer" caption + "JPG/PNG, maks 5 MB"
     setelah dipilih: pratinjau 3:4 radius 12 + tombol "Ganti"
[16] Label "Nominal" + field uang (auto-isi sisa tagihan)
[16] Label "Catatan (opsional)"
[24] Primary "Kirim untuk diverifikasi"
```
Kas:
```
filter bar: chip bulan (cth "Nov 2026") + chip kategori
kartu 3 kolom: Masuk / Keluar / Saldo (angka tabular, hijau/merah/ink)
daftar baris ledger: judul `bodyStrong`, caption "Iuran · 12 Nov",
                     nominal kanan: +Rp 150.000 (brand.700) / -Rp 50.000 (danger.700)
[EmptyState] "Belum ada transaksi bulan ini"
```

## 6. Warga (direktori + minat)

```
AppBar "Warga" + caption "48 anggota"
[12] Search field radius 12, placeholder "Cari nama atau blok"
[12] Horizontal chip filter minat: "Semua", "Futsal", "Berkebun", "Musik", ...
[16] Daftar kartu: avatar inisial 40 (brand.100/brand.700), nama h3 + "Blok A No. 3" caption,
     baris chip minat (maks 3, "+2"),
     trailing tombol ikon WhatsApp (outline 40) → wa.me
[EmptyState] "Belum ada warga dengan minat itu"
```
Warga dengan `directoryVisible=false` tidak tampil. Tanpa nomor HP bila tidak diizinkan → tombol WA disembunyikan.

## 7. Profil + Rumah saya

```
AppBar "Profil"
kartu identitas: avatar 56, nama h2, "Blok A No. 3 · Warga" caption, tombol Ghost "Ubah profil"
daftar baris (ListRow): Rumah saya / Notifikasi / Bantuan / Keluar (teks danger.700)
```
Rumah saya (`/profil/rumah`):
```
"Rumah saya" h1
"Blok A No. 3" bodyStrong + "Kepala keluarga: Sari" caption
[16] daftar anggota: avatar + nama + caption "Kepala keluarga" (pil brand.100) atau "Anggota"
[24] Primary "Undang anggota keluarga"  [hanya kepala keluarga]
[8]  caption "Setiap anggota punya akun sendiri agar sinyal darurat jelas dari siapa."
```
Sheet undangan: kode 8 karakter monospace 24 letterSpacing 4 dalam kotak `paper`, tombol Secondary "Salin" + Primary "Bagikan", caption "Berlaku 7 hari · sekali pakai · maksimal 6 anggota per rumah".

## 8. Kelola (pengurus/satpam)

Segmented: **Alert** | **Anggota** | **Undangan** | **Pengumuman**.

Alert: daftar kartu (aktif di atas, latar `danger.100`): rumah, waktu, status, tombol kecil "Respons"/"Selesaikan". Riwayat di bawah dengan divider tanggal.
Anggota: baris read-only (nama, rumah, role pil) + ikon telepon untuk menyalin nomor.
Undangan: tombol Primary "Buat kode staff" + daftar kode (monospace) dengan tombol salin dan caption expiry.
Pengumuman: form singkat (judul, isi 6 baris, kategori segmented, tombol "Terbitkan"), daftar pengumuman terbit + tombol hapus.

## 9. Notifikasi (inbox)

Baris: ikon jenis (panic danger, pengumuman brand, tagihan amber), judul `bodyStrong`, isi 2 baris, caption waktu. Belum dibaca: latar `brand.100` 40% + titik `brand.600`. Tap panic → `/panic/:id`. Swipe untuk tandai dibaca.

## 10. `/web-only`

Layar tenang `paper`: ikon laptop 40, "Kelola komunitas lewat web admin" h2, caption alamat web (`PUBLIC_BASE_URL`), tombol Secondary "Salin alamat", Ghost "Keluar".

## 11. State global

- Offline: banner tipis di atas konten `amber.100` "Tidak ada koneksi — data mungkin belum terbaru".
- Panic gagal kirim: layar penuh `paper` dengan kotak `danger.100`, judul `h2 danger.700` "Sinyal gagal terkirim", caption penyebab, Primary "Coba lagi", Secondary "Telepon pengurus" (tel:), daftar nomor pengurus/satpam sebagai baris ketuk.
- Refresh: indikator tarik 2dp `brand.600`.
