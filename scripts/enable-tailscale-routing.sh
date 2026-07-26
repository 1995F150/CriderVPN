#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo." >&2
  exit 1
fi

config_file="${1:-/etc/cridervpn/cridervpn.env}"
state_root="/var/lib/cridervpn"
state_file="${state_root}/tailscale-routing.env"
sysctl_file="/etc/sysctl.d/99-cridervpn-tailscale.conf"

for command_name in tailscale sysctl systemctl; do
  command -v "${command_name}" >/dev/null || {
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  }
done

if [[ ! -r "${config_file}" ]]; then
  echo "Configuration not readable: ${config_file}" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "${config_file}"
: "${TAILSCALE_ADVERTISE_ROUTES:=10.42.0.0/24}"

if ! systemctl is-active --quiet tailscaled; then
  echo "tailscaled is not running." >&2
  exit 1
fi

previous_ipv4="$(sysctl -n net.ipv4.ip_forward)"
previous_ipv6="$(sysctl -n net.ipv6.conf.all.forwarding)"
install -d -m 0700 "${state_root}"

{
  printf 'PREVIOUS_IPV4_FORWARDING=%q\n' "${previous_ipv4}"
  printf 'PREVIOUS_IPV6_FORWARDING=%q\n' "${previous_ipv6}"
  printf 'ADVERTISED_ROUTES=%q\n' "${TAILSCALE_ADVERTISE_ROUTES}"
  printf 'ENABLED_AT=%q\n' "$(date -u --iso-8601=seconds)"
} > "${state_file}"
chmod 0600 "${state_file}"

cat > "${sysctl_file}" <<'EOF'
# Required for the CriderVPN Tailscale exit node and subnet router.
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
EOF

rollback() {
  local exit_code=$?
  if [[ "${exit_code}" -ne 0 ]]; then
    echo "Activation failed; restoring forwarding values." >&2
    sysctl -w "net.ipv4.ip_forward=${previous_ipv4}" >/dev/null || true
    sysctl -w "net.ipv6.conf.all.forwarding=${previous_ipv6}" >/dev/null || true
  fi
  exit "${exit_code}"
}
trap rollback EXIT

sysctl -p "${sysctl_file}"
tailscale set --advertise-exit-node --advertise-routes="${TAILSCALE_ADVERTISE_ROUTES}"

trap - EXIT
echo "Tailscale exit-node and subnet-route advertisement enabled."
echo "Advertised LAN route: ${TAILSCALE_ADVERTISE_ROUTES}"
echo "Next: approve 'Use as exit node' and the subnet route in the Tailscale admin console."
