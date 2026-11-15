# Izin (role → capability)

Sumber kebenaran: `server/src/lib/permissions.ts` (`MATRIX`). Dokumen ini harus identik dengan tabel tersebut; `server/test/permissions.test.ts` memeriksa kesesuaiannya untuk semua kombinasi role × capability.

## Role

| Role | Cakupan |
|---|---|
| `platformAdmin` | klaim khusus, bukan role komunitas. Hanya `/admin/*`. Butuh `join` + `switch-community` untuk menyentuh data komunitas |
| `admin` | pemilik/pengelola komunitas; lolos semua capability komunitas |
| `pengurus` | operasional: anggota, undangan, pengumuman, alert |
| `bendahara` | keuangan: tagihan, verifikasi pembayaran, ledger, review donasi |
| `satpam` | alert: acknowledge/resolve + baca |
| `warga` | data sendiri, rumah sendiri, baca komunitas |

Satu akun bisa punya role berbeda di komunitas berbeda (`memberships`). Role aktif ditentukan oleh token (`switch-community`).

## Matriks

Legenda: `pengurus+` = `admin` atau `pengurus`; `head` = hanya `is_household_head` rumahnya; `self` = data sendiri; `rumah sendiri` = anggota rumah yang sama; `pemicu` = pembuat alert.

| Capability | admin | pengurus | bendahara | satpam | warga | Route |
|---|:-:|:-:|:-:|:-:|:-:|---|
| `community.read` | ✓ | ✓ | ✓ | ✓ | ✓ | GET `/community`, `/community/staff` |
| `houses.read` | ✓ | ✓ | – | – | – | GET `/houses` |
| `houses.import` | ✓ | ✓ | – | – | – | POST `/houses/batch` |
| `members.read` | ✓ | ✓ | – | – | – | GET `/members` |
| `members.manage` | ✓ | ✓ | – | – | – | PATCH `/members/:id`, reset password |
| `household.read` | self | self | self | self | self | GET `/me/household` |
| `household.invite` | head | head | head | head | head | POST `/invites/household` |
| `invites.staff` | ✓ | ✓ | – | – | – | GET/POST `/invites` |
| `invites.revoke` | ✓ | ✓ | pembuat | pembuat | pembuat | POST `/invites/:id/revoke` |
| `directory.read` | ✓ | ✓ | ✓ | ✓ | ✓ | GET `/directory` |
| `profile.update` | self | self | self | self | self | PATCH `/auth/me/profile` |
| `alert.create` | ✓ | ✓ | ✓ | ✓ | ✓ | POST `/alerts` |
| `alerts.read` | ✓ | ✓ | ✓ | ✓ | ✓ | GET `/alerts*` |
| `alert.acknowledge` | ✓ | ✓ | – | ✓ | – | POST `/alerts/:id/acknowledge` |
| `alert.resolve` | ✓ | ✓ | – | ✓ | pemicu | POST `/alerts/:id/resolve` |
| `alert.cancel` | pemicu | pemicu | pemicu | pemicu | pemicu | POST `/alerts/:id/cancel` (≤10 s) |
| `events.stream` | ✓ | ✓ | ✓ | ✓ | ✓ | GET `/events/stream` |
| `announcements.read` | ✓ | ✓ | ✓ | ✓ | ✓ | GET `/announcements*` |
| `announcements.write` | ✓ | ✓ | – | – | – | POST/PATCH/publish/DELETE |
| `media.upload` | ✓ | ✓ | ✓ | ✓ | ✓ | POST `/media` |
| `media.read` | ✓ | ✓ | ✓ | ✓ | ✓ | GET `/media/:id/raw` |
| `invoices.read` | ✓ | ✓ | ✓ | – | rumah sendiri | GET `/finance/invoices` |
| `invoices.create` | ✓ | ✓ | ✓ | – | – | POST `/finance/invoices/batch` |
| `payments.report` | ✓ | ✓ | ✓ | – | rumah sendiri | POST `/finance/invoices/:id/payments` |
| `payments.review` | ✓ | ✓ | ✓ | – | – | POST `/finance/payments/:id/review` |
| `ledger.read` | ✓ | ✓ | ✓ | – | ✓ | GET `/finance/summary`, `/finance/ledger` |
| `ledger.write` | ✓ | ✓ | ✓ | – | – | POST `/finance/ledger` |
| `campaigns.read` | ✓ | ✓ | ✓ | ✓ | ✓ | GET `/campaigns*` |
| `campaigns.write` | ✓ | ✓ | ✓ | – | – | POST `/campaigns` |
| `donations.report` | ✓ | ✓ | ✓ | – | ✓ | POST `/campaigns/:id/donations` |
| `donations.review` | ✓ | ✓ | ✓ | – | – | POST `/campaign-donations/:id/review` |
| `platform.*` | platformAdmin | – | – | – | – | `/admin/*` |

Perilaku yang mudah salah:

- `bendahara` **tidak** boleh menerbitkan pengumuman (hanya `admin`/`pengurus`).
- `pengurus` **boleh** memverifikasi pembayaran: `payments.review` mencakup `pengurus` agar operasional tidak macet saat bendahara berhalangan.
- `satpam` tidak punya akses keuangan apa pun (termasuk ringkasan kas), tetapi boleh melihat alert dan direktori.
- `warga` boleh membaca **seluruh** buku kas (transparansi) tetapi hanya tagihan rumahnya sendiri.

## Penegakan

Dua lapis, keduanya wajib:

1. **Role** — `ensure(auth, 'capability')` di setiap handler (tidak ada cek role inline).
2. **Kepemilikan** — helper eksplisit yang **tidak** di-bypass `admin`:
   - `assertOwnHouse(auth, houseId)` untuk tagihan/pembayaran warga,
   - `isHouseholdHead` untuk undangan keluarga,
   - `triggeredBy === auth.userId` untuk cancel/resolve pemicu.

Catatan untuk `household.read`: `MATRIX` mengizinkan semua role, tetapi handler hanya mengembalikan anggota **rumah pemanggil** (bukan parameter), sehingga kolom tabel ditulis `self`.

Catatan: `can()` memberi `admin` bypass untuk capability komunitas, tetapi handler tetap memanggil cek kepemilikan, sehingga admin tidak otomatis bisa membatalkan alert orang lain atau mengundang anggota ke rumah yang bukan rumahnya (kecuali memang kepala keluarga di rumah itu).

## Platform admin

- Tidak punya capability komunitas sampai ia `join` (membuat membership `admin`) atau diundang sebagai `admin`.
- `switch-community` untuk platform admin otomatis membuat membership `admin` + menulis `audit_logs` (`community.join`).
- `POST /admin/communities`, `PATCH` (suspend/aktifkan), `join` semuanya diaudit.

## Mengubah izin

1. Ubah `MATRIX` di `server/src/lib/permissions.ts`.
2. Perbarui tabel di dokumen ini dan [api.md](api.md) bila route baru.
3. Jalankan `cd server && bun test` — `permissions.test.ts` memastikan tabel, `can()`, dan perilaku HTTP sinkron.
4. Bila capability baru: tambahkan tipe di `Capability`, pasang `ensure()` di handler, dan tambah baris di tabel.
