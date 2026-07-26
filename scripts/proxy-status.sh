#!/usr/bin/env bash
set -Eeuo pipefail

units=(squid danted)
if systemctl list-unit-files nginx.service --no-legend 2>/dev/null | grep -q '^nginx\.service'; then
  units+=(nginx)
fi

systemctl --no-pager --full status "${units[@]}" || true
echo
echo "[Listening proxy ports]"
ss -lntup | grep -E ':(1080|3128|8080|80|443)\b' || true
echo
echo "[Recent proxy logs]"
for unit_name in "${units[@]}"; do
  echo "--- ${unit_name} ---"
  journalctl --no-pager -n 10 -u "${unit_name}" || true
done
