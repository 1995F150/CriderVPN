#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this uninstaller with sudo." >&2
  exit 1
fi

systemctl disable --now cridershield.service 2>/dev/null || true
rm -f -- /etc/systemd/system/cridershield.service
systemctl daemon-reload

echo "CriderShield service removed."
echo "Application data remains recoverable at /var/lib/cridervpn/cridershield."
echo "Configuration remains at /etc/cridervpn/cridershield.env."
