#!/usr/bin/env bash
set -Eeuo pipefail

echo "[Forwarding]"
sysctl net.ipv4.ip_forward net.ipv6.conf.all.forwarding

echo
echo "[Tailscale status]"
tailscale status

echo
echo "[Tailscale preferences]"
tailscale debug prefs | grep -E '"AdvertiseRoutes"|"NoSNAT"|"ExitNodeID"|"ExitNodeIP"' || true

echo
echo "[CriderVPN state]"
if [[ -r /var/lib/cridervpn/tailscale-routing.env ]]; then
  cat /var/lib/cridervpn/tailscale-routing.env
else
  echo "No CriderVPN Tailscale routing state recorded."
fi
