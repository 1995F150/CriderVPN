#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
config_source="${repo_root}/config/cridervpn.env.example"
install_root="/opt/cridervpn"
managed_repo="${install_root}/repository"
config_root="/etc/cridervpn"
state_root="/var/lib/cridervpn"
backup_root="${state_root}/backups/$(date -u +%Y%m%dT%H%M%SZ)"
repository_url="https://github.com/1995F150/CriderVPN.git"

for command_name in git nmcli ip systemctl; do
  command -v "${command_name}" >/dev/null || {
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  }
done

install -d -m 0755 "${install_root}/scripts"
install -d -m 0700 "${config_root}" "${state_root}" "${backup_root}"
install -d -o root -g root -m 0750 "${state_root}/update" "${state_root}/update/home" "${state_root}/update/cache" "${state_root}/update/npm-cache"
for script_name in discover-network.sh validate-config.sh check-for-updates.sh enable-tailscale-routing.sh disable-tailscale-routing.sh tailscale-routing-status.sh; do
  install -m 0755 "${repo_root}/scripts/${script_name}" "${install_root}/scripts/"
done
install -m 0644 "${repo_root}/systemd/cridervpn-update.service" /etc/systemd/system/
install -m 0644 "${repo_root}/systemd/cridervpn-update.timer" /etc/systemd/system/

if [[ ! -e "${config_root}/cridervpn.env" ]]; then
  install -m 0600 "${config_source}" "${config_root}/cridervpn.env"
fi

if [[ ! -e "${config_root}/update.env" ]]; then
  cat > "${config_root}/update.env" <<EOF
REPOSITORY_URL="${repository_url}"
REPOSITORY_DIR="${managed_repo}"
UPDATE_BRANCH="main"
UPDATE_MODE="apply"
AUTO_RESTART_CRIDERSHIELD="true"
EOF
  chmod 0600 "${config_root}/update.env"
fi

if [[ ! -d "${managed_repo}/.git" ]]; then
  git clone --branch main --single-branch -- "${repository_url}" "${managed_repo}"
fi

nmcli --show-secrets connection show > "${backup_root}/networkmanager-connections.txt"
chmod 0600 "${backup_root}/networkmanager-connections.txt"
ip -4 route > "${backup_root}/ipv4-routes.txt"
ip -6 route > "${backup_root}/ipv6-routes.txt"
nft list ruleset > "${backup_root}/nftables.txt" 2>/dev/null || true

systemctl daemon-reload
systemctl enable --now cridervpn-update.timer

echo "Foundation installed without changing routing."
echo "Configuration: ${config_root}/cridervpn.env"
echo "Update configuration: ${config_root}/update.env"
echo "Backup: ${backup_root}"
echo "Automatic update timer: enabled"
echo "Next: run discovery and validate the network configuration."
