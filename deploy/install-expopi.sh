#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

package_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install_root="/opt/ctg-engage"
service_file="/etc/systemd/system/ctg-engage.service"

if [[ ! -f "${package_root}/bin/ctg-engage" || ! -f "${package_root}/www/index.html" || ! -f "${package_root}/launch-kiosk.sh" ]]; then
  echo "The CTG Engage package is incomplete." >&2
  exit 1
fi

if ! getent group ctg-engage >/dev/null; then
  groupadd --system ctg-engage
fi
if ! id ctg-engage >/dev/null 2>&1; then
  useradd --system --gid ctg-engage --home-dir /var/lib/ctg-engage --shell /usr/sbin/nologin ctg-engage
fi

install -d -m 0755 "${install_root}/bin" "${install_root}/www"
install -m 0755 "${package_root}/bin/ctg-engage" "${install_root}/bin/ctg-engage"
install -m 0755 "${package_root}/launch-kiosk.sh" "${install_root}/bin/ctg-engage-kiosk"
cp -a --no-preserve=mode,ownership "${package_root}/www/." "${install_root}/www/"
find "${install_root}/www" -type d -exec chmod 0755 {} +
find "${install_root}/www" -type f -exec chmod 0644 {} +
chown -R root:root "${install_root}"
chmod -R go-w "${install_root}"

install -m 0644 "${package_root}/systemd/ctg-engage.service" "${service_file}"
systemctl daemon-reload
systemctl enable ctg-engage.service
systemctl restart ctg-engage.service

for attempt in {1..10}; do
  if curl --fail --silent http://127.0.0.1:8080/api/health >/dev/null; then
    echo "CTG Engage is running at http://127.0.0.1:8080"
    exit 0
  fi
  sleep 1
done

systemctl --no-pager --full status ctg-engage.service >&2
exit 1
