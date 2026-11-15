# Operasi & deployment

## Environment

| Variabel | Wajib | Default | Keterangan |
|---|:-:|---|---|
| `DATABASE_URL` | ✓ | – | `postgres://user:pass@host:5433/jagawarga` |
| `TEST_DATABASE_URL` | – | – | DB test; dipakai `bun test` |
| `JWT_SECRET` | ✓ | – | ≥32 byte acak; ganti = semua sesi access token hangus (refresh tetap jalan sampai token dicabut) |
| `PORT` | – | `8787` | |
| `MEDIA_DIR` | – | `./data/media` | Relatif → diresolusi ke root repo; Docker memakai `/data/media` |
| `PUBLIC_BASE_URL` | – | `http://localhost:8787` | Menentukan flag `Secure` pada cookie web |
| `APP_ENV` | – | `development` | `production` mewajibkan FCM credentials |
| `CORS_ORIGINS` | – | kosong | Daftar origin web dipisah koma; kosong = CORS tidak dipasang |
| `FCM_SERVICE_ACCOUNT_JSON` | – | kosong | JSON satu baris atau base64. Kosong di dev = push hanya di-log |
| `DOMAIN` | prod | – | Domain untuk Caddy (TLS otomatis) |

## Topologi dev

| Service | Port | Catatan |
|---|---|---|
| `db` (Postgres 17) | `5433` → 5432 | volume `jagawarga_pgdata`; `deploy/initdb` membuat `jagawarga_test` |
| `api` (Bun) | `8787` | `docker compose` opsional di dev; biasanya `make dev` di host |
| `web` (Vite) | `5173` | proxy `/api` → `:8787` |

```bash
make db          # postgres saja
make migrate     # drizzle
make seed        # data demo (idempoten)
make dev         # API
make web         # web admin
make demo-app    # emulator + APK + buka app
```

## Image & registry

Dua image, satu namespace:

| Image | Isi | Ukuran kasar |
|---|---|---|
| `jagawarga/api` | Bun + Hono + drizzle + skrip migrasi/seed (dependensi produksi saja) | ±73 MB |
| `jagawarga/web` | SPA React (dist) + Caddy (proxy `/api`) | ±96 MB |

Tag: `1.0.0` (imutabel), `1.0` (minor), `latest`, dan `sha-<commit>` untuk rollback. Nama bisa diganti lewat `DOCKER_NAMESPACE` (mis. `ghcr.io/<user>`); image web tidak bergantung domain — `DOMAIN` diberikan saat runtime.

```bash
docker login
make images                 # build lokal linux/amd64 (default) untuk diuji
make images PLATFORM=linux/arm64        # kalau host Apple Silicon dan ingin tanpa emulasi
make publish                # push multi-arch (amd64+arm64) ke registry
VERSION=1.1.0 make publish  # rilis berikutnya (tag 1.1.0 + latest)
DOCKER_NAMESPACE=ghcr.io/<user> make publish   # GHCR, nama repo sama
```

Build args image: `VERSION`, `REVISION` (default commit pendek, `local` bila belum ada commit), `SOURCE_URL` — semuanya juga ditulis sebagai label OCI.

Catatan: image default dibangun untuk `linux/amd64` (target VPS). Menjalankannya di Mac arm64 memunculkan peringatan platform dan sedikit lebih lambat; itu normal.

## Produksi (satu VPS, image dari registry)

```bash
cp deploy/env.production.example .env     # template khusus VPS + komentar
chmod 600 .env
# isi minimal: JWT_SECRET, POSTGRES_PASSWORD, DOMAIN, PUBLIC_BASE_URL,
#              CORS_ORIGINS, DOCKER_NAMESPACE, VERSION
openssl rand -hex 32          # JWT_SECRET
openssl rand -base64 24       # POSTGRES_PASSWORD

make prod-up      # pull image + up + migrasi
```

`APP_ENV=production`, `PORT`, `MEDIA_DIR`, dan `DATABASE_URL` **tidak** perlu diisi — `docker-compose.prod.yml` menurunkan/memaksanya. `FCM_SERVICE_ACCOUNT_JSON` opsional: kosong = push nonaktif, inbox tetap jalan.

