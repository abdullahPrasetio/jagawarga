# Aplikasi mobile (Flutter)

Dipakai warga dan satpam. Pengurus/bendahara memakai web untuk pekerjaan meja; app tetap menyediakan aksi lapangan (alert, undangan, pengumuman singkat).

- Flutter 3.50 (Dart 3), Android-first; proyek iOS ada tetapi belum diverifikasi.
- Riverpod 3 (`Notifier`/`Provider`), go_router 18, Dio 5, `flutter_secure_storage`, Firebase Messaging 17 + `flutter_local_notifications` 23, `geolocator`, `image_picker`, `cached_network_image`, `intl`, `share_plus`, `url_launcher`.

## Struktur

```
lib/
  main.dart                # bootstrap: locale id_ID, push, container, restore sesi
  core/
    config.dart            # API_BASE_URL / WEB_ADMIN_URL via --dart-define
    api_client.dart        # Dio + interceptor token + refresh single-flight
    api_error.dart         # problem+json → ApiException
    session.dart           # SessionNotifier: login, activate, refresh, logout, switch
    events.dart            # satu koneksi SSE + reconnect backoff
    push.dart              # FCM (best-effort) + channel panic
    models.dart            # parsing response
    format.dart            # rupiah, tanggal, periode
    theme.dart             # token desain (cermin design/design-system.md)
    widgets.dart           # StatusPill, MoneyText, AppCard, EmptyState, InlineError
    router.dart            # redirect auth + shell 4/5 tab
  features/
    auth/                  # login, aktivasi kode undangan
    home/                  # beranda: banner alert, panic, kas, pengumuman
    panic/                 # panic_button (hold), panic_page, alert_status
    finance/               # tagihan, lapor bayar, kas
    announcements/         # feed + detail
    notifications/         # inbox
    donations/             # kampanye + lapor donasi
    directory/             # direktori minat + WhatsApp
    profile/               # profil, rumah saya (undang keluarga)
    kelola/                # alert, anggota, undangan, pengumuman (staff)
    web_only_page.dart     # platform admin tanpa komunitas → arahkan ke web
    shell.dart             # bottom navigation
```

## Sesi & token

| Hal | Implementasi |
|---|---|
| Access token | di memori (`SessionState`), tidak pernah ke disk |
| Refresh token | `flutter_secure_storage` (key `jagawarga.refresh`) |
| Refresh | single-flight: semua request 401 menunggu satu `Future` refresh, lalu retry sekali |
| Gagal refresh | logout paksa → `/login` |
| Redirect router | belum login → `/login`; belum punya membership → `/activate`; platform admin tanpa komunitas → `/web-only` |
| Logout | `POST /auth/logout` + hapus secure storage + `unsubscribeFromTopic` |

## SSE

`core/events.dart` membuka satu koneksi `GET /api/v1/events/stream` saat shell aktif (setelah login) dan menutupnya saat logout. Header `Authorization` dikirim lewat Dio (`ResponseType.stream`), `receiveTimeout: 0` agar heartbeat 25 detik tidak memutus koneksi. Reconnect backoff 1→2→4→8→30 detik dengan `Last-Event-ID`; setelah reconnect layar memuat ulang `/alerts/active`.

Event yang dipakai: `panic.created`, `panic.updated`, `announcement.published`.

## Push

- `PushService.initialize()` di `main()` bersifat best-effort: bila `google-services.json` tidak ada, `Firebase.initializeApp()` gagal → push dinonaktifkan tanpa mengganggu aplikasi.
- Setelah login: `requestPermission()`, subscribe topic `community_<communityId>`, kirim token ke `POST /auth/me/devices`.
- Foreground notification ditampilkan lewat channel Android `panic` (importance max).
- Tanpa push, panic tetap terlihat selama aplikasi terbuka (SSE) dan tercatat di inbox notifikasi.

## Panic

1. `PanicButton` press-and-hold **1,5 detik** (lepas lebih awal = batal, tanpa request). Progress ring + haptic.
2. GPS best-effort dengan timeout 3 detik; kegagalan GPS tidak menghalangi pengiriman.
3. Sukses → `/panic/:id`. Status di-poll 3 detik dan diperbarui event SSE.
4. Gagal jaringan → dialog **"Sinyal gagal terkirim"** berisi tombol *Coba lagi* **dan** daftar nomor `pengurus/satpam` (`GET /community/staff`) yang bisa ditelepon langsung.
5. Pemicu boleh *Batalkan sinyal* ≤10 detik; petugas *Saya merespons* / *Selesaikan* (ditangani / false alarm).

## Layar

