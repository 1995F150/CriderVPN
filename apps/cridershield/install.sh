#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

source_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
install_root="/opt/cridervpn/apps/cridershield"
data_parent="/var/lib/cridervpn"
data_root="${data_parent}/cridershield"
config_root="/etc/cridervpn"
env_file="${config_root}/cridershield.env"

command -v npm >/dev/null || {
  echo "npm is required before installing CriderShield." >&2
  exit 1
}

node_major="$(node -p 'process.versions.node.split(".")[0]')"
node_minor="$(node -p 'process.versions.node.split(".")[1]')"
if (( node_major < 20 || (node_major == 20 && node_minor < 17) )); then
  echo "Node.js 20.17 or newer is required." >&2
  exit 1
fi

if ! id cridervpn >/dev/null 2>&1; then
  useradd --system --home-dir "${data_parent}" --shell /usr/sbin/nologin cridervpn
fi

install -d -o cridervpn -g cridervpn -m 0755 "${data_parent}"
install -d -o cridervpn -g cridervpn -m 0750 "${data_root}"
install -d -m 0755 "$(dirname -- "${install_root}")" "${config_root}"

if [[ "${source_root}" != "${install_root}" ]]; then
  rm -rf -- "${install_root}"
  cp -a -- "${source_root}" "${install_root}"
fi

cd "${install_root}"
npm ci
npm run build
chown -R root:root "${install_root}"

if [[ ! -e "${env_file}" ]]; then
  install -m 0600 /dev/null "${env_file}"
fi

if ! grep -Eq '^JWT_SECRET=.+$' "${env_file}"; then
  sed -i '/^JWT_SECRET=/d' "${env_file}"
  printf 'JWT_SECRET=%s\n' "$(openssl rand -hex 32)" >> "${env_file}"
fi
grep -q '^PIHOLE_URL=' "${env_file}" ||
  printf 'PIHOLE_URL=http://127.0.0.1\n' >> "${env_file}"
grep -q '^PIHOLE_APP_PASSWORD=' "${env_file}" ||
  printf 'PIHOLE_APP_PASSWORD=\n' >> "${env_file}"
chown root:root "${env_file}"
chmod 0600 "${env_file}"

install -m 0644 "${install_root}/cridershield.service" /etc/systemd/system/cridershield.service
systemctl daemon-reload
systemctl reset-failed cridershield.service || true
systemctl enable --now cridershield.service

echo "CriderShield installed safely on port 3000."
echo "Pi-hole keeps ports 53, 80 and 443."
echo "To enable live DNS data and rule changes, set a Pi-hole application password in:"
echo "  ${env_file}"
