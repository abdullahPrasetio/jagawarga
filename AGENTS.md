# AGENTS.md — aturan kerja di repo Jaga Warga

Dokumen ini mengikat semua kontributor (manusia maupun agen otomatis). Baca sebelum mengubah kode atau melakukan push.

## 0. Fakta repo

- Monorepo, satu riwayat commit: `server/` (Bun + Hono), `web/` (React), `app/` (Flutter), `deploy/`, `design/`, `docs/`, `scripts/`.
- Compose dev: `docker-compose.yml` (project `jagawarga`, DB port 5433, API 8787, web 5173).
- Compose produksi: `docker-compose.prod.yml` (project `jagawarga-prod`, image dari registry).
- Sumber kebenaran: kode. Dokumen (`docs/`, `design/`) wajib diperbarui di PR yang sama bila kontrak/izin/operasi berubah.

## 1. Larangan keras: rahasia tidak boleh masuk git

**JANGAN PERNAH** meng-commit atau meng-`git add -f`:

| Berkas / data | Alasan |
|---|---|
| `.env`, `.env.*` (kecuali `.env.example`) | berisi `JWT_SECRET`, `DATABASE_URL`, kredensial FCM |
| `**/google-services.json` | konfigurasi Firebase Android |
| `FCM_SERVICE_ACCOUNT_JSON` (nilai JSON/base64) | service account Firebase |
| `*.jks`, `*.keystore`, `*.p12`, `*.pem`, `*.key`, `*.mobileprovision` | kunci signing |
| `data/` (terutama `data/media/`) | bukti bayar & foto warga — data pribadi |
| `deploy/initdb` tidak berisi rahasia; **tapi** password DB produksi tetap hanya di `.env` | |
| `backup-*.dump`, `media-*.tgz`, `*.apk`, `*.aab`, `*.ipa` | artefak, bukan sumber |

Aturan tambahan:

1. Nilai rahasia hanya boleh berada di `.env` (dev) atau secret manager/CI (produksi). Kode membaca dari environment, tidak pernah hardcode.
2. `.env.example` hanya berisi placeholder. Jangan menaruh nilai asli di sana.
3. Data demo (password `Rahasia123!`, kredensial Postgres `jagawarga/jagawarga`) **bukan** rahasia produksi, tetapi jangan pernah dipakai di deployment nyata.
4. Jangan menempelkan token/kunci di pesan commit, komentar, log, issue, atau dokumentasi.

### Scan wajib sebelum push

```bash
# 1. pastikan berkas terlarang benar-benar diabaikan
git check-ignore -v .env data/media app/android/app/google-services.json
git status --ignored --short | grep -E '\.env|data/|google-services' || true

# 2. cari pola rahasia pada berkas yang akan di-commit
git diff --cached --name-only | xargs -r grep -InE \
  '(AIza[0-9A-Za-z_-]{35}|ghp_[A-Za-z0-9]{36}|github_pat_|sk-[A-Za-z0-9]{20,}|xox[abp]-|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' \
  && echo 'RAHASIA TERDETEKSI — BATALKAN PUSH' && exit 1

# 3. pastikan nilai .env tidak bocor ke tree
grep -RIn --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=build --exclude-dir=.dart_tool \
  "$(grep '^JWT_SECRET=' .env | cut -d= -f2-)" . && echo 'JWT_SECRET BOCOR' && exit 1
```

Bila rahasia sudah terlanjur ter-commit: **anggap bocor**. Rotasi dulu (JWT_SECRET → semua sesi logout; kredensial DB; service account FCM), baru bersihkan riwayat (`git filter-repo`) dan force-push setelah koordinasi.

## 2. Sebelum commit

Wajib lulus yang relevan dengan perubahan:

| Area berubah | Perintah |
|---|---|
| `server/**` | `cd server && bun test` (43 test) + `bunx tsc --noEmit` |
| `web/**` | `cd web && npm run typecheck && npm run build` |
| `app/**` | `cd app && flutter analyze && flutter test` |
| Kontrak/API/izin | `./scripts/verify-mvp.sh` (reset DB dev — hentikan `make dev` dulu) |
| Dockerfile/compose | `make images` lalu uji stack prod lokal |

Jangan commit dengan test gagal, `analyze` berisi error/warning, atau build gagal.

## 3. Aturan kode

1. **Kontrak API satu sumber** — `server/src/contracts.ts` (Zod + `z.infer`). Web mengimpor `import type` dari sana; jangan menulis tipe duplikat.
2. **Izin satu sumber** — setiap handler memakai `ensure(auth, 'capability')`; tidak ada cek `auth.role === ...` ad hoc. Perubahan izin wajib memperbarui `docs/permissions.md`.
3. **Tenant dari token** — `community_id` selalu berasal dari JWT, tidak pernah dari body/query klien.
4. **Uang integer rupiah** — tidak ada float; format hanya di klien (`formatRupiah`, `MoneyInput`).
5. **Error lewat `ApiError`** → `application/problem+json`; pesan `detail` bahasa Indonesia dan aman ditampilkan.
6. **Desain dari token** — Flutter `core/theme.dart`, web `@theme` di `tailwind.css`. Tidak ada warna/ukuran hardcoded di widget/komponen.
7. **Migrasi wajib** — perubahan `schema.ts` harus disertai `bun run db:generate` dan file migrasi yang ikut di-commit.
8. **Tanpa dead code** — hapus kode/ekspor yang tidak dipakai; jangan menambah alias kompatibilitas tanpa alasan.
9. **Dokumentasi ikut berubah** — `docs/api.md` untuk endpoint, `docs/database.md` untuk tabel, `docs/operations.md` untuk env/deploy.

## 4. Git & kolaborasi

- Branch: `main` selalu siap deploy. Kerja di branch `feat/<ringkas>`, `fix/<ringkas>`.
- Commit: kalimat perintah, bahasa Indonesia/Inggris konsisten, jelaskan **mengapa** bukan hanya apa. Contoh: `fix(auth): jangan hapus sesi saat refresh gagal karena jaringan`.
- Satu commit = satu perubahan logis. Jangan campur refactor besar dengan perbaikan perilaku.
- **Jangan** `git push --force` ke `main`, jangan rewrite riwayat yang sudah dibagikan tanpa koordinasi.
- Jangan commit artefak build (`app/build`, `web/dist`, `server/node_modules`, `data/`).
- Tag rilis: `vX.Y.Z` setelah `make publish` sukses; naikkan `VERSION` pada rilis berikutnya.

## 5. Deployment

- Produksi memakai `docker-compose.prod.yml` (image dari registry, bukan build lokal).
- Setiap rilis yang menambah migrasi: `make prod-migrate` **sebelum** trafik dilayani versi baru.
- `APP_ENV=production` di produksi. Tidak ada kredensial FCM → push nonaktif (warning), inbox tetap jalan.
- Jangan mengubah `docker-compose.prod.yml` untuk keperluan lokal; gunakan `docker-compose.yml`.
- Jangan menjalankan `./scripts/verify-mvp.sh` atau `make reset` terhadap database produksi (keduanya menghapus schema).

## 6. Data & privasi

- `data/media` berisi bukti pembayaran warga: jangan disalin ke issue, chat, atau repo.
- Log tidak boleh memuat body request, token, nomor HP lengkap, atau koordinat.
- Backup hanya ke lokasi yang disetujui; jangan commit hasil backup.

## 7. Bila ragu

Berhenti dan tanyakan ke maintainer (`abdullahPrasetio`). Lebih baik menunda push daripada membocorkan kredensial atau data warga.
