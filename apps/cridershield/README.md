# CriderShield for CriderVPN

CriderShield is the authenticated CriderVPN web console and the production
reverse proxy for the local CriderGPT Engine. It monitors the Ubuntu gateway,
connects to the Pi-hole v6 API, and exposes only the Engine routes that the
public application needs.

## Working features

- Production streaming reverse proxy for the CriderGPT Engine
- Live reverse-proxy diagnostics, health, errors and last 100 requests
- Live CPU, memory, disk, network, uptime and process telemetry
- Live systemd state for Pi-hole, Tailscale, Squid, Dante and CriderShield
- Tailscale exit-node and connection status
- HTTP and SOCKS5 proxy health
- Network-client discovery from the Linux neighbor table
- Pi-hole query totals, blocked totals, block rate and active clients
- Pi-hole query logs with filtering, paging and CSV export
- Pi-hole history charts and top-domain analytics
- Pi-hole exact and regular-expression allow/deny management
- Local administrator setup, login and logout
- SQLite-backed local users and device names

CriderShield does not replace Pi-hole. Pi-hole remains responsible for DNS on
port 53 and its existing web interface remains on ports 80 and 443.
CriderShield listens on port 3000. The CriderGPT Engine remains private on
`127.0.0.1:8000`.

## Engine reverse proxy

CriderShield registers these routes before any JSON or cookie middleware so
request bodies and streaming responses are forwarded without re-encoding:

| Public request | Engine upstream |
| --- | --- |
| `/engine/api/*` | `http://127.0.0.1:8000/api/*` |
| `/engine/dashboard` | `http://127.0.0.1:8000/dashboard` |
| `/docs` | `http://127.0.0.1:8000/docs` |

All HTTP methods and query strings are retained. `Authorization`, `X-API-Key`,
`Content-Type`, `Accept`, `Host`, `Origin`, request bodies and other end-to-end
headers are forwarded. The proxy supports streamed responses, keep-alive and
WebSocket upgrades.

The authenticated diagnostics page is available at `/proxy`. It reports:

- registered routes and active upstream
- automatic `/api/health` results and latency
- last proxy error
- last 100 requests
- upstream status-code totals
- connection, TLS, DNS, timeout and upstream-error totals

Diagnostics never record authorization values, API keys, cookies or request
bodies.

## Cloudflare configuration

Cloudflare terminates public HTTPS and HTTP/2. Its origin for Engine traffic
must be CriderShield, not the Engine:

```text
engine-origin.cridergpt.com -> http://127.0.0.1:3000
```

Configure the existing Cloudflare Tunnel published application with:

```text
Hostname: engine-origin.cridergpt.com
Service URL: http://127.0.0.1:3000
```

The public `cridergpt.com` Worker or routing layer must forward these paths to
`https://engine-origin.cridergpt.com` while preserving the original path:

```text
/engine/api/*
/engine/dashboard*
/docs*
```

Do not strip `/engine` in Cloudflare. CriderShield performs that rewrite.
Do not point the tunnel directly at port 8000 because that bypasses
CriderShield diagnostics, logging and routing.

## Install

Requirements:

- Ubuntu Server
- Node.js 20.17 or newer
- An installed CriderVPN foundation
- Pi-hole v6 for DNS statistics and rule management

From the CriderVPN repository:

```bash
sudo bash scripts/install-cridershield.sh
```

Open `http://<server-tailscale-ip>:3000/setup` and create the first local
administrator.

The installer adds these safe defaults to
`/etc/cridervpn/cridershield.env` without overwriting existing values:

```ini
CRIDERGPT_ENGINE_UPSTREAM=http://127.0.0.1:8000
PROXY_REQUEST_TIMEOUT_MS=120000
PROXY_HEALTH_INTERVAL_MS=15000
PROXY_HEALTH_TIMEOUT_MS=5000
```

## Connect Pi-hole

Pi-hole v6 uses session-based API authentication. Generate an application
password in the Pi-hole settings, then edit:

```bash
sudoedit /etc/cridervpn/cridershield.env
```

Set:

```ini
PIHOLE_URL=http://127.0.0.1
PIHOLE_APP_PASSWORD=your-generated-application-password
```

Restart only the dashboard and proxy:

```bash
sudo systemctl restart cridershield
```

The application password stays in the root-owned server configuration and
must never be committed to GitHub.

## Validate

On the server:

```bash
curl -i http://127.0.0.1:3000/engine/api/health
curl -i http://127.0.0.1:3000/engine/dashboard
curl -i http://127.0.0.1:3000/docs
```

After Cloudflare routing is active:

```bash
curl -i https://cridergpt.com/engine/api/health
```

The local and public requests must return the same Engine health payload.

## Update

CriderVPN's update timer deploys and restarts CriderShield when its application
files change. Manual deployment remains available:

```bash
sudo bash /opt/cridervpn/repository/scripts/install-cridershield.sh
```

## Remove

```bash
sudo bash /opt/cridervpn/apps/cridershield/uninstall.sh
```

The uninstaller preserves configuration and SQLite data for recovery.
