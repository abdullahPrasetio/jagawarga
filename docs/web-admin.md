# Web admin (React)

Untuk pengurus, bendahara, dan platform admin. Warga/satpam memakai aplikasi Flutter.

- React 19 + TypeScript, Vite 7, React Router 7, TanStack Query 5, Tailwind CSS 4, font Inter (bundled via `@fontsource`, tanpa CDN).
- Tidak ada SSR; halaman di belakang login.

## Struktur

```
web/src/
  main.tsx              # QueryClient + AuthProvider + BrowserRouter
  App.tsx               # gate: loading → login → pilih komunitas → halaman
  tailwind.css          # @theme token warna/radius/font
  api/
    client.ts           # fetch wrapper, token di memori, refresh single-flight
    sse.ts              # SSE via fetch + ReadableStream
    types.ts            # import type dari ../../server/src/contracts
  stores/auth.tsx       # user, membership, memberships, platformAdmin
  components/
    Layout.tsx          # sidebar + drawer responsif, topbar, live alert badge
    ui.tsx              # Rupiah, StatusPill, Modal, MoneyInput, DateField,
                        # PeriodSelect, ImageProof, QueryError, EmptyState
  design/tokens.ts      # cermin design/design-system.md (dipakai tooling/tema)
  routes/               # Login, Dashboard, Pembayaran, Tagihan, Kas,
                        # Warga, Pengumuman, Alert, Platform
```

Tipe API **tidak ditulis ulang**: `api/types.ts` mengimpor `import type` dari `server/src/contracts.ts`, sehingga perubahan bentuk response di server memecah `npm run build` di web.

## Autentikasi (cookie)

1. `POST /auth/login` dengan header `X-Client: web` → server **tidak** mengirim `refreshToken` di body, melainkan cookie `jagawarga_refresh` (`HttpOnly; SameSite=Strict; Path=/api/v1/auth`).
2. Access token disimpan **hanya di memori** (tidak pernah `localStorage`).
3. Reload halaman → `POST /auth/refresh` (cookie) → `GET /auth/me` → sesi pulih tanpa login ulang.
4. `401` pada request apa pun → satu refresh single-flight → retry sekali → gagal = layar login.
5. `logout` menghapus cookie di server + state di klien.

## Data & realtime

- Semua data lewat React Query (`staleTime 15s`); key utama: `dashboard`, `invoices`, `payments`, `members`, `announcements`, `alerts`, `platform`.
- `Layout` berlangganan SSE; event `panic.*` meng-invalidate `alerts` dan `dashboard`, `announcement.published` meng-invalidate `announcements`. Badge jumlah alert aktif diperbarui tanpa reload.
- `ImageProof` mengambil `/media/:id/raw` lewat `fetch` ber-Authorization lalu `URL.createObjectURL` (tag `<img>` tidak bisa mengirim header), dan me-revoke object URL saat unmount.
- Semua kegagalan query tampil sebagai banner + tombol *Coba lagi* (`QueryError`), bukan angka 0 palsu.

## Layar

| Rute | Fungsi | Role |
|---|---|---|
| `/login` | masuk; pemilih komunitas bila >1 membership | semua |
| `/` | dasbor: saldo kas, tagihan belum lunas (+periode), pending verifikasi, alert aktif live, pengumuman terbaru | pengurus/bendahara/admin |
| `/pembayaran` | daftar laporan, panel tinjau (bukti, setujui/tolak) | bendahara/pengurus/admin |
| `/tagihan` | filter periode (default *Semua periode*), kolom periode, buat tagihan massal | bendahara/pengurus/admin |
| `/kas` | ringkasan masuk/keluar/saldo, ledger, tambah transaksi | bendahara/pengurus/admin |
| `/warga` | anggota, ubah role, kepala keluarga, reset password, kode undangan staff, impor rumah | pengurus/admin |
| `/pengumuman` | daftar + editor + pratinjau kartu mobile + terbitkan | pengurus/admin |
| `/alert` | alert aktif (aksi) + riwayat | pengurus/satpam/admin |
| `/platform` | komunitas, statistik, buat/suspend/join | platform admin |

## Responsif

- Sidebar 240px hanya ≥1024px; di bawahnya menjadi **drawer** (hamburger di topbar, overlay, auto-tutup saat navigasi).
- Metrik dasbor: 2 kolom di ponsel → 4 kolom ≥1280px; padding konten `p-4` → `p-8`.
- Tagihan, Pembayaran, dan Kas berubah dari tabel menjadi **daftar kartu** di bawah 768px; riwayat alert memakai grid 2→5 kolom.
- Tabel Warga/Platform memakai scroll horizontal dengan `min-width` eksplisit dan sel `whitespace-nowrap`.
- Pengumuman: 1 kolom di ponsel (editor penuh), pratinjau mobile hanya ≥1280px.

## Tanggal & uang

- `formatDate`: `28 Nov` bila tahun berjalan, `28 Nov 2027` bila berbeda; `formatDateTime`: `15 Nov, 21:04`.
- Filter bulan memakai dropdown nama bulan (`PeriodSelect` → `Nov 2026`), bukan `<input type="month">`.
- `DateField` menampilkan tanggal berformat Indonesia dengan pemilih native tersembunyi (`showPicker()`).
- `MoneyInput` hanya menerima digit, menampilkan pemisah ribuan (`Rp 125.000`), dan menyimpan integer.

## Build & deploy

```bash
cd web && npm ci && npm run typecheck && npm run build   # dist/
npm run dev                                              # :5173, proxy /api → :8787
```

Produksi: `deploy/Dockerfile.edge` (stage Node membangun `dist`, stage Caddy menyajikan + mem-proxy `/api`). Build di dalam Docker menyertakan `server/src/contracts.ts` + symlink `node_modules` agar `import type` server tetap tervalidasi.

## Batasan yang diketahui

- Tidak ada unit test UI; verifikasi lewat `tsc --noEmit`, `vite build`, dan pengujian manual di Chromium (desktop 1440px dan ponsel 390px).
- Bundle ±364 kB (107 kB gzip); belum ada code-splitting per route — cukup untuk admin internal.
