# Status & rencana

## Yang sudah berjalan

| Area | Status | Bukti |
|---|---|---|
| API (18 tabel, auth, izin, alert, SSE, media, keuangan, donasi, admin platform) | selesai | `bun test` 38 lulus; `scripts/verify-mvp.sh` → `VERIFY OK` |
| Aplikasi warga (login, panic, keuangan, pengumuman, donasi, direktori, rumah, kelola) | selesai | `flutter analyze` bersih; 10 test; APK terpasang & login di emulator |
| Web admin (9 layar, responsif 390px & 1440px, cookie auth) | selesai | `tsc` + `vite build`; uji Chromium: tinjau pembayaran → tagihan `paid` + ledger bertambah |
| Deploy | selesai | `docker compose --profile prod` (Caddy + API) melayani SPA, `/api`, dan cookie lewat HTTPS |
| Dokumentasi | selesai | `docs/` + `design/` |

Belum terverifikasi penuh: **uji perangkat on-device** (lihat bawah) dan **push nyata** (butuh project Firebase).

## Batasan saat ini

1. **Emulator sempat gagal karena disk host penuh.** Dengan sisa 3,6 GB dari 461 GB, emulator ANR dan `adb` melaporkan "failed to attach"; setelah `flutter clean` + `docker builder prune` (sisa ±23 GB) aplikasi berjalan normal. `integration_test/panic_flow_test.dart` sudah ditulis tetapi belum dijalankan ulang setelah pembersihan; widget test menutup risiko logika tahan-tombol.
2. **Push belum aktif** karena belum ada `google-services.json` / service account. Tanpa itu: panic tetap realtime via SSE saat app terbuka dan selalu masuk inbox notifikasi. Saluran push (judul per jenis, `tag`, topic petugas, log hasil kirim) sudah siap di kode.
3. **iOS belum dibangun** (hanya Command Line Tools, tanpa Xcode). Kode dijaga iOS-safe.
4. **Sirine/relay masjid** belum ada; baru tersedia satu titik sisip.
4b. **Aksi notifikasi "Saya merespons"** belum tersedia: FCM system notification tidak mendukung tombol aksi; perlu pesan data-only + `flutter_local_notifications` + background isolate.
4c. **Widget layar utama**: tiga provider (Panic 2×2, Bantuan 4×2, Info 4×1) sudah ada, snapshot ditulis dari Flutter, tap membuka layar konfirmasi. Belum: refresh periodik 30 menit (butuh WorkManager) dan pemasangan otomatis (harus digeser manual dari launcher).
5. **WhatsApp blast** belum ada (butuh gateway seperti Fonnte).
6. **Satu instance API** — rate limit & SSE di memori.
7. **Tanpa payment gateway** — pembayaran manual + bukti + verifikasi bendahara.
8. **Tanpa thumbnail** — gambar diunduh apa adanya saat dibuka (cukup untuk <2000 gambar/bulan/kampung).
9. **Tanpa backup otomatis** dan tanpa monitoring eksternal terpasang.
10. **Web tanpa unit test UI**; verifikasi lewat tipe, build, dan uji manual.
11. **Tanpa RLS** di Postgres (kontrol tenant ada di lapisan API).

## Berikutnya (berurutan)

### 1. Sirine / relay masjid

Titik sisip: `server/src/modules/alerts/service.ts` → `publishPanic(alert)`.
Rencana minimal:

1. Tabel `integrations(id, community_id, kind, url, secret, is_active)`.
2. `lib/siren.ts`: `POST url` body `{alertId, houseLabel, kind, triggeredAt}` + header `X-Signature: HMAC-SHA256(secret, body)`; timeout 3 detik; kegagalan hanya di-log.
3. Panggil dari `publishPanic` setelah broadcast SSE (jangan menggagalkan request).
4. Perangkat: ESP32/ESP8266 + relay yang mengaktifkan sirine masjid; endpoint menerima webhook di jaringan lokal (atau via reverse tunnel).
5. Uji: alert → device menyala <2 detik; device mati → panic tetap sukses.

### 2. WhatsApp blast untuk pengurus/satpam

Adapter `lib/whatsapp.ts` (Fonnte/WABLAS) dipanggil dari `publishPanic` untuk nomor ber-role `pengurus|satpam`. Simpan status kirim di `alert_events.meta` agar tidak menggandakan.

### 3. Push produksi

- Buat project Firebase, tambahkan app Android `id.jagawarga.app`, unduh `google-services.json` ke `app/android/app/`.
- Isi `FCM_SERVICE_ACCOUNT_JSON` di server.
- Uji: app di background → panic → notifikasi channel `panic` muncul <3 detik.
- Lanjut iOS: Xcode + APNs key + `flutter build ios`.

### 4. Skala & ketahanan

- Redis untuk rate limit + pub/sub SSE sebelum menjalankan >1 instance.
- RLS Postgres bila ada klien yang mengakses DB langsung.
- Backup otomatis + uji restore terjadwal.
- Thumbnail 320px saat unggah bila volume gambar naik.

### 5. Fitur komunitas berikutnya

- Laporan kas bulanan PDF + ekspor CSV (transparansi).
- Pengingat iuran via notifikasi (jadwal harian di server).
- Reservasi fasilitas (balai/kolam) dan daftar tamu.
- Pembayaran online (Midtrans/Xendit) dengan webhook yang memanggil alur `reviewPayment` secara otomatis.
- 2FA untuk role keuangan.
- Pembersihan EXIF di server.

## Cara mengusulkan perubahan

1. Buat isu dengan skenario pengguna + dampak ke tabel/izin.
2. Ikuti checklist “Menambah fitur” di [development.md](development.md).
3. Perbarui [api.md](api.md), [permissions.md](permissions.md), [database.md](database.md) dalam PR yang sama.
