#!/usr/bin/env bash
set -Eeuo pipefail

action="${1:-}"
requested_address="${2:-}"

case "${action}" in
  block|unblock) ;;
  *) echo "Usage: $0 block|unblock IP_ADDRESS" >&2; exit 2 ;;
esac

canonical="$(
  /usr/bin/python3 - "${requested_address}" <<'PY'
import ipaddress
import sys
try:
    print(ipaddress.ip_address(sys.argv[1]))
except ValueError:
    raise SystemExit(2)
PY
)" || {
  echo "Invalid IP address." >&2
  exit 2
}

if [[ "${canonical}" == *:* ]]; then
  set_name="blocked_ipv6"
else
  set_name="blocked_ipv4"
fi

if ! /usr/sbin/nft list table inet cridervpn_access >/dev/null 2>&1; then
  /usr/sbin/nft -f - <<'NFT'
table inet cridervpn_access {
  set blocked_ipv4 {
    type ipv4_addr
    flags interval
  }

  set blocked_ipv6 {
    type ipv6_addr
    flags interval
  }

  chain forward {
    type filter hook forward priority -10; policy accept;
    ip saddr @blocked_ipv4 counter reject with icmp type admin-prohibited
    ip6 saddr @blocked_ipv6 counter reject with icmpv6 type admin-prohibited
  }
}
NFT
fi

element="{ ${canonical} }"
if [[ "${action}" == "block" ]]; then
  /usr/sbin/nft get element inet cridervpn_access "${set_name}" "${element}" >/dev/null 2>&1 ||
    /usr/sbin/nft add element inet cridervpn_access "${set_name}" "${element}"
  echo "Internet access blocked for ${canonical}."
else
  if /usr/sbin/nft get element inet cridervpn_access "${set_name}" "${element}" >/dev/null 2>&1; then
    /usr/sbin/nft delete element inet cridervpn_access "${set_name}" "${element}"
  fi
  echo "Internet access restored for ${canonical}."
fi
