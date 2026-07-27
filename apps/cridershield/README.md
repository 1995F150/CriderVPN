# CriderShield for CriderVPN

CriderShield is the authenticated web console bundled with CriderVPN. It
monitors the Ubuntu gateway and connects to the existing Pi-hole v6 API
instead of running a competing DNS server.

## Working features

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

CriderShield does not replace Pi-hole. Pi-hole remains responsible for DNS
on port 53 and its existing web interface remains on ports 80 and 443.
CriderShield listens on port 3000.

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

Restart only the dashboard:

```bash
sudo systemctl restart cridershield
```

The application password stays in the root-owned server configuration and
must never be committed to GitHub.

## Update

CriderVPN's timer updates the managed repository without restarting network
services. After reviewing an update, deploy the dashboard with:

```bash
sudo bash /opt/cridervpn/repository/scripts/install-cridershield.sh
```

## Remove

```bash
sudo bash /opt/cridervpn/apps/cridershield/uninstall.sh
```

The uninstaller preserves configuration and SQLite data for recovery.
