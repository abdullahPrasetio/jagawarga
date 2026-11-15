# Pengembangan

## Prasyarat

| Alat | Versi teruji | Catatan |
|---|---|---|
| Bun | 1.4.x | server + test |
| Node.js | 22.x | hanya untuk web (Vite) |
| Docker | OrbStack / Docker Desktop | Postgres dev & build edge |
| Flutter | 3.50 stable | SDK Android ≥35, JDK 17 untuk debug |
| JDK 21 | `/opt/homebrew/opt/openjdk@21` | **wajib untuk `flutter build apk --release`** (lint vital AGP 9 memakai API Java 21; JDK 17 gagal `NoSuchMethodError`) |
| Android SDK | platforms 35/36, AVD `Medium_Phone_API_36.0` | `adb` & `emulator` di `$HOME/Library/Android/sdk` |
| jq, curl | apa saja | dipakai skrip verifikasi |

JDK 17 bisa dari `brew install openjdk@17` (keg-only). Arahkan Flutter:

```bash
flutter config --android-sdk "$HOME/Library/Android/sdk"
# debug boleh JDK 17; release butuh JDK 21:
flutter config --jdk-dir /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
```

## Menyiapkan dari nol

```bash
git clone <repo> && cd jagawarga
cp .env.example .env                 # isi JWT_SECRET (openssl rand -hex 32)
make db && make migrate && make seed
make dev                             # terminal 1: API :8787
make web                             # terminal 2: web :5173
make demo-app                        # terminal 3: emulator + APK + buka app
```

Akun demo dan alur uji ada di [../README.md](../README.md).

## Perintah

| Perintah | Fungsi |
|---|---|
| `make db` | nyalakan Postgres (port 5433) |
| `make migrate` / `make seed` | migrasi Drizzle / data demo idempoten |
| `make reset` | drop schema + migrate + seed (dev; semua sesi login ikut terhapus) |
| `make dev` | API mode watch |
| `make test` | 38 test server (butuh `jagawarga_test`) |
| `make web` / `make web-build` | dev / build web |
| `make app` | Flutter hot reload di emulator |
| `make demo-app` | emulator + APK + buka aplikasi |
| `make verify` | `./scripts/verify-mvp.sh` (mereset DB; hentikan `make dev` dulu) |
| `make clean` | hapus `node_modules`, `build`, `dist`, media |

## Peta repo

```
server/   API (Bun+Hono), schema Drizzle, skrip seed, test, Dockerfile
app/      Flutter (warga/satpam), test, integration_test, Android
web/      React admin, komponen, routes, build Vite
deploy/   Caddyfile, Dockerfile.edge, initdb (DB test)
design/   design system + spek layar (sumber token desain)
docs/     dokumentasi ini
scripts/  verify-mvp.sh, demo-app.sh
```

## Konvensi yang harus diikuti

1. **Kontrak API satu sumber.** Semua bentuk request/response didefinisikan di `server/src/contracts.ts` (Zod + `z.infer`). Web mengimpornya sebagai `import type`; server memvalidasi dengan schema yang sama. Jangan menulis tipe duplikat.
2. **Izin satu sumber.** Setiap handler memanggil `ensure(auth, 'capability')`; tidak ada pengecekan `auth.role === …` di handler. Tambah capability di `lib/permissions.ts` + tabel [permissions.md](permissions.md).
3. **Tenant selalu dari token.** `auth.communityId` — jangan menerima `communityId` dari body/query untuk data komunitas.
4. **Uang integer.** Jangan memakai float; format hanya di klien (`formatRupiah`, `MoneyInput`).
5. **Error lewat `ApiError`.** Status + `code` stabil; pesan `detail` berbahasa Indonesia dan aman ditampilkan.
6. **Desain dari token.** Flutter: `core/theme.dart`; web: kelas Tailwind dari `@theme` (`tailwind.css`). Tidak ada warna hardcoded di widget/komponen.
7. **Dokumentasi ikut berubah** bila kontrak, izin, atau operasi berubah.

## Menambah fitur (contoh: “papan pengumuman kategori baru”)

1. `contracts.ts` — tambah nilai enum + schema bila perlu.
2. `schema.ts` — kolom/constraint baru, lalu `bun run db:generate && bun run db:migrate`.
3. `modules/<fitur>/routes.ts` — handler + `ensure(...)` + query ber-`communityId`.
4. `test/<fitur>.test.ts` — kasus izin + kasus sukses + kasus batas (409/404).
5. Klien: Flutter `features/<fitur>/`, web `routes/<Fitur>.tsx` (pakai komponen `ui.tsx`).
6. Perbarui [api.md](api.md), [permissions.md](permissions.md) bila relevan.

## Strategi test

| Lapis | Alat | Yang diuji |
|---|---|---|
| Server | `bun test` (38 kasus, DB nyata) | izin, alur panic, keuangan (idempotensi ledger), rumah tangga, platform admin, isolasi tenant, media |
| Mobile | `flutter test` | logika yang rawan: hold 1,5 detik, mapping status, format uang |
| Mobile E2E | `flutter test integration_test` | login → alert realtime → layar panic → batal/selesaikan |
| Web | `tsc --noEmit` + `vite build` + uji manual | tipe kontrak & build; UI dicek di 390px dan 1440px |
| End-to-end API | `scripts/verify-mvp.sh` | undangan→aktivasi, panic→SSE, tagihan→approve→ledger, platform admin, cookie web |

Yang **tidak** perlu ditest: pemetaan 1:1 model→DTO, teks statis, atau “tidak melempar error”. Fokus ke perilaku yang bisa dilihat konsumen (status, angka, izin, urutan langkah).

Test server memakai DB nyata `jagawarga_test`; `test/setup.ts` (preload `bunfig.toml`) melakukan drop schema + migrasi sekali per run, dan setiap file memanggil `seedDatabase()` di `beforeAll` untuk isolasi.

## Gaya kode

- TypeScript: dua spasi, kutip tunggal, titik koma, `strict`; tanpa linter/formatter terpasang — andalkan `tsc`, `flutter analyze`, dan review.
- Dart: `flutter analyze` bersih; widget kecil, state di Riverpod.
- Bahasa produk: Indonesia; identifier kode: Inggris.
- Komentar hanya untuk niat/alasan yang tidak terbaca dari kode (mis. mengapa `receiveTimeout` dimatikan untuk SSE).

## Debug cepat

```bash
# token + panggil endpoint
TOKEN=$(curl -s -X POST localhost:8787/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"phone":"081100000005","password":"Rahasia123!"}' | jq -r .accessToken)
curl -s localhost:8787/api/v1/alerts/active -H "Authorization: Bearer $TOKEN" | jq

# inspeksi DB
docker compose exec db psql -U jagawarga -d jagawarga -c 'select id,status,created_at from alerts order by created_at desc limit 5;'

# log API
docker compose logs -f api
```
