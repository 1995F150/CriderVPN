#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

source_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
install_root="/opt/cridervpn/apps/cridershield"
install_parent="$(dirname -- "${install_root}")"
previous_root="${install_root}.previous"
data_parent="/var/lib/cridervpn"
data_root="${data_parent}/cridershield"
config_root="/etc/cridervpn"
env_file="${config_root}/cridershield.env"
helper_target="/usr/local/sbin/cridervpn-device-access"
sudoers_target="/etc/sudoers.d/cridervpn-device-access"
stage_root=""
sudoers_tmp=""

cleanup() {
  if [[ -n "${stage_root}" && -d "${stage_root}" ]]; then
    rm -rf -- "${stage_root}"
  fi
  if [[ -n "${sudoers_tmp}" && -e "${sudoers_tmp}" ]]; then
    rm -f -- "${sudoers_tmp}"
  fi
  return 0
}
trap cleanup EXIT

for command_name in npm node openssl sudo nft python3 visudo; do
  command -v "${command_name}" >/dev/null || {
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  }
done

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
install -d -o root -g root -m 0750 "${data_parent}/update/npm-cache"
export NPM_CONFIG_CACHE="${data_parent}/update/npm-cache"
export NPM_CONFIG_UPDATE_NOTIFIER=false
install -d -o cridervpn -g cridervpn -m 0750 "${data_root}"
install -d -m 0755 "${install_parent}" "${config_root}" /usr/local/sbin /etc/sudoers.d

# Build away from the live release. The running dashboard keeps its matching
# HTML, CSS and JavaScript until the new build is complete.
stage_root="$(mktemp -d "${install_parent}/.cridershield-stage.XXXXXX")"
cp -a -- "${source_root}/." "${stage_root}/"
cd "${stage_root}"
npm ci
npm run build
chown -R root:root "${stage_root}"

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
grep -q '^CRIDERGPT_ENGINE_UPSTREAM=' "${env_file}" ||
  printf 'CRIDERGPT_ENGINE_UPSTREAM=http://127.0.0.1:8000\n' >> "${env_file}"
grep -q '^PROXY_REQUEST_TIMEOUT_MS=' "${env_file}" ||
  printf 'PROXY_REQUEST_TIMEOUT_MS=120000\n' >> "${env_file}"
grep -q '^PROXY_HEALTH_INTERVAL_MS=' "${env_file}" ||
  printf 'PROXY_HEALTH_INTERVAL_MS=15000\n' >> "${env_file}"
grep -q '^PROXY_HEALTH_TIMEOUT_MS=' "${env_file}" ||
  printf 'PROXY_HEALTH_TIMEOUT_MS=5000\n' >> "${env_file}"
grep -q '^CRIDERGPT_ENGINE_LOCAL_HEALTH_URL=' "${env_file}" ||
  printf 'CRIDERGPT_ENGINE_LOCAL_HEALTH_URL=http://127.0.0.1:8000/api/health\n' >> "${env_file}"
if ! grep -q '^CRIDERGPT_ENGINE_PUBLIC_HEALTH_URL=' "${env_file}"; then
  legacy_public_url="$(sed -n 's/^CRIDERGPT_ENGINE_HEALTH_URL=//p' "${env_file}" | tail -n 1)"
  printf 'CRIDERGPT_ENGINE_PUBLIC_HEALTH_URL=%s\n' \
    "${legacy_public_url:-https://cridergpt.com/engine/api/health}" >> "${env_file}"
fi
chown root:root "${env_file}"
chmod 0600 "${env_file}"

install -m 0755 "${stage_root}/scripts/device-internet-access.sh" "${helper_target}"
sudoers_tmp="$(mktemp)"
printf '%s\n'   'cridervpn ALL=(root) NOPASSWD: /usr/local/sbin/cridervpn-device-access block *, /usr/local/sbin/cridervpn-device-access unblock *'   > "${sudoers_tmp}"
chmod 0440 "${sudoers_tmp}"
visudo -cf "${sudoers_tmp}" >/dev/null
install -o root -g root -m 0440 "${sudoers_tmp}" "${sudoers_target}"
rm -f -- "${sudoers_tmp}"
sudoers_tmp=""

systemctl stop cridershield.service 2>/dev/null || true
rm -rf -- "${previous_root}"
if [[ -d "${install_root}" ]]; then
  mv -- "${install_root}" "${previous_root}"
fi
mv -- "${stage_root}" "${install_root}"
stage_root=""

install -m 0644 "${install_root}/cridershield.service" /etc/systemd/system/cridershield.service
systemctl daemon-reload
systemctl reset-failed cridershield.service || true
systemctl enable cridershield.service

if ! systemctl start cridershield.service ||
   ! systemctl is-active --quiet cridershield.service; then
  echo "New CriderShield release failed. Restoring the previous release." >&2
  systemctl stop cridershield.service 2>/dev/null || true
  rm -rf -- "${install_root}"
  if [[ -d "${previous_root}" ]]; then
    mv -- "${previous_root}" "${install_root}"
    install -m 0644 "${install_root}/cridershield.service" /etc/systemd/system/cridershield.service
    systemctl daemon-reload
    systemctl start cridershield.service || true
  fi
  exit 1
fi

rm -rf -- "${previous_root}"

echo "CriderShield installed atomically on port 3000."
echo "Pi-hole keeps ports 53, 80 and 443."
echo "To enable live DNS data and rule changes, set a Pi-hole application password in:"
echo "  ${env_file}"
