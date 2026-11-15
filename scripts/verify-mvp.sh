#!/usr/bin/env bash
# Verifikasi end-to-end MVP Jaga Warga.
# Prasyarat: Postgres jalan (make db), .env terisi, API belum berjalan di :8787.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_URL="http://localhost:8787/api/v1"
DB_URL="$(grep -E '^TEST_DATABASE_URL=' .env | cut -d= -f2-)"
DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)"

say() { printf '\n\033[1m== %s\033[0m\n' "$1"; }
fail() { printf '\033[31mFAIL: %s\033[0m\n' "$1"; exit 1; }
expect() { [ "$1" = "$2" ] || fail "$3 (dapat: $1, harap: $2)"; }

if curl -sf "$API_URL/health" >/dev/null 2>&1; then
  fail "API sudah berjalan di :8787. Hentikan 'make dev' dulu, lalu ulangi."
fi

say "reset database + migrasi + seed"
psql "$DATABASE_URL" -q -c 'drop schema if exists public cascade; create schema public;'
psql "$DATABASE_URL" -q -c 'drop schema if exists drizzle cascade;'
(cd server && bun run db:migrate >/dev/null)
(cd server && bun run seed | head -1)

say "jalankan API"
(cd server && bun src/index.ts >/tmp/jagawarga-api.log 2>&1) &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  if curl -sf "$API_URL/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
curl -sf "$API_URL/health" >/dev/null || fail "API tidak siap"

login() {
  curl -s -X POST "$API_URL/auth/login" -H 'content-type: application/json' \
    -d "{\"phone\":\"$1\",\"password\":\"Rahasia123!\"}" | jq -r .accessToken
}

WARGA=$(login 081100000005)
SATNAM=$(login 081100000004)
BENDAHARA=$(login 081100000003)

say "undangan → aktivasi user baru"
CODE=$(curl -s -X POST "$API_URL/invites/household" -H "Authorization: Bearer $WARGA" | jq -r .code)
expect "${#CODE}" "8" "kode undangan harus 8 karakter"
NEW_USER=$(curl -s -X POST "$API_URL/auth/activate" -H 'content-type: application/json' \
  -d "{\"inviteCode\":\"$CODE\",\"name\":\"Warga Baru\",\"phone\":\"081199900099\",\"password\":\"Rahasia123!\"}")
echo "$NEW_USER" | jq -e '.accessToken' >/dev/null || fail "aktivasi gagal: $NEW_USER"

say "panic + SSE +respons"
curl -s -N --max-time 6 -H "Authorization: Bearer $SATNAM" "$API_URL/events/stream" >/tmp/sse.out &
SSE_PID=$!
sleep 1
ALERT=$(curl -s -X POST "$API_URL/alerts" -H "Authorization: Bearer $WARGA" \
  -H 'content-type: application/json' -d '{"message":"maling di pagar"}')
ALERT_ID=$(echo "$ALERT" | jq -r .id)
expect "$(echo "$ALERT" | jq -r .status)" "active" "panic harus active"
wait $SSE_PID 2>/dev/null || true
grep -q "panic.created" /tmp/sse.out || fail "SSE tidak menerima panic.created"

ACK=$(curl -s -X POST "$API_URL/alerts/$ALERT_ID/acknowledge" -H "Authorization: Bearer $SATNAM")
expect "$(echo "$ACK" | jq -r .status)" "acknowledged" "acknowledge gagal"

say "tagihan → lapor bayar → approve → ledger"
PERIOD=$(date -v+2m +%Y-%m 2>/dev/null || date -d '+2 month' +%Y-%m)
BATCH=$(curl -s -X POST "$API_URL/finance/invoices/batch" -H "Authorization: Bearer $BENDAHARA" \
  -H 'content-type: application/json' \
  -d "{\"period\":\"$PERIOD\",\"title\":\"Iuran uji $PERIOD\",\"amount\":150000,\"dueDate\":\"$PERIOD-28\"}")
expect "$(echo "$BATCH" | jq -r .created)" "5" "harus membuat 5 tagihan"

INVOICE=$(curl -s "$API_URL/finance/invoices?period=$PERIOD" -H "Authorization: Bearer $WARGA" | jq -r '.items[0].id')
PAYMENT=$(curl -s -X POST "$API_URL/finance/invoices/$INVOICE/payments" -H "Authorization: Bearer $WARGA" \
  -H 'content-type: application/json' -d '{"amount":150000,"note":"uji"}')
PAYMENT_ID=$(echo "$PAYMENT" | jq -r .id)
expect "$(echo "$PAYMENT" | jq -r .status)" "pending" "pembayaran harus pending"

REVIEW=$(curl -s -X POST "$API_URL/finance/payments/$PAYMENT_ID/review" -H "Authorization: Bearer $BENDAHARA" \
  -H 'content-type: application/json' -d '{"action":"approve"}')
expect "$(echo "$REVIEW" | jq -r .status)" "approved" "approve gagal"

STATUS=$(curl -s "$API_URL/finance/invoices?period=$PERIOD" -H "Authorization: Bearer $WARGA" | jq -r '.items[0].status')
expect "$STATUS" "paid" "tagihan harus paid"

LEDGER_COUNT=$(curl -s "$API_URL/finance/ledger" -H "Authorization: Bearer $BENDAHARA" \
  | jq '[.items[] | select(.source == "iuran")] | length')
expect "$LEDGER_COUNT" "1" "ledger iuran harus tepat 1 baris"

RECHECK=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API_URL/finance/payments/$PAYMENT_ID/review" \
  -H "Authorization: Bearer $BENDAHARA" -H 'content-type: application/json' -d '{"action":"approve"}')
expect "$RECHECK" "409" "approve ulang harus 409"

say "platform admin"
PLATFORM=$(curl -s -X POST "$API_URL/auth/login" -H 'content-type: application/json' \
  -d '{"phone":"081100000001","password":"Rahasia123!"}')
expect "$(echo "$PLATFORM" | jq -r .membership)" "null" "platform admin login tanpa komunitas"
PLATFORM_TOKEN=$(echo "$PLATFORM" | jq -r .accessToken)

COMMUNITY=$(curl -s -X POST "$API_URL/admin/communities" -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H 'content-type: application/json' -d '{"name":"Kampung Verifikasi","slug":"verifikasi"}')
COMMUNITY_ID=$(echo "$COMMUNITY" | jq -r .community.id)
curl -s -X POST "$API_URL/admin/communities/$COMMUNITY_ID/join" -H "Authorization: Bearer $PLATFORM_TOKEN" >/dev/null
SWITCHED=$(curl -s -X POST "$API_URL/auth/switch-community" -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H 'content-type: application/json' -d "{\"communityId\":\"$COMMUNITY_ID\"}")
expect "$(echo "$SWITCHED" | jq -r .membership.role)" "admin" "join komunitas baru harus role admin"

say "transport cookie web"
COOKIE_HEADERS=$(curl -si -X POST "$API_URL/auth/login" -H 'content-type: application/json' \
  -H 'X-Client: web' -H 'Origin: http://localhost:5173' \
  -d '{"phone":"081100000002","password":"Rahasia123!"}')
echo "$COOKIE_HEADERS" | grep -qi 'set-cookie: jagawarga_refresh=' || fail "cookie refresh tidak diset"
echo "$COOKIE_HEADERS" | grep -q '"refreshToken"' && fail "refreshToken tidak boleh ada di body web"

printf '\n\033[32mVERIFY OK\033[0m\n'
