# Jaga Warga — Design System

Berlaku untuk `app/` (Flutter) dan `web/` (React). Semua nilai di bawah adalah **kontrak**: implementasi memakai token ini, bukan hex acak. Sumber kode: `app/lib/core/theme.dart` dan `web/src/design/tokens.ts` + `web/tailwind.css`.

## 1. Prinsip

1. **Tenang, bukan ramai.** Latar kertas hangat, satu warna brand, aksen merah hanya untuk darurat. Tidak ada gradien dekoratif selain kartu panic.
2. **Satu aksi utama per layar.** Tombol dominan selalu jelas; aksi sekunder jadi teks/outline.
3. **Darurat harus beda secara fisik.** Panic = merah, besar, butuh tahan 1,5 detik; tidak pernah di sebelah tombol lain.
4. **Uang selalu rata kanan + tabular.** Nominal tidak pernah di tengah, tidak pernah terpotong.
5. **Status tidak pernah hanya warna.** Selalu pil berisi teks + ikon.

## 2. Warna (token final)

| Token | Hex | Pakai |
|---|---|---|
| `brand.900` | `#0B3B24` | latar kartu panic, header gelap |
| `brand.700` | `#14532D` | teks judul di latar terang, tombol utama (pressed) |
| `brand.600` | `#1A6B3C` | **tombol utama**, ikon aktif |
| `brand.500` | `#21854B` | hover/tint ikon |
| `brand.100` | `#DCFCE7` | latar pil "Lunas", highlight pilihan |
| `paper` | `#F7F6F2` | latar aplikasi |
| `surface` | `#FFFFFF` | kartu, sheet, tabel |
| `ink` | `#10231A` | teks utama |
| `inkMuted` | `#5B6B61` | teks sekunder, caption |
| `line` | `#E3E6E1` | border 1px, divider |
| `danger.700` | `#991B1B` | teks di latar merah muda |
| `danger.600` | `#DC2626` | tombol panic, ikon darurat |
| `danger.100` | `#FEE2E2` | latar banner darurat |
| `amber.700` | `#92400E` | teks status "Belum bayar" |
| `amber.100` | `#FDF0DF` | latar status "Belum bayar" |
| `neutral.100` | `#EEF0ED` | latar status netral / skeleton |
| `white` | `#FFFFFF` | teks di atas `brand.900` |

Pasangan teks/latar wajib lolos kontras ≥ 4.5:1: `ink`/`paper`, `ink`/`surface`, `white`/`brand.900`, `brand.700`/`brand.100`, `danger.700`/`danger.100`, `amber.700`/`amber.100`.

## 3. Tipografi

Web: **Inter** (bundled via `@fontsource/inter`, bukan CDN). Mobile: **Roboto** (font sistem Android) — skala sama, sehingga kepadatan teks identik.

| Token | Size/Line | Weight | Tracking | Pakai |
|---|---|---|---|---|
| `display` | 32/38 | 700 | -0.5 | angka saldo, judul layar panic |
| `h1` | 24/30 | 700 | -0.2 | judul layar |
| `h2` | 20/26 | 600 | 0 | judul seksi / judul kartu |
| `h3` | 17/24 | 600 | 0 | judul baris penting |
| `body` | 15/22 | 400 | 0 | isi |
| `bodyStrong` | 15/22 | 600 | 0 | nilai, nama |
| `caption` | 13/18 | 500 | 0 | metadata, bantuan |
| `label` | 12/16 | 600 | 0.2 | label form, kolom tabel |
| `money` | 17/24 | 600 | 0, `tnum` | nominal (selalu `font-feature-settings:"tnum"`) |

Tidak ada teks < 12px. Tidak ada ALL-CAPS kecuali label kolom tabel (`label`, `letterSpacing 0.4`).

## 4. Spasi, radius, elevasi

Spasi: `4, 8, 12, 16, 20, 24, 32, 40, 56`. Padding kartu mobile `20`, web `20`; padding layar mobile `16`, web `32`; gap antar kartu `12`; gap antar seksi `24`.

Radius: `sm 8` (pill kecil, input), `md 12` (kartu kecil, tombol), `lg 16` (kartu utama, sheet), `xl 24` (kartu panic), `pill 999`.

Elevasi: kartu default **border 1px `line`, tanpa shadow**. Hanya elemen mengambang (sheet, dropdown, toast) memakai `0 8px 24px -12px rgba(16,35,26,0.18)`.

Target sentuh minimum `48×48`.

## 5. Komponen