Perintah setara tanpa Make:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml run --rm api bun src/db/migrate.ts
docker compose -f docker-compose.prod.yml run --rm api bun scripts/seed.ts   # opsional (demo)
```

`docker-compose.yml` (root) tetap dipakai untuk pengembangan lokal (build dari source, DB di port 5433). `docker-compose.prod.yml` memakai project name `jagawarga-prod`, volume terpisah, tanpa port DB, dan `pull_policy: always`.

- Caddy menermin TLS untuk `DOMAIN`, menyajikan SPA dari `/srv/web`, mem-proxy `/api/*` ke `api:8787` dengan `flush_interval -1` (SSE tidak di-buffer).
- `api` punya healthcheck `GET /api/v1/health` (dipakai Docker & monitoring).
- Volume: `pgdata` (database), `./data/media` (bukti bayar). Keduanya **harus** di-backup.

### Checklist rilis

1. `JWT_SECRET` ≥32 byte acak, tidak pernah dipakai ulang dari dev.
2. `DOMAIN` benar dan DNS mengarah ke VPS; port 80/443 terbuka.
3. `CORS_ORIGINS` hanya origin web produksi (bukan `*`).
4. `FCM_SERVICE_ACCOUNT_JSON` terisi **atau** terima push nonaktif (panic tetap via SSE/inbox).
5. `docker compose exec api bun src/db/migrate.ts` dijalankan.
6. `curl -s https://$DOMAIN/api/v1/health` → `{"ok":true,"db":"up"}`; `curl -sI https://$DOMAIN/` → 200.
6b. `make prod-migrate` dijalankan pada setiap rilis yang menambah migrasi.
7. Login web + app, kirim satu panic uji, pastikan alert muncul di web dan di inbox.
8. Backup harian terjadwal (lihat bawah) dan sudah pernah diuji restore.

## Backup & restore

```bash
# database
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U jagawarga -d jagawarga -Fc > backup-$(date +%F).dump

# media
tar czf media-$(date +%F).tgz data/media

# restore (HATI-HATI: menimpa data)
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U jagawarga -d jagawarga -c 'drop schema if exists public cascade; create schema public;'
docker compose -f docker-compose.prod.yml exec -T db \
  pg_restore -U jagawarga -d jagawarga --no-owner < backup-2026-11-15.dump
tar xzf media-2026-11-15.tgz      # mengembalikan data/media
docker compose -f docker-compose.prod.yml run --rm api bun src/db/migrate.ts
```

`pg_dump -Fc` mengecualikan schema `drizzle`? Tidak — jalankan migrasi setelah restore seperti di atas agar jurnal migrasi konsisten.

## Ukuran penyimpanan

| Item | Perkiraan |
|---|---|
| 1 bukti bayar (kompresi klien 1280 px, q60) | 150–300 KB |
| 1 kampung 200 rumah, iuran bulanan | 30–60 MB/bulan, ±0,5 GB/tahun |
| Foto pengumuman (10/bulan) | ±4 MB/bulan |
| DB (tanpa media) | <100 MB untuk 200 rumah × 5 tahun |

Batas keras: berkas ≤5 MB, 10 unggahan/pengguna/hari, server menolak menulis bila sisa disk <1 GB (`507 insufficient_storage`). `GET /admin/stats` menampilkan `mediaBytes` untuk memantau pertumbuhan.

## Monitoring minimum

- `/api/v1/health` tiap 1 menit (status + DB).
- Log container: `docker compose logs -f api` (error tak tertangani dicatat `[unhandled]`).
- Ukuran `data/media` dan sisa disk.
- Jumlah `alerts` aktif tak terselesaikan > 15 menit (indikasi proses respons mati).

## Runbook

| Gejala | Cek | Tindakan |
|---|---|---|
| Semua request 401 | `JWT_SECRET` berubah? jam server? | samakan secret, sinkronkan NTP; klien login ulang |
| Web 403 `no_community` | platform admin belum join komunitas | `POST /admin/communities/:id/join` lalu `switch-community` |
| Login 429 | limiter per IP/nomor | tunggu 1 menit; pastikan reverse proxy meneruskan `X-Forwarded-For` |
| SSE tidak mengirim event | Caddy buffering / API restart | pastikan `flush_interval -1`; event in-memory hilang saat restart, klien reconnect + reload `/alerts/active` |
| Push tidak masuk | kredensial FCM, token device, subscription topic | cek `device_tokens`, `GET /admin/stats`, `docker compose logs api \| grep push` |
| Unggah 413 / 507 / 429 | ukuran, disk, kuota harian | perkecil gambar, bersihkan disk, tunggu reset harian |
| Anggota tidak bisa login | komunitas `is_active=false` atau membership nonaktif | aktifkan komunitas (platform admin) / `PATCH /members/:id { isActive: true }` |
| Data dev kacau | – | `make reset` (drop schema + migrate + seed) |
| Semua data hilang setelah `verify-mvp.sh` | skrip melakukan drop schema | memang perilaku skrip; jangan jalankan di produksi |
| `verify-mvp.sh` menolak jalan | port 8787 sudah dipakai | hentikan `make dev` dulu (skrip menjalankan API sendiri) |
| Semua pengguna ter-logout setelah reset | `make reset`/`verify-mvp.sh` menghapus tabel `sessions` | normal untuk dev; minta login ulang. Bukan bug sesi 30 hari |

## Skala

Saat ini satu instance API:

- Rate limit dan registry SSE disimpan **di memori** → dua instance akan punya dua himpunan alert/limit.
- Connection pool Postgres 10 koneksi.
- Untuk >1 instance: pindahkan limiter & pub/sub ke Redis, lalu pasang sticky session atau ganti SSE dengan gateway yang mendukung fan-out. Database tidak perlu berubah (sudah tenant-scoped).

## Reset & pemeliharaan

```bash
make reset                                    # dev: hapus semua data, migrate, seed
docker compose exec api bun run db:generate   # setelah mengubah schema (di host lebih nyaman)
```
