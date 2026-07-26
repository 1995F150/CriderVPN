#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
config_source="${repo_root}/config/cridervpn.env.example"
install_root="/opt/cridervpn"
config_root="/etc/cridervpn"
state_root="/var/lib/cridervpn"
backup_root="${state_root}/backups/$(date -u +%Y%m%dT%H%M%SZ)"

install -d -m 0755 "${install_root}/scripts"
install -d -m 0700 "${config_root}" "${state_root}" "${backup_root}"
install -m 0755 "${repo_root}/scripts/discover-network.sh" "${install_root}/scripts/"
install -m 0755 "${repo_root}/scripts/validate-config.sh" "${install_root}/scripts/"

if [[ ! -e "${config_root}/cridervpn.env" ]]; then
  install -m 0600 "${config_source}" "${config_root}/cridervpn.env"
fi

nmcli --show-secrets connection show > "${backup_root}/networkmanager-connections.txt"
chmod 0600 "${backup_root}/networkmanager-connections.txt"
ip -4 route > "${backup_root}/ipv4-routes.txt"
ip -6 route > "${backup_root}/ipv6-routes.txt"
nft list ruleset > "${backup_root}/nftables.txt" 2>/dev/null || true

echo "Foundation installed without changing routing."
echo "Configuration: ${config_root}/cridervpn.env"
echo "Backup: ${backup_root}"
echo "Next: edit the configuration, run discovery, then validate it."