### 5.1 Tombol
| Varian | Tinggi | Radius | Latar | Teks | Border |
|---|---|---|---|---|---|
| Primary | 52 | 12 | `brand.600` | `white` | – |
| Primary pressed | 52 | 12 | `brand.700` | `white` | – |
| Secondary | 48 | 12 | `surface` | `brand.700` | 1px `brand.600` |
| Ghost | 44 | 8 | transparan | `inkMuted` | – |
| Danger | 52 | 12 | `danger.600` | `white` | – |
| Disabled | – | – | `neutral.100` | `inkMuted` | – |

Label tombol: `bodyStrong`, sentence case, tanpa titik. Loading: spinner 18px menggantikan label, lebar tombol tetap.

### 5.2 StatusPill
Tinggi 24, radius 999, padding horizontal 10, `caption` 500, ikon 14px.
- `lunas` — latar `brand.100`, teks `brand.700`, ikon `check_circle`.
- `belum` — latar `amber.100`, teks `amber.700`, ikon `schedule`.
- `menunggu` — latar `neutral.100`, teks `inkMuted`, ikon `hourglass`.
- `darurat` — latar `danger.100`, teks `danger.700`, ikon `warning`.
- `ditolak` — latar `danger.100`, teks `danger.700`, ikon `cancel`.

### 5.3 Kartu
Anatomi: `surface`, border `line`, radius `lg`, padding 20, gap internal 8. Judul `h2`, isi `body`, metadata `caption` warna `inkMuted`. Kartu yang bisa ditekan: seluruh area klik, umpan balik `opacity 0.92` 120 ms.

### 5.4 Timeout/Empty/Error
- Empty: ikon outline 40 `inkMuted`, judul `h3`, satu baris `caption`, satu Primary/Secondary. Padding vertikal 40.
- Error inline: border `danger.100`, latar `danger.100`, ikon 16, teks `caption` `danger.700`.
- Skeleton: blok `neutral.100` radius `sm`, tanpa animasi kilau (hormati reduced motion).

### 5.5 Form
Label `label` di atas field, field tinggi 52 radius 12 border `line` latar `surface`, teks `body`; fokus: border `brand.600` 2px. Helper `caption` `inkMuted`; error menggantikan helper dengan warna `danger.700`. Input uang: prefix `Rp`, hanya digit, pemisah ribuan titik saat mengetik, nilai disimpan integer.

### 5.6 Panic
- Tombol: lingkaran `min(240, lebarLayar-96)`, latar `danger.600` → `danger.700` saat ditahan, ring progres 4px `white` di luar lingkaran, label `h2` `white` "TAHAN" + `caption` "untuk mengirim sinyal".
- Kartu pembungkus: latar `brand.900`, radius `xl`, padding 24, judul `h2` `white` "Panic Button", subteks `caption` `white` 70% opasitas.
- Saat aktif: layar penuh `danger.600`, tidak ada navigasi bawah, status `display` `white`.

### 5.7 Tabel (web)
Header `label` ALL-CAPS `inkMuted` di atas latar `paper`, tinggi baris 44, divider 1px `line`, hover `paper`, nominal rata kanan `money`, kolom aksi lebar tetap 120 rata kanan. Baris terpilih: latar `brand.100`.

## 6. Ikon

Material Symbols (Flutter: `Icons.*`; web: `lucide-react` bila perlu). Ukuran 20 di baris, 24 di header, 40 di empty state. Ikon tidak pernah menggantikan label aksi utama.

## 7. Motion

Durasi `120` (tekan), `200` (transisi halaman), `280` (sheet masuk dari bawah dengan kurva `easeOutCubic`). Hanya opacity/transform; tidak ada animasi yang berjalan terus. `MediaQuery.disableAnimations` / `prefers-reduced-motion` mematikan transisi.

## 8. Bahasa

Indonesia, sapaan "Anda" di teks sistem, "Bapak/Ibu" tidak dipakai (netral). Istilah baku: **Tagihan**, **Iuran**, **Kas warga**, **Pengumuman**, **Panic**, **Kepala keluarga**, **Blok/Rumah**, **Lapor bayar**, **Verifikasi**.
Penulisan nominal: `Rp 150.000` (spasi setelah Rp, tanpa desimal). Tanggal di tabel: `15 Nov` bila tahun berjalan, `15 Nov 2027` bila beda tahun; tanggal+jam: `15 Nov, 21:04`. Filter periode selalu memakai dropdown nama bulan (`Nov 2026`), bukan kontrol bulan bawaan browser.
