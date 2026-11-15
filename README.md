# Jaga Warga

Aplikasi komunitas warga (kampung/cluster): **panic button** yang memicu notifikasi realtime ke seluruh warga, pengumuman, iuran + kas transparan, donasi, dan direktori minat warga. Satu deployment melayani banyak kampung.

| Paket | Teknologi | Dipakai oleh |
|---|---|---|
| `server/` | Bun + Hono + Postgres (Drizzle), SSE, FCM | semua klien |
| `app/` | Flutter (Android-first) | warga & satpam |
| `web/` | React + Vite + TanStack Query + Tailwind | pengurus, bendahara, platform admin |

Dokumentasi lengkap: [`docs/`](docs/README.md) · desain visual: [`design/`](design/) · API: [`docs/api.md`](docs/api.md) · izin: [`docs/permissions.md`](docs/permissions.md).

## Menjalankan

```bash
cp .env.example .env                 # isi JWT_SECRET (openssl rand -hex 32)
make db && make migrate && make seed # Postgres :5433 + skema + data demo
make dev                             # API :8787
make web                             # web admin :5173
make demo-app                        # emulator + APK + buka aplikasi
```

Verifikasi end-to-end (mereset DB dev): `make verify` → `VERIFY OK`.

## Akun demo (password `Rahasia123!`)

| Nomor | Role | Rumah |
|---|---|---|
| 081100000001 | platform admin | – |
| 081100000002 | pengurus | A-01 |
| 081100000003 | bendahara | A-02 |
| 081100000004 | satpam | – |
| 081100000005 | warga (kepala keluarga) | A-03 |
| 081100000006 | warga | A-03 |
| 081100000007 | warga (kepala keluarga) | A-04 |
| 081100000008 | warga (kepala keluarga) | A-05 |

Kode undangan demo: `DEMO-WARGA-1..3`.

## Alur inti

1. **Panic** — warga menahan tombol 1,5 detik (lepas lebih awal = batal) → server menulis alert + timeline, mem-broadcast SSE `panic.created`, mengirim FCM ke topic komunitas, dan menulis inbox untuk semua anggota. Petugas menekan *Saya merespons* lalu *Selesaikan*; pemicu bisa membatalkan ≤10 detik.
2. **Iuran** — bendahara menerbitkan tagihan per periode → warga melapor bayar (+bukti) → bendahara menyetujui → satu baris kas terbentuk otomatis, status tagihan dihitung ulang (`unpaid`/`partial`/`paid`), approve kedua ditolak 409.
3. **Keluarga** — kepala keluarga mengundang anggota rumahnya sendiri lewat kode sekali pakai (maks 6 anggota/rumah). Pengurus hanya perlu mengundang role staff.
4. **Pengumuman & donasi** — terbit → inbox + push + SSE; donasi terverifikasi masuk kas kategori `donasi`.

## Perintah

| Perintah | Fungsi |
|---|---|
| `make db` / `make migrate` / `make seed` | Postgres, migrasi Drizzle, data demo idempoten |
| `make dev` / `make web` / `make app` / `make demo-app` | API, web, Flutter hot reload, emulator+APK |
| `make test` | 38 test server (butuh `jagawarga_test`) |
| `make verify` | `scripts/verify-mvp.sh` — uji API end-to-end (reset DB) |
| `make reset` | hapus data dev, migrasi + seed ulang |
| `make clean` | hapus artefak build |

Test lain: `cd app && flutter test` (10 test) · `cd web && npm run typecheck && npm run build` · `cd app && flutter test integration_test -d <device>`.

## Status

Semua alur inti berjalan dan sudah diverifikasi lewat test otomatis + uji manual di browser dan emulator. Batasan yang diketahui (push perlu project Firebase, iOS belum dibangun, sirine belum ada, satu instance API) dan rencana berikutnya ada di [`docs/roadmap.md`](docs/roadmap.md).

## Struktur

```
server/   API (Bun+Hono), skema Drizzle, seed, 38 test, Dockerfile
app/      Flutter (warga/satpam), test, integration_test
web/      React admin (9 layar, responsif), Vite build
deploy/   Caddyfile, Dockerfile.edge, initdb (DB test)
design/   design system + spek layar mobile & web
docs/     arsitektur, database, API, izin, mobile, web, operasi, keamanan, roadmap
scripts/  verify-mvp.sh, demo-app.sh
```

Deployment: lihat [`docs/operations.md`](docs/operations.md).
