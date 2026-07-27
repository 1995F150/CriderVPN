# CriderVPN

CriderVPN is an Ubuntu Server network gateway that receives internet through Wi-Fi and shares managed connectivity through Ethernet.

## Traffic path

```text
Internet -> Wi-Fi uplink -> Ubuntu Server -> Ethernet downlink -> LAN devices
```

## Current capabilities

- Existing NetworkManager IPv4 sharing on `10.42.0.0/24`
- DHCP and DNS through the gateway
- Tailscale exit-node and subnet-router activation
- Explicit downstream IPv6 policy
- Configuration backups and guarded rollback
- Automatic fast-forward-only updates from GitHub
- Integrated CriderShield monitoring and management dashboard
- Authenticated live telemetry and device discovery
- Live Pi-hole v6 DNS statistics, logs, analytics and allow/deny management
- Live Tailscale, Pi-hole, Squid, Dante and CriderShield service status
- Optional Tailscale/LAN reverse-proxy access on port `8080`
- Future WireGuard upstream mode for an external exit server

## CriderShield dashboard

The original `1995F150/CriderShield` application is integrated under
`apps/cridershield`. CriderVPN keeps its useful dashboard, authentication,
device, DNS, rules and analytics code while preventing it from replacing
Pi-hole or taking over ports 53, 80 and 443.

Requirements:

- Node.js 20.17 or newer
- An already working CriderVPN/Pi-hole gateway

Install after reviewing the integration branch:

```bash
sudo bash scripts/install-cridershield.sh
```

The service listens on port `3000`. Open
`http://<server-tailscale-ip>:3000/setup` over Tailscale for the first
administrator account. Find the server address with `tailscale ip -4`.
CriderShield uses the Pi-hole v6 API; Pi-hole remains the DNS provider.

Generate a Pi-hole application password and save it only on the server in
`/etc/cridervpn/cridershield.env` as `PIHOLE_APP_PASSWORD`. Never commit it.

To put the dashboard behind CriderVPN's existing reverse-proxy template,
set `REVERSE_PROXY_ENABLED="true"` in `/etc/cridervpn/proxy.env` and rerun
the proxy installer. It will use port `8080`, leaving Pi-hole on 80/443.

The GitHub updater safely refreshes the managed repository but does not
automatically rebuild or restart the dashboard. Rerun the dashboard
installer after reviewing an application update.

## Tailscale VPN mode

Run these only after discovery and configuration validation:

```bash
git pull --ff-only
sudo bash scripts/install-foundation.sh
sudo bash /opt/cridervpn/scripts/enable-tailscale-routing.sh
```

The activation script advertises this server as:

- a Tailscale exit node for remote devices
- a subnet router for `10.42.0.0/24`

After activation, approve **Use as exit node** and the advertised subnet route for `cridergptserver` in the Tailscale Machines admin page. Every client must separately select the exit node.

Rollback:

```bash
sudo bash /opt/cridervpn/scripts/disable-tailscale-routing.sh
```

Status:

```bash
sudo bash /opt/cridervpn/scripts/tailscale-routing-status.sh
```

## Automatic updates

`cridervpn-update.timer` checks GitHub about every 30 minutes. It updates the managed repository at `/opt/cridervpn/repository` only with a clean fast-forward. It never automatically runs network activation, firewall migration or rollback scripts.

```bash
systemctl status cridervpn-update.timer
sudo systemctl start cridervpn-update.service
sudo cat /var/lib/cridervpn/update/status.env
```

## Security rules

Never commit Wi-Fi passwords, WireGuard private keys, Supabase service-role keys, API secrets, access tokens, real `.env` files or NetworkManager secret backups.

CriderVPN is not yet ready for commercial customer traffic.
