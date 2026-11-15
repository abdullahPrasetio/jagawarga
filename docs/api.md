# API

Base URL: `http://localhost:8787/api/v1` (dev) — produksi lewat Caddy di `https://<domain>/api/v1`.

## Konvensi

| Hal | Aturan |
|---|---|
| Autentikasi | `Authorization: Bearer <accessToken>` (JWT HS256, 15 menit) |
| Content-Type | `application/json`; unggah berkas `multipart/form-data` |
| Error | `application/problem+json`: `{ type, title, status, detail, code, issues? }` |
| Sukses hapus/aksi | `{ "ok": true }` |
| Pagination | hanya route tertentu (alert, pengumuman, notifikasi): `?cursor=&limit=` → `{ items, nextCursor }` |
| Waktu | ISO 8601 UTC; tanggal (`date`) `YYYY-MM-DD`; periode `YYYY-MM` |
| Uang | integer rupiah (tanpa sen) |
| Header klien | `X-Client: web` mengubah transport refresh token (lihat di bawah) |

Kode error: `unauthorized`, `forbidden`, `not_found`, `validation_failed`, `conflict`, `rate_limited`, `invite_invalid`, `alert_active`, `no_community`, `community_suspended`, `payload_too_large`, `insufficient_storage`, `household_full`.

Rate limit (in-memory, per instance):

| Aksi | Batas |
|---|---|
| Login per IP / per nomor | 20 / menit, 10 / menit |
| Aktivasi per nomor | 10 / menit |
| Buat panic per pengguna | 5 / menit + 1 alert aktif + jeda 30 detik |
| Buat kode undangan staff | 20 / menit |
| Unggah media per pengguna | 10 / hari |
| Lapor bayar / donasi per pengguna | 20 / hari |

## Transport token

- **Mobile**: `POST /auth/login` → `{ accessToken, refreshToken, expiresIn }`; refresh token disimpan di secure storage.
- **Web**: kirim header `X-Client: web` → body login **tanpa** `refreshToken`; token refresh diset sebagai cookie `jagawarga_refresh` (`HttpOnly; SameSite=Strict; Path=/api/v1/auth; Secure` bila `PUBLIC_BASE_URL` https). `POST /auth/refresh` dengan body kosong membaca cookie.
- Rotasi: setiap refresh mencabut sesi lama (`sessions.revoked_at`) dan menerbitkan token baru. Replay token lama → 401.

## Auth (`/auth`)

| Metode | Path | Body | Keterangan |
|---|---|---|---|
| POST | `/auth/activate` | `{ inviteCode, name, phone, password }` | Kode sekali pakai; mewarisi role + rumah dari undangan |
| POST | `/auth/login` | `{ phone, password, communityId? }` | `communityId` wajib bila akun punya >1 membership (400 + `memberships` di body) |
| POST | `/auth/refresh` | `{ refreshToken? }` | Web: cookie. Rotasi token |
| POST | `/auth/logout` | `{ refreshToken? }` | Mencabut sesi + menghapus cookie |
| GET | `/auth/me` | — | `{ user, membership, memberships, community }` |
| PATCH | `/auth/me/profile` | `{ name?, bio?, interests?[], directoryVisible?, avatarMediaId? }` | Profil |
| POST | `/auth/me/devices` | `{ token, platform: android\|ios }` | Daftar device FCM (upsert per token) |
| POST | `/auth/switch-community` | `{ communityId }` | Token baru untuk komunitas lain; platform admin otomatis `join` sebagai `admin` |

`POST /auth/login` platform admin tanpa `communityId` → `membership: null`, `platformAdmin` benar di klaim.

```bash
TOKEN=$(curl -s -X POST localhost:8787/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"phone":"081100000005","password":"Rahasia123!"}' | jq -r .accessToken)
```

## Platform admin (`/admin`)

Semua route di bawah ini hanya untuk klaim `platformAdmin`.

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/admin/communities?q=` | Daftar komunitas + `memberCount`, `houseCount`, `mediaBytes` |
| POST | `/admin/communities` | `{ name, slug, address? }` → komunitas + `inviteCode` (role `admin`, 30 hari) |
| PATCH | `/admin/communities/:id` | `{ name?, isActive? }`; suspend/aktifkan menulis `audit_logs` |
| POST | `/admin/communities/:id/join` | Membership `admin` untuk diri sendiri (idempoten, diaudit) |
| GET | `/admin/stats` | `{ communities, users, mediaCount, mediaBytes, alerts24h }` |
| POST | `/admin/push-test` | `{ communityId, audience?: community\|responders }` → `{ adapter, topic, ok, error }` (uji kredensial FCM) |

## Komunitas, rumah, anggota

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/community` | Info + jumlah anggota/rumah |
| GET | `/community/staff` | Nama + telepon `admin/pengurus/satpam` (untuk fallback telepon saat panic gagal) |
| GET | `/houses` | Daftar rumah (pengurus+) |
| POST | `/houses/batch` | `{ items: [{ block, number, label? }] }` → `{ created, skipped }` |
| GET | `/members?q=&houseId=` | Daftar anggota + role + kepala keluarga (pengurus+) |
| PATCH | `/members/:id` | `{ role?, houseId?, isActive?, isHouseholdHead? }`; role `admin` hanya oleh `admin`; kepala keluarga unik per rumah |
| POST | `/members/:id/reset-password` | → `{ temporaryPassword }` (sekali tampil, tidak disimpan plaintext) |
| GET | `/me/household` | Anggota satu rumah + `headName` |
| GET | `/directory?q=&interest=` | Direktori warga (hanya `directoryVisible`), termasuk `waNumber` |

## Undangan

