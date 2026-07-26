# CriderVPN

CriderVPN is an Ubuntu Server network gateway project designed to receive internet through Wi-Fi and share managed connectivity through the server's Ethernet port.

## Planned traffic path

```text
Internet -> Wi-Fi uplink -> Ubuntu Server -> Ethernet downlink -> LAN devices
```

The gateway will eventually support:

- IPv4 forwarding and NAT
- IPv6 forwarding with an explicit, leak-safe policy
- DHCP and DNS for Ethernet-connected devices
- Pi-hole or CriderShield DNS integration
- Optional WireGuard routing for the entire downstream network
- VPN kill switch and automatic recovery
- NetworkManager and systemd integration
- Configuration backup, validation, and rollback
- A Supabase-backed control plane without storing VPN private keys in Supabase

## Safety status

This repository is in the foundation stage. Nothing in the initial commit changes live network settings. Do not run installation scripts on a remote server until the detected interfaces and rollback path have been reviewed.

## Security rules

Never commit any of the following:

- Wi-Fi passwords
- WireGuard private keys or preshared keys
- Supabase service-role keys
- API secrets or access tokens
- Real `.env` files
- Backups containing NetworkManager connection secrets

Use the example configuration as a template and store the real configuration on the server at `/etc/cridervpn/cridervpn.env` with root-only permissions.

## Initial workflow

1. Run `scripts/discover-network.sh` on the Ubuntu server.
2. Review the generated report before applying changes.
3. Copy `config/cridervpn.env.example` to `/etc/cridervpn/cridervpn.env` and set the confirmed interfaces.
4. Use the guarded installer only after the configuration passes validation.

CriderVPN is not yet ready for production or customer traffic.
