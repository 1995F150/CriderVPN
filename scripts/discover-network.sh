#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo so NetworkManager and routing details are complete." >&2
  exit 1
fi

report_dir="${1:-./reports}"
install -d -m 0750 "${report_dir}"
report_file="${report_dir}/network-discovery-$(date -u +%Y%m%dT%H%M%SZ).txt"

{
  echo "CriderVPN network discovery"
  echo "Generated: $(date -u --iso-8601=seconds)"
  echo
  echo "[Interfaces]"
  ip -brief link
  echo
  echo "[Addresses]"
  ip -brief address
  echo
  echo "[IPv4 routes]"
  ip -4 route
  echo
  echo "[IPv6 routes]"
  ip -6 route
  echo
  echo "[NetworkManager devices]"
  nmcli -f DEVICE,TYPE,STATE,CONNECTION device status
  echo
  echo "[Active NetworkManager connections]"
  nmcli -f NAME,UUID,TYPE,DEVICE connection show --active
  echo
  echo "[Forwarding]"
  sysctl net.ipv4.ip_forward net.ipv6.conf.all.forwarding
  echo
  echo "[Listening DNS/DHCP/VPN ports]"
  ss -lntup | awk 'NR == 1 || /:53 |:67 |:68 |:51820 /'
  echo
  echo "[Firewall tools]"
  command -v nft || true
  command -v ufw || true
  echo
  echo "[WireGuard]"
  command -v wg || true
} | tee "${report_file}"

chmod 0640 "${report_file}"
echo
echo "Saved report: ${report_file}"
echo "Review the report before installing or changing routing."
