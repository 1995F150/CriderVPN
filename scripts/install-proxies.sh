#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo." >&2
  exit 1
fi

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
network_config="/etc/cridervpn/cridervpn.env"
proxy_config="/etc/cridervpn/proxy.env"
backup_root="/var/lib/cridervpn/backups/proxy-$(date -u +%Y%m%dT%H%M%SZ)"

[[ -r "${network_config}" ]] || { echo "Missing ${network_config}" >&2; exit 1; }
# shellcheck disable=SC1090
source "${network_config}"

if [[ ! -e "${proxy_config}" ]]; then
  install -m 0600 "${repo_root}/config/proxy.env.example" "${proxy_config}"
  echo "Created ${proxy_config}. Review it, then run this installer again."
  exit 2
fi
# shellcheck disable=SC1090
source "${proxy_config}"

: "${UPLINK_INTERFACE:?UPLINK_INTERFACE is required}"
: "${LAN_IPV4_GATEWAY:?LAN_IPV4_GATEWAY is required}"
: "${LAN_SOURCE_CIDR:=10.42.0.0/24}"
: "${TAILSCALE_SOURCE_CIDR:=100.64.0.0/10}"
: "${SOCKS5_PORT:=1080}"
: "${HTTP_PROXY_PORT:=3128}"
: "${REVERSE_PROXY_ENABLED:=false}"
: "${REVERSE_PROXY_LISTEN_PORT:=8080}"
: "${REVERSE_PROXY_SERVER_NAME:=_}"
: "${REVERSE_PROXY_BACKEND:=http://127.0.0.1:3000}"

tailscale_ip="$(tailscale ip -4 | head -n 1)"
[[ -n "${tailscale_ip}" ]] || { echo "No Tailscale IPv4 address found." >&2; exit 1; }

install -d -m 0700 "${backup_root}"
for file_name in /etc/squid/squid.conf /etc/danted.conf /etc/nginx/sites-available/cridervpn; do
  if [[ -e "${file_name}" ]]; then
    cp -a -- "${file_name}" "${backup_root}/"
  fi
done

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y squid dante-server
if [[ "${REVERSE_PROXY_ENABLED}" == "true" ]]; then
  apt-get install -y nginx
fi

render() {
  local source_file="$1" target_file="$2"
  sed \
    -e "s|__LAN_IP__|${LAN_IPV4_GATEWAY}|g" \
    -e "s|__TAILSCALE_IP__|${tailscale_ip}|g" \
    -e "s|__UPLINK_INTERFACE__|${UPLINK_INTERFACE}|g" \
    -e "s|__LAN_SOURCE_CIDR__|${LAN_SOURCE_CIDR}|g" \
    -e "s|__TAILSCALE_SOURCE_CIDR__|${TAILSCALE_SOURCE_CIDR}|g" \
    -e "s|__SOCKS5_PORT__|${SOCKS5_PORT}|g" \
    -e "s|__HTTP_PROXY_PORT__|${HTTP_PROXY_PORT}|g" \
    -e "s|__REVERSE_PROXY_LISTEN_PORT__|${REVERSE_PROXY_LISTEN_PORT}|g" \
    -e "s|__REVERSE_PROXY_SERVER_NAME__|${REVERSE_PROXY_SERVER_NAME}|g" \
    -e "s|__REVERSE_PROXY_BACKEND__|${REVERSE_PROXY_BACKEND}|g" \
    "${source_file}" > "${target_file}"
}

render "${repo_root}/templates/squid.conf.template" /etc/squid/squid.conf
render "${repo_root}/templates/danted.conf.template" /etc/danted.conf
squid -k parse
systemctl enable squid danted
# Package installation may have already started the daemons with default configs.
# Restart explicitly so the restricted CriderVPN listeners and ACLs take effect.
systemctl restart squid danted

if [[ "${REVERSE_PROXY_ENABLED}" == "true" ]]; then
  render "${repo_root}/templates/nginx-reverse-proxy.conf.template" /etc/nginx/sites-available/cridervpn
  ln -sfn /etc/nginx/sites-available/cridervpn /etc/nginx/sites-enabled/cridervpn
  nginx -t
  systemctl enable --now nginx
fi

echo "SOCKS5: ${LAN_IPV4_GATEWAY}:${SOCKS5_PORT} and ${tailscale_ip}:${SOCKS5_PORT}"
echo "HTTP/HTTPS proxy: ${LAN_IPV4_GATEWAY}:${HTTP_PROXY_PORT} and ${tailscale_ip}:${HTTP_PROXY_PORT}"
echo "Reverse proxy enabled: ${REVERSE_PROXY_ENABLED}"
echo "Backup: ${backup_root}"
