# Proxy modes

CriderVPN includes three distinct proxy roles.

## SOCKS5

Dante handles general TCP/UDP application proxying on port 1080. It binds only to the Ethernet gateway and Tailscale addresses. Source ACLs permit only `10.42.0.0/24` and `100.64.0.0/10`.

## HTTP and HTTPS CONNECT

Squid handles browser-style HTTP proxying and HTTPS CONNECT on port 3128. Only ports 80 and 443 are permitted, and all other source networks are denied.

## Reverse proxy

NGINX forwards inbound web requests to a configured local service. It is disabled by default. The initial configuration is tailnet-only and does not expose ports publicly.

A public reverse proxy still requires a reachable public endpoint, Cloudflare Tunnel, or another ingress service because the server is behind cellular/CGNAT networking.

## Install

Run from the latest repository checkout:

```bash
git pull --ff-only
sudo bash scripts/install-proxies.sh
```

The first run creates `/etc/cridervpn/proxy.env` and exits. Review that file, especially the reverse-proxy backend, then run the installer again.

No proxy credentials are committed to GitHub. Network ACLs are the first security boundary; future customer-facing proxy service requires per-user authentication, quotas, abuse controls and audit review.
