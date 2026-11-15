# Keamanan

Dokumen ini mencatat kontrol yang **sudah ada** dan batasan yang **diketahui**. Ini bukan jaminan; lakukan review sendiri sebelum produksi.

## Aset & batas kepercayaan

| Aset | Dampak bila bocor/dirusak |
|---|---|
| Data warga (nama, nomor HP, rumah) | privasi, target penipuan |
| Alert panic + lokasi | keselamatan jiwa |
| Kas & bukti bayar | sengketa keuangan, tuduhan korupsi |
| Kredensial akun | pengambilalihan peran bendahara/pengurus |
| `JWT_SECRET`, service account FCM | pemalsuan sesi / spam push |

Batas kepercayaan: klien tidak dipercaya; hanya API yang memegang kredensial DB. Caddy adalah satu-satunya pintu masuk publik.

## Kontrol

| Area | Implementasi |
|---|---|
| Password | argon2id via `Bun.password` (default cost); minimal 8 karakter; tidak pernah di-log |
| Access token | JWT HS256, 15 menit, klaim `sub/communityId/role/houseId/platformAdmin` |
| Refresh token | 32 byte acak + payload `{u,c}`, disimpan **hash SHA-256** di `sessions`; rotasi setiap refresh; token lama dicabut (replay → 401) |
| Cookie web | `HttpOnly; SameSite=Strict; Path=/api/v1/auth`; `Secure` bila `PUBLIC_BASE_URL` https; access token hanya di memori |
| Mobile | refresh token di `flutter_secure_storage` (Keychain/Keystore), bukan SharedPreferences. Hanya penolakan server (401/403) yang menghapus sesi; gangguan jaringan tidak, sehingga koneksi jelek tidak memaksa logout |
| Otorisasi | dua lapis: `ensure(capability)` (role) + cek kepemilikan eksplisit ([permissions.md](permissions.md)) |
| Isolasi tenant | `community_id` selalu dari token; entitas lintas tenant → **404** (bukan 403) agar keberadaan data tidak bocor |
| Suspend | `withCommunity` membaca DB tiap request → anggota komunitas nonaktif/ter-suspend langsung ditolak |
| Undangan | 8 karakter alfabet bebas ambigu, sekali pakai, kedaluwarsa (staff 30 hari, household 7 hari), batas 5 kode aktif/rumah, kapasitas 6 anggota/rumah |
| Unggah | ≤5 MB, hanya JPEG/PNG/WebP diverifikasi dari magic bytes, nama file dibuat server (UUID), kuota 10/hari, sisa disk <1 GB ditolak |
| Akses media | `GET /media/:id/raw` memeriksa membership komunitas; URL memakai UUID acak + `Cache-Control: private` |
| Rate limit | login per IP & per nomor, aktivasi, buat panic, kode undangan, unggah, lapor bayar/donasi |
| Audit | aksi platform admin (`community.create/join/suspend/activate`) tercatat di `audit_logs` |
| Log | hanya error tak tertangani + adapter push; body request/token tidak dicatat |

Keputusan yang perlu dipahami:

- **Tidak ada CSRF token.** Cookie refresh dibatasi `Path=/api/v1/auth` dan `SameSite=Strict`, hanya dipakai endpoint refresh/logout yang tidak mengubah data bisnis; semua mutasi memakai bearer token dari memori. Bila kelak memakai cookie untuk seluruh API, tambahkan proteksi CSRF.
- **Login tidak mengungkap akun.** Nomor tidak dikenal dan password salah sama-sama `401` “Nomor HP atau password salah”.
- **Reset password manual** oleh pengurus mengembalikan password sementara **sekali** di response; tidak disimpan plaintext dan tidak di-log.

## Batasan yang diketahui

| Batasan | Risiko | Mitigasi sekarang |
|---|---|---|
| RLS Postgres belum aktif | bug query tanpa `community_id` bisa bocor antar kampung | semua query lewat helper ber-`communityId`; test `tenant.test.ts` |
| Rate limit per IP bisa dipalsukan via `X-Forwarded-For` | menembus batas per IP (batas per nomor tetap berlaku) | pastikan proxy menimpa header; tambahkan normalisasi XFF sebelum produksi |
| Tidak ada 2FA | akun bendahara bisa diambil alih via password | password kuat + reset manual oleh pengurus; 2FA di [roadmap.md](roadmap.md) |
| Platform admin dapat `join` komunitas mana pun | akses luas oleh operator | selalu diaudit; batasi jumlah platform admin |
| Tidak ada antivirus/scan berkas | gambar berbahaya (polyglot) | magic bytes + `Content-Type` dari DB + `X-Content-Type-Options: nosniff`; simpan di luar webroot |
| EXIF tidak dibersihkan | kebocoran lokasi pada foto | klien mengompres (menghapus sebagian metadata); pembersihan server di roadmap |
| Tanpa backup otomatis | kehilangan data | prosedur backup manual di [operations.md](operations.md) |
| Satu instance, state di memori | restart menghapus buffer SSE | klien reconnect + memuat `/alerts/active` |

## Checklist hardening produksi

- [ ] `JWT_SECRET` acak ≥32 byte, berbeda per environment, disimpan di secret manager.
- [ ] `CORS_ORIGINS` hanya origin web produksi; `APP_ENV=production`.
- [ ] HTTPS wajib (Caddy TLS) → cookie otomatis `Secure`.
- [ ] Batasi akses `/admin/*` ke akun yang benar-benar operator (audit `is_platform_admin`).
- [ ] Backup DB + media harian, retensi ≥30 hari, uji restore.
- [ ] Monitoring `/health`, disk, dan alert yang tak terselesaikan.
- [ ] Rotasi kredensial FCM bila pernah bocor.
- [ ] Review `audit_logs` berkala.
