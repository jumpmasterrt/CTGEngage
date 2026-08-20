#!/usr/bin/env bash
set -euo pipefail

operator_user="ctgga"
operator_home="/home/${operator_user}"
autostart_directory="${operator_home}/.config/labwc"
autostart_file="${autostart_directory}/autostart"
lightdm_config="/etc/lightdm/lightdm.conf"

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this configuration with sudo." >&2
  exit 1
fi

if ! id "${operator_user}" >/dev/null 2>&1; then
  echo "Create the ${operator_user} account before configuring kiosk startup." >&2
  exit 1
fi
if [[ ! -x /opt/ctg-engage/bin/ctg-engage-kiosk ]]; then
  echo "Install CTG Engage before configuring kiosk startup." >&2
  exit 1
fi
if [[ ! -f "${lightdm_config}" ]]; then
  echo "LightDM configuration not found at ${lightdm_config}." >&2
  exit 1
fi

for group in audio video plugdev input render netdev; do
  if getent group "${group}" >/dev/null; then
    usermod --append --groups "${group}" "${operator_user}"
  fi
done

if id -nG "${operator_user}" | tr ' ' '\n' | grep -qx sudo; then
  deluser "${operator_user}" sudo
fi

install -d -m 0755 -o "${operator_user}" -g "${operator_user}" "${operator_home}/.config" "${autostart_directory}"
cat > "${autostart_file}" <<'EOF'
/usr/bin/lwrespawn /opt/ctg-engage/bin/ctg-engage-kiosk &
EOF
chown "${operator_user}:${operator_user}" "${autostart_file}"
chmod 0644 "${autostart_file}"

sed -i -E "s/^[[:space:]#]*autologin-user=.*/autologin-user=${operator_user}/" "${lightdm_config}"
if ! grep -qx "autologin-user=${operator_user}" "${lightdm_config}"; then
  echo "Failed to configure LightDM auto-login for ${operator_user}." >&2
  exit 1
fi

raspi-config nonint do_blanking 1

echo "ExpoPi will auto-login as ${operator_user} and launch CTG Engage after the next reboot."
