#!/usr/bin/env bash
# Menyalakan emulator (bila perlu), memasang APK debug, lalu membuka aplikasi.
# Prasyarat: API berjalan di :8787 dan data demo sudah di-seed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"
AVD="${AVD:-Medium_Phone_API_36.0}"
APK="app/build/app/outputs/flutter-apk/app-debug.apk"

if ! curl -sf http://localhost:8787/api/v1/health >/dev/null 2>&1; then
  echo "API belum berjalan. Jalankan 'make dev' di terminal lain, lalu ulangi." >&2
  exit 1
fi

if ! "$ADB" devices | grep -q "emulator-5554"; then
  echo "Menyalakan emulator $AVD…"
  nohup "$EMULATOR" -avd "$AVD" -gpu host -no-audio -no-boot-anim >/tmp/jagawarga-emulator.log 2>&1 &
fi

echo "Menunggu emulator siap…"
"$ADB" wait-for-device
for _ in $(seq 1 90); do
  if [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then break; fi
  sleep 2
done

if [ ! -f "$APK" ]; then
  echo "APK belum ada, membangun…"
  (cd app && flutter build apk --debug)
fi

echo "Memasang aplikasi…"
"$ADB" install -r "$APK" >/dev/null

echo "Membuka Jaga Warga…"
"$ADB" shell am start -n id.jagawarga.app/.MainActivity >/dev/null

cat <<'EOF'

Aplikasi terbuka di emulator. Login warga:
  081100000005 / Rahasia123!   (Blok A No. 3, kepala keluarga)

Coba alur panic:
  1. Tekan-tahan tombol merah 1,5 detik.
  2. Di web (http://localhost:5173, login 081100000003 / Rahasia123!)
     buka menu Alert — alert muncul langsung, tekan "Saya merespons".
EOF
