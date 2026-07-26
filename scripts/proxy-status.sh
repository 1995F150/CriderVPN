#!/usr/bin/env bash
set -Eeuo pipefail

systemctl --no-pager --full status squid danted nginx || true
echo
echo "[Listening proxy ports]"
ss -lntup | grep -E ':(1080|3128|8080|80|443)\b' || true
echo
echo "[Recent proxy logs]"
journalctl --no-pager -n 20 -u squid -u danted -u nginx || true
