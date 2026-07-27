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
  [[ -n "${stage_root}" && -d "${stage_root}" ]] && rm -rf -- "${stage_root}"
  [[ -n "${sudoers_tmp}" && -e "${sudoers_tmp}" ]] && rm -f -- "${sudoers_tmp}"
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
