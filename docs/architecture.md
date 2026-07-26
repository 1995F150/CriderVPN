# CriderVPN architecture

## Gateway role

The Ubuntu server uses one interface as an upstream internet connection and a separate Ethernet interface as the downstream LAN gateway.

```text
Wi-Fi internet
      |
  Wi-Fi uplink
      |
Ubuntu gateway
  - NetworkManager
  - IPv4/IPv6 policy
  - DHCP and DNS
  - nftables
  - optional WireGuard
      |
Ethernet downlink
      |
LAN client or downstream switch/access point
```

This configuration shares internet received over Wi-Fi through Ethernet. It does not make the server broadcast Wi-Fi. Broadcasting a separate wireless network requires another compatible wireless adapter or an external access point attached to Ethernet.

## Data plane

The Ubuntu server owns packet forwarding, firewall enforcement, DNS redirection, DHCP and WireGuard. This must continue working even if Supabase or the dashboard is unavailable.

## Control plane

Supabase may later store user accounts, device metadata, non-secret policies and health summaries. It must not store WireGuard private keys, Wi-Fi credentials or unrestricted server credentials.

## IPv4

The initial downstream IPv4 network is `10.42.0.0/24`, with the server at `10.42.0.1`. The existing NetworkManager shared-mode configuration may already provide DHCP, DNS forwarding and NAT. Installation must inspect and preserve it before creating replacement rules.

## IPv6

IPv6 cannot safely be treated as “IPv4 with longer addresses.” NAT66 is not the default design. The implementation must first determine whether the Wi-Fi provider delegates a usable prefix.

Until that is confirmed, IPv6 remains disabled on the downstream side to prevent VPN leaks. Future modes are:

- `disabled`: no downstream IPv6
- `routed`: route a delegated ISP prefix
- `vpn-only`: provide IPv6 only through a VPN that supports it

## VPN modes

- `off`: normal routed internet through the Wi-Fi uplink
- `optional`: selected clients or destinations may use WireGuard
- `required`: all downstream internet traffic must traverse WireGuard; a kill switch blocks fallback to the Wi-Fi uplink

A real VPN exit IP requires a WireGuard peer outside the home network. Without an external peer, this project is a managed router and firewall but does not change the public IP.

## Deployment safety

Routing changes can break remote SSH access. Deployment will therefore use:

1. discovery and validation
2. configuration backup
3. timed rollback
4. staged IPv4 activation
5. local connectivity tests
6. explicit IPv6 activation
7. optional VPN activation
