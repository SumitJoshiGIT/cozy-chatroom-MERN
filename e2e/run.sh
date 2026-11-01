#!/bin/bash
# Runs the browser suite on a disposable stack: throwaway Mongo, a temp upload
# folder, the real server, and the production client build. Needs ports 3100
# and 5173 free. Calls use LIVEKIT_URL (default: `docker compose up livekit`).
E2E="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$E2E")"
NAME=lavender-e2e-mongo
if ss -ltn | grep -qE ':(3100|5173)\b'; then echo "ports 3100/5173 are busy"; exit 1; fi
WORK="$(mktemp -d)"
cleanup() {
  [ -n "$SERVER" ] && kill "$SERVER" 2>/dev/null
  [ -n "$PREVIEW" ] && kill "$PREVIEW" 2>/dev/null
  # vite preview runs under npx, so the listener outlives $PREVIEW.
  for pid in $(ss -ltnp | grep -E ':(3100|5173)\b' | grep -oE 'pid=[0-9]+' | cut -d= -f2); do kill "$pid" 2>/dev/null; done
  docker stop "$NAME" >/dev/null 2>&1
  rm -rf "$WORK"
}
trap cleanup EXIT
docker run --rm -d --name "$NAME" -p 127.0.0.1:27119:27017 mongo:7 >/dev/null || exit 1
for _ in $(seq 1 40); do docker exec "$NAME" mongosh --quiet --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1 && break; sleep 0.5; done
export DATABASE=mongodb://127.0.0.1:27119/e2e SESSION_SECRET=e2e-only-secret PORT=3100 VITE_API_ORIGIN=http://localhost:3100 NODE_ENV=development
export CLIENT_ORIGIN=http://localhost:5173 DEMO_ENABLED=true AUTH_RATE_LIMIT=500 UPLOAD_DIR="$WORK/uploads" OTP_FILE="$WORK/otp.txt"
export LIVEKIT_URL="${LIVEKIT_URL:-ws://localhost:7880}" LIVEKIT_API_KEY="${LIVEKIT_API_KEY:-devkey}" LIVEKIT_API_SECRET="${LIVEKIT_API_SECRET:-secret}"
mkdir -p "$UPLOAD_DIR"
(cd "$ROOT/server" && exec node -r "$E2E/stub-mail.js" app.js) > "$WORK/server.log" 2>&1 &
SERVER=$!
(cd "$ROOT/client" && npx vite build >"$WORK/vite.log" 2>&1) || { echo "client build failed"; tail -20 "$WORK/vite.log"; exit 1; }
(cd "$ROOT/client" && exec npx vite preview --port 5173 --strictPort) >> "$WORK/vite.log" 2>&1 &
PREVIEW=$!
for _ in $(seq 1 40); do curl -s -m 1 localhost:3100/ping >/dev/null && curl -s -m 1 -o /dev/null localhost:5173 && break; sleep 0.4; done
# Docker's new interface can abort Chromium's first requests with ERR_NETWORK_CHANGED.
sleep 4
cd "$E2E" && node e2e.js
rc=$?
echo "server handler errors: $(grep -c 'handler failed' "$WORK/server.log")"
grep 'handler failed' "$WORK/server.log" | cut -c1-240 | head -5
exit $rc