| Metode | Path | Keterangan |
|---|---|---|
| POST | `/invites` | `{ role, houseId? }` — kind `staff`, 30 hari, sekali pakai |
| POST | `/invites/household` | Khusus `is_household_head`; role dipaksa `warga`, rumah sendiri, 7 hari |
| GET | `/invites` | Kode staff komunitas (pengurus+) |
| GET | `/invites/household` | Kode household milik pemanggil yang belum terpakai |
| POST | `/invites/:id/revoke` | Pembuat kode atau pengurus+ |

Batas: maks **5 kode household aktif per rumah**, maks **6 anggota aktif per rumah** (409 `household_full` saat aktivasi).

## Alert & SSE

| Metode | Path | Keterangan |
|---|---|---|
| POST | `/alerts` | `{ houseId?, message?, lat?, lng?, kind? }` → alert `active`; `kind`: `panic` (default), `security`, `fire`, `medical` |
| GET | `/alerts?status=&cursor=&limit=` | Riwayat (paginasi) |
| GET | `/alerts/active` | Alert `active`/`acknowledged` (≤10) |
| GET | `/alerts/:id` | Detail + `events[]` (timeline) |
| POST | `/alerts/:id/acknowledge` | `pengurus`/`satpam`/`admin` |
| POST | `/alerts/:id/resolve` | `{ resolution: handled\|false_alarm, note? }` — petugas **atau** pemicu |
| POST | `/alerts/:id/cancel` | Pemicu, ≤10 detik |
| GET | `/events/stream` | SSE (`text/event-stream`) |

```bash
# stream (terminal 1)
curl -N -H "Authorization: Bearer $TOKEN" localhost:8787/api/v1/events/stream
# picu panic (terminal 2)
curl -s -X POST localhost:8787/api/v1/alerts -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"message":"maling di pagar"}'
```

Event SSE: `ready`, `ping`, `panic.created`, `panic.updated`, `announcement.published`. Setiap alert juga menulis event timeline `notified` berisi hasil pengiriman push.

Push: judul per jenis (`🚨 PANIC`, `🚨 MALING`, `🔥 KEBAKARAN`, `🚑 MEDIS`), `tag=alertId` (update menggantikan notifikasi lama), topic `community_<id>` + `community_<id>_responders` untuk pengurus/satpam. Setiap frame punya `id`; kirim `Last-Event-ID` saat reconnect untuk replay (buffer 100 event).

## Pengumuman

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/announcements?category=&includeDrafts=&cursor=&limit=` | `includeDrafts=true` hanya efektif untuk pengurus/admin |
| GET | `/announcements/:id` | Detail |
| POST | `/announcements` | `{ title, body, category, isPinned?, attachmentMediaId? }` → draf |
| PATCH | `/announcements/:id` | Ubah isi |
| POST | `/announcements/:id/publish` | Set `published_at`, tulis inbox + push + SSE |
| DELETE | `/announcements/:id` | Hapus |

`category`: `umum`, `keamanan`, `kegiatan`, `darurat`.

## Notifikasi

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/notifications?cursor=&limit=` | Inbox milik pemanggil |
| GET | `/notifications/unread-count` | `{ count }` |
| POST | `/notifications/:id/read` | Tandai dibaca |

## Media

| Metode | Path | Keterangan |
|---|---|---|
| POST | `/media` | `multipart/form-data` field `file` (≤5 MB, JPEG/PNG/WebP) → `{ id, url, mime, bytes }` |
| GET | `/media/:id/raw` | Byte gambar; wajib anggota komunitas yang sama |

## Keuangan

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/finance/invoices?status=&period=&houseId=` | Warga: hanya rumahnya sendiri |
| POST | `/finance/invoices/batch` | `{ period, title, amount, dueDate, houseIds? }` → `{ created, skipped }` |
| GET | `/finance/invoices/:id/payments` | Riwayat laporan untuk satu tagihan |
| POST | `/finance/invoices/:id/payments` | `amount`, `note?`, `file?` (multipart **atau** JSON) → laporan `pending` |
| GET | `/finance/payments?status=&houseId=` | Daftar laporan (bendahara/pengurus/admin) |
| GET | `/finance/payments/:id` | Detail laporan |
| POST | `/finance/payments/:id/review` | `{ action: approve\|reject, note? }`; reject wajib catatan |
| GET | `/finance/summary?from=&to=` | `{ opening, income, expense, closing, byCategory }` |
| GET | `/finance/ledger?from=&to=&category=` | Buku kas (semua anggota kecuali satpam) |
| POST | `/finance/ledger` | `{ direction, category, amount, occurredOn, description, attachmentMediaId? }` |

```bash
# lapor bayar tanpa berkas (JSON juga diterima)
curl -s -X POST localhost:8787/api/v1/finance/invoices/$INVOICE/payments \
  -H "Authorization: Bearer $WARGA" -H 'content-type: application/json' \
  -d '{"amount":150000,"note":"transfer BCA"}'
```

Approve kedua → 409 `conflict`; ledger tidak bertambah.

## Donasi

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/campaigns?status=` | Daftar + progres |
| POST | `/campaigns` | `{ title, description, targetAmount, deadline?, coverMediaId? }` |
| GET | `/campaigns/:id` | Detail + `donations[]` terverifikasi (anonim disamarkan) |
| POST | `/campaigns/:id/donations` | `amount`, `donorName?`, `isAnonymous?`, `file?` |
| GET | `/campaign-donations?status=` | Daftar laporan donasi (bendahara/pengurus/admin) |
| POST | `/campaign-donations/:id/review` | `{ action, note? }`; approve menulis ledger kategori `donasi` |

## Health

`GET /health` → `{ ok: true, db: "up" }` (503 bila DB tidak terjangkau). Tidak butuh auth.
