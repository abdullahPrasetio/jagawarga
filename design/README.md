# Jaga Warga — Catatan keputusan desain

Arah visual: tenang + tepercaya (bukan startup ramai). Latar kertas hangat `#F7F6F2`, satu brand hijau tua `#14532D`, merah `#DC2626` hanya untuk darurat.

Keputusan yang mengikat implementasi:
1. Panic = komponen, bukan tombol: kartu `brand.900` + lingkaran 200dp + hold 1,5 detik; tanpa bottom nav saat aktif; tidak ada aksi lain di dekatnya.
2. Semua nominal memakai `money` (tabular, rata kanan). Pil status selalu teks + ikon, tidak pernah warna saja.
3. Web admin: sidebar hijau tua, tabel padat, panel tinjau 420 dari kanan; editor pengumuman menampilkan preview kartu mobile.
4. Satu sumber token untuk Flutter dan React: `design-system.md` → `app/lib/core/theme.dart` + `web/src/design/tokens.ts`.
5. Tipografi: web Inter (bundled), mobile Roboto (sistem) dengan skala identik; tidak ada teks < 12px.

Token, anatomi komponen, dan spesifikasi tiap layar ada di `design-system.md`, `screens-mobile.md`, `screens-web.md`.
