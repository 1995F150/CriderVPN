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
- Future WireGuard upstream mode for an external exit server

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
