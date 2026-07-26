#!/usr/bin/env bash
set -Eeuo pipefail

config_file="${1:-/etc/cridervpn/cridervpn.env}"

if [[ ! -r "${config_file}" ]]; then
  echo "Configuration not readable: ${config_file}" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "${config_file}"

required=(UPLINK_INTERFACE DOWNLINK_INTERFACE LAN_IPV4_CIDR LAN_IPV4_GATEWAY IPV6_MODE VPN_MODE)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required setting: ${name}" >&2
    exit 1
  fi
done

if [[ "${UPLINK_INTERFACE}" == "${DOWNLINK_INTERFACE}" ]]; then
  echo "Uplink and downlink interfaces must be different." >&2
  exit 1
fi

for interface_name in "${UPLINK_INTERFACE}" "${DOWNLINK_INTERFACE}"; do
  if [[ ! -d "/sys/class/net/${interface_name}" ]]; then
    echo "Interface does not exist: ${interface_name}" >&2
    exit 1
  fi
done

case "${IPV6_MODE}" in
  disabled|routed|vpn-only) ;;
  *) echo "Invalid IPV6_MODE: ${IPV6_MODE}" >&2; exit 1 ;;
esac

case "${VPN_MODE}" in
  off|optional|required) ;;
  *) echo "Invalid VPN_MODE: ${VPN_MODE}" >&2; exit 1 ;;
esac

echo "Configuration is structurally valid."
echo "Uplink: ${UPLINK_INTERFACE}"
echo "Downlink: ${DOWNLINK_INTERFACE}"
echo "LAN: ${LAN_IPV4_CIDR}"
echo "IPv6 mode: ${IPV6_MODE}"
echo "VPN mode: ${VPN_MODE}"
