# 🛡️ CriderShield

> A modern, self-hosted network management platform built for home labs, businesses, and power users.

CriderShield is an all-in-one network management solution inspired by projects like Pi-hole, UniFi, pfSense, and Home Assistant. It provides DNS filtering, network monitoring, device management, secure remote access, and system administration through a modern web dashboard.

---

## ✨ Features

### 🌐 DNS Filtering
- DNS-based ad blocking
- Malware protection
- Custom blacklists and whitelists
- Wildcard domain filtering
- Category-based filtering
- DNS query logging
- DNS cache

### 📊 Live Dashboard
- Real-time CPU usage
- Memory usage
- Disk usage
- Network activity
- System uptime
- Active devices
- Server health
- Live charts

### 🖥️ Server Monitoring
- CPU information
- RAM usage
- Storage monitoring
- Temperature monitoring (where supported)
- Process monitoring
- Network interfaces
- System logs

### 📱 Device Management
- Discover devices on your network
- Rename devices
- Device groups
- Per-device filtering
- Device activity history

### 🔒 Security
- Fully self-hosted authentication
- Local user accounts
- Role-based permissions
- Audit logging
- Secure password hashing
- Session management

### 🌍 Tunnel Manager
- Cloudflare Tunnel integration
- Secure remote access
- Public URL management
- Tunnel health monitoring
- Zero Trust support (planned)

### 🐳 Docker Management (Planned)
- View running containers
- Start/Stop containers
- Restart containers
- View logs
- Container resource usage

### 🤖 AI Insights (Planned)
- Daily network summaries
- Security recommendations
- Suspicious activity detection
- Usage reports

---

# 🚀 Why CriderShield?

Unlike traditional DNS blockers, CriderShield is designed to become a complete self-hosted infrastructure management platform.

It combines:

- DNS Filtering
- Network Monitoring
- Server Monitoring
- Tunnel Management
- Docker Management
- Device Management
- Security Tools
- AI Insights

...into a single dashboard.

---

# 🏗️ Technology Stack

## Frontend
- React
- TypeScript
- Tailwind CSS

## Backend
- Node.js
- Express

## Database
- SQLite (default)
- PostgreSQL (planned)

## Deployment
- Docker Compose
- Ubuntu Server
- Linux

---

# 🔐 Authentication

CriderShield is fully self-hosted.

No Firebase.

No Supabase.

No Auth0.

No cloud authentication providers.

All users are stored securely inside the local server database using encrypted password hashing.

The backend is the source of truth for authentication and sessions.

---

# 📦 Installation

Coming soon.

The project will support:

```bash
git clone https://github.com/1995F150/CriderShield.git

cd CriderShield

docker compose up -d
```

---

# 📈 Roadmap

- [x] Project Foundation
- [x] Dashboard UI
- [x] Authentication
- [ ] System Monitoring
- [ ] DNS Filtering Engine
- [ ] Device Discovery
- [ ] Query Logging
- [ ] Tunnel Manager
- [ ] Docker Management
- [ ] Backup & Restore
- [ ] Plugin System
- [ ] AI Insights
- [ ] Mobile Dashboard

---

# 📄 License

License coming soon.

---

# 👨‍💻 Developer

**Jessie Crider**

Founder of **CriderGPT LLC**

Virginia, USA

---

# ⭐ Contributing

Contributions, bug reports, feature requests, and pull requests will be welcome once the project reaches its first stable release.

---

# ⚠️ Disclaimer

CriderShield is intended for managing systems and networks that you own or are authorized to administer. Always deploy responsibly and follow applicable laws, regulations, and organizational policies.

---

Made with ❤️ by CriderGPT LLC
