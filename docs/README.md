# Dokumentasi Jaga Warga

Aplikasi komunitas warga: panic button realtime, pengumuman, iuran + kas transparan, donasi, direktori minat.

## Mulai dari mana

| Dokumen | Isi | Untuk |
|---|---|---|
| [architecture.md](architecture.md) | komponen, alur request, multi-tenant, uang, realtime | semua engineer |
| [database.md](database.md) | 18 tabel, invariant, indeks, migrasi | backend |
| [api.md](api.md) | konvensi API, daftar endpoint, SSE, contoh `curl` | backend & klien |
| [permissions.md](permissions.md) | matriks role → capability + titik penegakan | backend & review |
| [mobile.md](mobile.md) | struktur app Flutter, auth, SSE, push, panic | mobile |
| [push-notifications.md](push-notifications.md) | setup Firebase, kontrak payload, uji & troubleshooting push | backend/mobile/ops |
| [web-admin.md](web-admin.md) | struktur web React, cookie auth, responsif | frontend web |
| [operations.md](operations.md) | env, compose, deploy, backup, runbook | ops |
| [security.md](security.md) | model ancaman, token, isolasi tenant, batasan | security review |
| [development.md](development.md) | setup, perintah, konvensi, cara menambah fitur | kontributor baru |
| [roadmap.md](roadmap.md) | status terverifikasi, batasan, rencana berikut | product/owner |

Dokumen desain (visual) ada di [`../design/`](../design/): `design-system.md`, `screens-mobile.md`, `screens-web.md`.
Quickstart ada di [`../README.md`](../README.md).

## Aturan dokumentasi

- **Sumber kebenaran**: kode. Dokumen ini menjelaskan *mengapa* dan *kontrak*; bila berbeda, kode menang dan dokumen diperbaiki di PR yang sama.
- Setiap perubahan bentuk request/response wajib memperbarui `server/src/contracts.ts` **dan** [api.md](api.md).
- Setiap perubahan izin wajib memperbarui `server/src/lib/permissions.ts` **dan** [permissions.md](permissions.md) (test `permissions.test.ts` akan gagal bila tidak sinkron dengan perilaku).
