#!/usr/bin/env bash
set -euo pipefail

kiosk_url="${CTG_ENGAGE_URL:-http://127.0.0.1:8080/}"
profile_directory="${HOME}/.config/ctg-engage-kiosk"

mkdir -p "${profile_directory}"
chmod 0700 "${profile_directory}"

for attempt in {1..30}; do
  if curl --fail --silent "${kiosk_url}api/health" >/dev/null; then
    break
  fi
  sleep 1
done

exec chromium \
  --user-data-dir="${profile_directory}" \
  --password-store=basic \
  --disable-sync \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --disable-session-crashed-bubble \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --start-maximized \
  "${kiosk_url}"