| Tab / rute | Isi |
|---|---|
| `/login`, `/activate` | masuk, aktivasi kode undangan |
| Beranda `/` | banner alert aktif, kartu panic, saldo kas, 3 pengumuman, badge notifikasi |
| `/panic/:id` | layar darurat: status, timeline, aksi |
| Keuangan `/keuangan` | Tagihan (status, lapor bayar + bukti) · Kas (ringkasan, ledger) |
| Warga `/warga` | direktori, cari, filter minat, tombol WhatsApp |
| Profil `/profil` | identitas, ubah profil, tautan rumah/notifikasi/donasi, keluar |
| `/rumah` | anggota rumah + undang keluarga (kode) |
| Kelola (staff) `/kelola` | alert, anggota, kode undangan, pengumuman singkat |
| `/pengumuman`, `/notifikasi`, `/donasi` | feed, inbox, kampanye |
| `/web-only` | arahan ke web admin untuk platform admin |

## Widget layar utama (Android)

- Tiga provider native: `PanicWidgetProvider` (2×2), `BantuanWidgetProvider` (4×2), `InfoWidgetProvider` (4×1) di `android/app/src/main/kotlin/id/my/temancode/jagawarga/widget/`.
- Data: Flutter menulis snapshot kecil ke `SharedPreferences` (`HomeWidgetPreferences`) lewat `WidgetService.sync()`, lalu memicu update ketiga provider. Snapshot berisi status (`safe`/`alert`/`unauthenticated`), rumah, pengumuman terakhir, jumlah/total tagihan, dan jam pembaruan.
- Tap tombol **selalu membuka aplikasi**: `jagawarga:///panic/confirm?type=panic|security|fire|medical` → layar konfirmasi 1,5 detik. Widget tidak pernah mengirim alert sendiri.
- Seluruh kartu juga bisa diketuk (bukan hanya tombol kecil), dengan ripple sebagai umpan balik. Setiap aksi memakai `requestCode` PendingIntent unik agar tidak bertabrakan di launcher tertentu.
- Receiver widget memakai `android:exported="true"` — tanpa itu launcher tidak bisa mengirim `APPWIDGET_UPDATE`, sehingga `onUpdate` tidak pernah jalan dan widget tampil tanpa handler tap. Setelah memperbarui APK, hapus dan pasang ulang widget agar layout baru dipakai.
- Sinkronisasi terjadi saat beranda memuat data (login, SSE panic/pengumuman, pull-to-refresh) dan saat logout (status `unauthenticated`).
- Batasan: belum ada refresh periodik 30 menit (butuh WorkManager), dan widget harus dipasang manual dari launcher (tidak bisa dipasang oleh aplikasi).

## Konfigurasi build

| `--dart-define` | Default | Catatan |
|---|---|---|
| `API_BASE_URL` | `http://10.0.2.2:8787` | `10.0.2.2` = loopback host dari emulator |
| `WEB_ADMIN_URL` | `http://localhost:5173` | ditampilkan di layar `/web-only` |

Izin Android: `INTERNET`, `POST_NOTIFICATIONS`, `ACCESS_FINE/COARSE_LOCATION`. Cleartext HTTP hanya diizinkan untuk `10.0.2.2`, `localhost`, `127.0.0.1` (`network_security_config`); build **debug** mengizinkan IP LAN untuk uji di HP fisik, build release tidak.

```bash
make apk-release APK_API_URL=https://jagawarga.domain.id   # APK rilis untuk API HTTPS
make demo-app                         # emulator + APK + buka app
cd app && flutter run                 # hot reload
cd app && flutter run --dart-define=API_BASE_URL=http://192.168.1.10:8787   # HP fisik
cd app && flutter build apk --debug
```

## Test

| Perintah | Cakupan |
|---|---|
| `flutter test` | 10 test: hold panic (batal & tepat sekali), mapper status alert, format rupiah/periode |
| `flutter analyze` | tanpa error/warning |
| `flutter test integration_test -d <device>` | login → alert realtime (SSE) → layar panic → batalkan/selesaikan; butuh API + data demo |

Catatan: emulator API 36 butuh ruang disk host yang cukup. Saat disk hampir penuh, emulator ANR dan `adb` putus — bersihkan `app/build` dan cache Docker sebelum menyalahkan aplikasi. Lihat [roadmap.md](roadmap.md).

## Konvensi UI

- Token desain dari `core/theme.dart`; jangan menulis warna/ukuran langsung di widget.
- Semua nominal lewat `formatRupiah`/`MoneyText`; semua tanggal lewat `formatDate`/`formatDateTime`/`relativeTime`.
- Teks berbahasa Indonesia, sapaan netral. Status selalu pil berisi ikon + teks (bukan warna saja).
- Aksi destruktif/darurat tidak pernah di dekat aksi biasa.
