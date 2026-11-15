# Push notification (FCM)

Push dipakai agar panic membangunkan HP warga walau aplikasi tertutup. Inbox `notifications` selalu ditulis; push hanya jalur cepat (best-effort).

## Yang perlu disiapkan

| Sisi | Item | Di mana |
|---|---|---|
| Server | `FCM_SERVICE_ACCOUNT_JSON` | `.env` / secret manager |
| Android | `google-services.json` | `app/android/app/google-services.json` (di-ignore) |
| iOS (nanti) | `GoogleService-Info.plist` + APNs key | Xcode → Runner target |

Tidak perlu mengubah kode: Gradle sudah mengaktifkan plugin `com.google.gms.google-services` **hanya jika** `google-services.json` ada. Tanpa file itu aplikasi tetap jalan, push dinonaktifkan saat runtime (`push nonaktif: …`).

## Langkah setup

1. Buat project di [Firebase Console](https://console.firebase.google.com) (Google Analytics boleh dimatikan).
2. **Add app → Android**, package name **`id.jagawarga.app`** (harus sama dengan `applicationId`). Unduh `google-services.json` → taruh di `app/android/app/google-services.json`.
3. **Project settings → Service accounts → Generate new private key** → unduh JSON.
4. Isi `.env` server:
   ```bash
   # JSON satu baris (jq -c) atau base64 dari file
   FCM_SERVICE_ACCOUNT_JSON=$(jq -c . service-account.json)
   # alternatif:
   # FCM_SERVICE_ACCOUNT_JSON=$(base64 -w0 service-account.json)
   ```
5. Restart API. `GET /admin/stats` tetap jalan; log tidak lagi menulis peringatan push.
6. Build & pasang APK: `make demo-app` (atau `flutter build apk --debug`).
7. Login di aplikasi → izinkan notifikasi → aplikasi subscribe topic `community_<communityId>`.
8. Uji dari server (platform admin):
   ```bash
   PLATFORM=$(curl -s -X POST localhost:8787/api/v1/auth/login -H 'content-type: application/json' \
     -d '{"phone":"081100000001","password":"Rahasia123!"}' | jq -r .accessToken)

   curl -s -X POST localhost:8787/api/v1/admin/push-test -H "Authorization: Bearer $PLATFORM" \
     -H 'content-type: application/json' \
     -d '{"communityId":"<uuid-komunitas>","audience":"community"}' | jq
   ```
   Respons `{ adapter: "fcm", ok: true, topic: "community_…" }` → HP harus menerima notifikasi "Uji notifikasi".
   `adapter: "log"` berarti kredensial server belum terbaca.

## Kontrak notifikasi

| Hal | Nilai |
|---|---|
| Topic | `community_<uuid>` (semua warga) dan `community_<uuid>_responders` (pengurus/satpam) |
| `data.type` | `panic` (initial), `alert` (update status), `announcement`, `test` |
| `data` lain | `alertId`, `status`, `kind`, `action: "open"`, `audience: "responders"` |
| Tag | `alertId` → update menggantikan notifikasi lama (tidak menumpuk) |
| Channel Android | `panic` (importance max, suara, getar) dan `default` |
| Prioritas | Android `high`; APNs `apns-priority: 10`, `interruption-level: time-sensitive` |
| Judul | per jenis: `🚨 PANIC`, `🚨 MALING`, `🔥 KEBAKARAN`, `🚑 MEDIS` + label rumah |

Isi notifikasi **tidak** memuat koordinat, nomor HP, atau pesan panjang (maks ±120 karakter di badan).

## Yang terjadi saat panic

1. `POST /alerts` menulis alert + timeline.
2. Semua anggota aktif mendapat baris inbox.
3. Push dikirim ke topic komunitas; pengurus/satpam juga menerima push tambahan "Anda petugas — …".
4. Hasil kirim dicatat sebagai event timeline `notified` (`meta.community`, `meta.responders`, `meta.error`).
5. Tap notifikasi → aplikasi membuka `/panic/<alertId>`.

## Troubleshooting

| Gejala | Cek |
|---|---|
| `adapter: "log"` | `FCM_SERVICE_ACCOUNT_JSON` kosong/salah format; lihat log API saat boot |
| `ok: true` tapi HP tidak berbunyi | izin notifikasi belum diberikan; app belum login setelah install; topic belum subscribe; battery optimization OEM (Xiaomi/Oppo) menunda push |
| Notifikasi muncul tapi tap tidak membuka alert | aplikasi versi lama; pastikan `initialAlertId()` membaca `data.type` panic/alert |
| Push ganda setiap update | `tag` hilang (build lama) — update status harus memakai `tag=alertId` |
| iOS tidak menerima | APNs key belum diunggah, capability Push Notifications belum aktif, atau memakai simulator (push tidak jalan di simulator) |
| Error 401 dari FCM | service account dicabut/expired; buat kunci baru dan restart API |

## Batasan platform

- Android 13+ wajib izin `POST_NOTIFICATIONS` (diminta saat login).
- Do Not Disturb **tidak** bisa ditembus penuh oleh aplikasi non-alarm (kebijakan Play). Jangan menjanjikan sebaliknya.
- iOS `time-sensitive` butuh capability; *critical alert* butuh entitlement khusus Apple.
- Tombol aksi di notifikasi ("Saya merespons") belum ada: FCM system notification tidak mendukung action; perlu pesan data-only + `flutter_local_notifications` + background isolate.
- Notifikasi dijadwalkan tidak dipakai; semua push dikirim real-time dari server.

## Keamanan

- `google-services.json` dan service account JSON **jangan pernah** di-commit (sudah di-ignore + aturan di `AGENTS.md`).
- Service account memberi izin mengirim push ke seluruh project Firebase — perlakukan seperti kredensial produksi; rotasi bila bocor.
- Jangan mengirim data sensitif di payload; payload bisa dibaca aplikasi penerima.
