#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo." >&2
  exit 1
fi

state_file="/var/lib/cridervpn/tailscale-routing.env"
sysctl_file="/etc/sysctl.d/99-cridervpn-tailscale.conf"

command -v tailscale >/dev/null || {
  echo "tailscale is not installed." >&2
  exit 1
}

tailscale set --advertise-exit-node=false --advertise-routes=

if [[ -r "${state_file}" ]]; then
  # shellcheck disable=SC1090
  source "${state_file}"
  sysctl -w "net.ipv4.ip_forward=${PREVIOUS_IPV4_FORWARDING:-1}" >/dev/null
  sysctl -w "net.ipv6.conf.all.forwarding=${PREVIOUS_IPV6_FORWARDING:-0}" >/dev/null
fi

if [[ -e "${sysctl_file}" ]]; then
  rm -f -- "${sysctl_file}"
fi

echo "Tailscale exit-node and subnet-route advertisement disabled."
