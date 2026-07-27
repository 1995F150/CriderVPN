const { execFile } = require('child_process');
const dns = require('dns').promises;
const dgram = require('dgram');
const fs = require('fs');
const os = require('os');
const deviceDb = require('../database/deviceDb');
const pihole = require('./pihole');

const commandPaths = {
  ip: ['/usr/sbin/ip', '/usr/bin/ip'],
  arp: ['/usr/sbin/arp', '/usr/bin/arp'],
  hostname: ['/usr/bin/hostname', '/bin/hostname'],
  nmcli: ['/usr/bin/nmcli'],
  tailscale: ['/usr/bin/tailscale'],
  avahi: ['/usr/bin/avahi-resolve-address'],
  netbios: ['/usr/bin/nmblookup'],
  ping: ['/usr/bin/ping', '/bin/ping']
};

let ouiCache;
let runningScan = null;
let lastScan = { running: false, startedAt: null, completedAt: null, devices: 0, sources: [] };

const executable = name => (commandPaths[name] || []).find(file => fs.existsSync(file));

const run = (name, args, timeout = 2500) => new Promise(resolve => {
  const file = executable(name);
  if (!file) return resolve('');
  execFile(file, args, { timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
    resolve(error && !stdout ? '' : String(stdout || ''));
  });
});

const normalizeMac = value => {
  const compact = String(value || '').trim().toLowerCase().replace(/-/g, ':');
  return /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(compact) ? compact : '';
};

const isUsableIp = ip => Boolean(ip) && ip !== '0.0.0.0' && ip !== '::' && !String(ip).startsWith('fe80::');

const addEvidence = (records, evidence, source, nameRank = 99) => {
  if (!isUsableIp(evidence.ip_address) && !evidence.stable_key) return;
  const mac = normalizeMac(evidence.mac_address);
  let key = evidence.stable_key || mac;
  let existingEntry = [...records.entries()].find(([, row]) =>
    evidence.ip_address && row.ip_address === evidence.ip_address
  );

  if (!key && existingEntry) key = existingEntry[0];
  if (!key) key = `virtual:ip:${evidence.ip_address}`;

  if (mac && existingEntry && existingEntry[0].startsWith('virtual:')) {
    records.delete(existingEntry[0]);
    existingEntry = null;
  }

  const current = records.get(key) || existingEntry?.[1] || {
    mac_address: mac || key,
    sources: new Set(),
    metadata: {},
    confidence: 0,
    _nameRank: 999
  };

  if (existingEntry && existingEntry[0] !== key) records.delete(existingEntry[0]);
  current.mac_address = mac || current.mac_address || key;
  current.sources.add(source);
  current.confidence = Math.min(100, current.confidence + (evidence.confidence || 8));

  for (const field of [
    'ip_address', 'vendor', 'device_type', 'os', 'connection_type',
    'interface_name', 'role', 'icon', 'status'
  ]) {
    if (evidence[field] !== undefined && evidence[field] !== null && evidence[field] !== '') {
      if (!current[field] || evidence.force) current[field] = evidence[field];
    }
  }

  if (evidence.hostname && (nameRank < current._nameRank || !current.hostname)) {
    current.hostname = evidence.hostname.replace(/\.$/, '');
    current._nameRank = nameRank;
  }

  current.dns_queries = Math.max(current.dns_queries || 0, evidence.dns_queries || 0);
  current.blocked_queries = Math.max(current.blocked_queries || 0, evidence.blocked_queries || 0);
  current.metadata = { ...current.metadata, ...(evidence.metadata || {}) };
  records.set(key, current);
};

const loadOui = () => {
  if (ouiCache) return ouiCache;
  ouiCache = new Map();
  const files = [
    '/usr/share/nmap/nmap-mac-prefixes',
    '/usr/share/ieee-data/oui.txt',
    '/var/lib/ieee-data/oui.txt'
  ];

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    try {
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        let match = line.match(/^([0-9A-Fa-f]{6})\s+(.+)$/);
        if (!match) match = line.match(/^([0-9A-Fa-f-]{8})\s+\(hex\)\s+(.+)$/);
        if (!match) continue;
        const prefix = match[1].replace(/-/g, '').toUpperCase().slice(0, 6);
        if (!ouiCache.has(prefix)) ouiCache.set(prefix, match[2].trim());
      }
    } catch (error) {
      console.warn(`Unable to read OUI database ${file}: ${error.message}`);
    }
    if (ouiCache.size) break;
  }
  return ouiCache;
};

const lookupVendor = mac => {
  const normalized = normalizeMac(mac);
  if (!normalized) return '';
  return loadOui().get(normalized.replace(/:/g, '').toUpperCase().slice(0, 6)) || '';
};

const connectionFromInterface = iface => {
  const value = String(iface || '').toLowerCase();
  if (value === 'tailscale0') return 'Tailscale';
  if (value.startsWith('wl')) return 'Wi-Fi';
  if (value.startsWith('docker')) return 'Docker';
  if (value.startsWith('br-') || value === 'bridge') return 'Bridge';
  if (value.startsWith('veth')) return 'Container';
  if (value.startsWith('virbr') || value.startsWith('vnet')) return 'Virtual Machine';
  if (value.startsWith('en') || value.startsWith('eth')) return 'Ethernet';
  return '';
};

const classify = (device, context) => {
  const text = [
    device.hostname, device.vendor, device.metadata?.ssdpServer,
    device.metadata?.ssdpType, device.metadata?.netbios
  ].filter(Boolean).join(' ').toLowerCase();

  if (context.gatewayIps.has(device.ip_address)) {
    Object.assign(device, {
      hostname: device.hostname || 'Router',
      role: 'Gateway Router',
      device_type: 'Router',
      icon: 'globe',
      confidence: 100
    });
  } else if (device.mac_address === 'virtual:server' || context.localIps.has(device.ip_address)) {
    Object.assign(device, {
      hostname: os.hostname(),
      role: 'VPN Gateway',
      device_type: 'Server',
      os: `${os.type()} ${os.release()}`,
      icon: 'server',
      confidence: 100,
      metadata: {
        ...device.metadata,
        addresses: [...context.localIps],
        sharedAddresses: [...context.sharedIps],
        services: ['CriderShield', 'Pi-hole', 'Tailscale', 'Squid', 'SOCKS5']
      }
    });
  } else if (device.role === 'Shared LAN') {
    Object.assign(device, { device_type: 'Network', icon: 'share', confidence: 100 });
  } else if (device.connection_type === 'Tailscale') {
    Object.assign(device, { role: 'Tailscale Device', icon: 'lock', confidence: Math.max(device.confidence, 90) });
  }

  if (!device.device_type) {
    if (/iphone|android.*phone|pixel|galaxy|phone/.test(text)) device.device_type = 'Phone';
    else if (/ipad|tablet/.test(text)) device.device_type = 'Tablet';
    else if (/printer|epson|brother|canon|laserjet/.test(text)) device.device_type = 'Printer';
    else if (/camera|ring|wyze|reolink/.test(text)) device.device_type = 'Camera';
    else if (/playstation|xbox|nintendo|console/.test(text)) device.device_type = 'Game Console';
    else if (/roku|bravia|smart.?tv|chromecast|webos/.test(text)) device.device_type = 'Smart TV';
    else if (/nas|synology|qnap/.test(text)) device.device_type = 'NAS';
    else if (/router|gateway|archer|ubiquiti|cisco/.test(text)) device.device_type = 'Router';
    else if (/server|ubuntu|debian|raspberry/.test(text)) device.device_type = 'Server';
    else if (/laptop|macbook|thinkpad/.test(text)) device.device_type = 'Laptop';
    else if (/windows|desktop|imac/.test(text)) device.device_type = 'Desktop';
    else if (/amazon|google|nest|iot|esp|tuya/.test(text)) device.device_type = 'IoT Device';
    else device.device_type = 'Device';
  }

  if (!device.os) {
    if (/windows|microsoft/.test(text)) device.os = 'Windows';
    else if (/ubuntu/.test(text)) device.os = 'Ubuntu';
    else if (/debian/.test(text)) device.os = 'Debian';
    else if (/android|pixel|galaxy/.test(text)) device.os = 'Android';
    else if (/iphone|ipad|ios/.test(text)) device.os = 'iOS';
    else if (/macbook|imac|macos/.test(text)) device.os = 'macOS';
    else if (/chromebook|chromeos/.test(text)) device.os = 'ChromeOS';
    else if (device.metadata?.ttl <= 64) device.os = 'Linux / mobile Unix';
    else if (device.metadata?.ttl <= 128) device.os = 'Windows-like';
    else if (device.metadata?.ttl) device.os = 'Network appliance';
  }

  device.connection_type ||= connectionFromInterface(device.interface_name) || 'Network';
  device.status ||= 'Online';
  device.vendor ||= lookupVendor(device.mac_address);
  if (device.vendor) device.confidence = Math.min(100, device.confidence + 18);
  if (device.hostname) device.confidence = Math.min(100, device.confidence + 15);
  if (device.os) device.confidence = Math.min(100, device.confidence + 8);
  device.sources = [...device.sources].sort();
  delete device._nameRank;
  return device;
};

const collectNeighbors = async records => {
  let output = await run('ip', ['neigh', 'show']);
  for (const line of output.split('\n')) {
    const fields = line.trim().split(/\s+/);
    const macIndex = fields.indexOf('lladdr');
    if (!fields[0] || macIndex < 0) continue;
    const state = fields.at(-1);
    if (state === 'FAILED' || state === 'INCOMPLETE') continue;
    addEvidence(records, {
      ip_address: fields[0],
      mac_address: fields[macIndex + 1],
      interface_name: fields[fields.indexOf('dev') + 1],
      connection_type: connectionFromInterface(fields[fields.indexOf('dev') + 1]),
      status: state === 'STALE' || state === 'DELAY' ? 'Idle' : 'Online',
      confidence: 24,
      metadata: { neighborState: state }
    }, 'ip-neigh');
  }

  if (fs.existsSync('/proc/net/arp')) {
    for (const line of fs.readFileSync('/proc/net/arp', 'utf8').split('\n').slice(1)) {
      const fields = line.trim().split(/\s+/);
      if (fields.length < 6) continue;
      addEvidence(records, {
        ip_address: fields[0],
        mac_address: fields[3],
        interface_name: fields[5],
        connection_type: connectionFromInterface(fields[5]),
        confidence: 20
      }, 'proc-net-arp');
    }
  }

  output = await run('arp', ['-an']);
  for (const line of output.split('\n')) {
    const match = line.match(/\(([^)]+)\) at ([0-9a-f:]{17}).* on (\S+)/i);
    if (match) addEvidence(records, {
      ip_address: match[1],
      mac_address: match[2],
      interface_name: match[3],
      connection_type: connectionFromInterface(match[3]),
      confidence: 16
    }, 'arp');
  }
};

const collectNetworkRoles = async records => {
  const context = { gatewayIps: new Set(), localIps: new Set(), sharedIps: new Set() };
  const routes = await run('ip', ['route', 'show']);
  for (const line of routes.split('\n')) {
    const gateway = line.match(/^default via (\S+)(?:.* dev (\S+))?/);
    if (gateway) {
      context.gatewayIps.add(gateway[1]);
      addEvidence(records, {
        ip_address: gateway[1],
        hostname: 'Router',
        role: 'Gateway Router',
        device_type: 'Router',
        interface_name: gateway[2],
        connection_type: connectionFromInterface(gateway[2]),
        status: 'Online',
        confidence: 60
      }, 'ip-route', 20);
    }
  }

  const addresses = await run('hostname', ['-I']);
  addresses.trim().split(/\s+/).filter(isUsableIp).forEach(ip => context.localIps.add(ip));
  const addrOutput = await run('ip', ['-o', 'addr', 'show']);
  for (const line of addrOutput.split('\n')) {
    const match = line.match(/^\d+:\s+(\S+)\s+(?:inet6?|inet)\s+(\S+)/);
    if (match) context.localIps.add(match[2].split('/')[0]);
  }

  const primaryIp = [...context.localIps].find(ip => !ip.startsWith('100.') && !ip.startsWith('172.17.')) || [...context.localIps][0];
  if (primaryIp) addEvidence(records, {
    stable_key: 'virtual:server',
    ip_address: primaryIp,
    hostname: os.hostname(),
    role: 'VPN Gateway',
    device_type: 'Server',
    connection_type: 'Local',
    status: 'Online',
    confidence: 80,
    force: true,
    metadata: { addresses: [...context.localIps] }
  }, 'local-interfaces', 1);

  const active = await run('nmcli', ['-t', '-f', 'UUID,DEVICE', 'connection', 'show', '--active']);
  for (const line of active.split('\n')) {
    const [uuid, iface] = line.split(':');
    if (!uuid || !iface) continue;
    const details = await run('nmcli', ['-g', 'ipv4.method,ipv4.addresses', 'connection', 'show', 'uuid', uuid]);
    const values = details.trim().split('\n');
    if (values[0] !== 'shared') continue;
    const ip = String(values[1] || '').split('/')[0];
    if (!isUsableIp(ip)) continue;
    context.sharedIps.add(ip);
    addEvidence(records, {
      stable_key: `virtual:shared:${iface}`,
      ip_address: ip,
      hostname: 'Shared LAN',
      role: 'Shared LAN',
      device_type: 'Network',
      interface_name: iface,
      connection_type: 'Bridge',
      status: 'Online',
      confidence: 80,
      force: true
    }, 'networkmanager', 2);
  }
  return context;
};

const collectDhcp = records => {
  const files = [
    '/var/lib/misc/dnsmasq.leases',
    '/var/lib/NetworkManager/dnsmasq.leases',
    '/var/lib/dhcp/dhcpd.leases'
  ];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    try {
      const text = fs.readFileSync(file, 'utf8');
      for (const line of text.split('\n')) {
        const match = line.match(/^\d+\s+([0-9a-f:]{17})\s+(\S+)\s+(\S+)/i);
        if (match) addEvidence(records, {
          mac_address: match[1],
          ip_address: match[2],
          hostname: match[3] === '*' ? '' : match[3],
          confidence: 30
        }, 'dhcp', 3);
      }
    } catch {}
  }
};

const collectTailscale = async records => {
  const output = await run('tailscale', ['status', '--json'], 4000);
  if (!output) return;
  try {
    const status = JSON.parse(output);
    const nodes = [status.Self, ...Object.values(status.Peer || {})].filter(Boolean);
    for (const node of nodes) {
      const ip = (node.TailscaleIPs || [])[0];
      if (!ip) continue;
      addEvidence(records, {
        stable_key: `virtual:tailscale:${node.ID || ip}`,
        ip_address: ip,
        hostname: node.HostName || node.DNSName,
        role: node === status.Self ? 'VPN Gateway' : 'Tailscale Device',
        connection_type: 'Tailscale',
        os: node.OS,
        status: node.Online === false ? 'Offline' : 'Online',
        confidence: 55,
        metadata: { tailscaleId: node.ID, tailscaleDnsName: node.DNSName }
      }, 'tailscale', 5);
    }
  } catch {}
};

const collectPiHole = async records => {
  try {
    const queries = await pihole.getQueries({ limit: 500 });
    const clients = new Map();
    for (const query of queries) {
      if (!query.client_ip) continue;
      const row = clients.get(query.client_ip) || { total: 0, blocked: 0, name: '' };
      row.total += 1;
      if (query.action === 'BLOCK') row.blocked += 1;
      row.name ||= query.client_name || '';
      clients.set(query.client_ip, row);
    }
    for (const [ip, row] of clients) {
      addEvidence(records, {
        ip_address: ip,
        hostname: row.name,
        dns_queries: row.total,
        blocked_queries: row.blocked,
        confidence: row.name ? 35 : 15
      }, 'pihole', 1);
    }
  } catch {}
};

const collectSsdp = () => new Promise(resolve => {
  if (process.env.ACTIVE_DISCOVERY === 'false') return resolve(new Map());
  const found = new Map();
  const socket = dgram.createSocket('udp4');
  const timer = setTimeout(() => {
    try { socket.close(); } catch {}
    resolve(found);
  }, 1400);
  timer.unref();

  socket.on('message', (message, remote) => {
    const headers = {};
    for (const line of message.toString().split(/\r?\n/).slice(1)) {
      const index = line.indexOf(':');
      if (index > 0) headers[line.slice(0, index).toLowerCase()] = line.slice(index + 1).trim();
    }
    found.set(remote.address, headers);
  });
  socket.on('error', () => {
    clearTimeout(timer);
    try { socket.close(); } catch {}
    resolve(found);
  });
  socket.bind(() => {
    const request = Buffer.from(
      'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 1\r\nST: ssdp:all\r\n\r\n'
    );
    socket.send(request, 1900, '239.255.255.250');
  });
});

const resolveIdentity = async (device, ssdp) => {
  const ip = device.ip_address;
  if (!ip || ip.includes(':')) return device;

  const timeout = (promise, ms = 1200) => Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(null), ms))
  ]);

  const reverse = timeout(dns.reverse(ip).catch(() => []));
  const avahi = run('avahi', [ip], 1400);
  const netbios = run('netbios', ['-A', ip], 1600);
  const ping = run('ping', ['-c', '1', '-W', '1', ip], 1600);
  const [reverseNames, avahiText, netbiosText, pingText] = await Promise.all([reverse, avahi, netbios, ping]);

  if (!device.hostname && Array.isArray(reverseNames) && reverseNames[0]) {
    device.hostname = reverseNames[0].replace(/\.$/, '');
    device.sources.add('reverse-dns');
    device.confidence += 18;
  }
  const avahiMatch = avahiText.match(/\s([^\s]+\.local)\s*$/m);
  if (!device.hostname && avahiMatch) {
    device.hostname = avahiMatch[1];
    device.sources.add('mdns');
    device.confidence += 20;
  }
  const netbiosMatch = netbiosText.match(/^\s*([^\s<]+)\s+<00>/m);
  if (!device.hostname && netbiosMatch) {
    device.hostname = netbiosMatch[1];
    device.sources.add('netbios');
    device.confidence += 20;
  }
  const ttl = pingText.match(/ttl[= ](\d+)/i);
  if (ttl) {
    device.metadata.ttl = Number(ttl[1]);
    device.sources.add('icmp');
  }
  const service = ssdp.get(ip);
  if (service) {
    device.metadata.ssdpServer = service.server;
    device.metadata.ssdpType = service.st;
    device.metadata.upnpLocation = service.location;
    device.sources.add('ssdp');
    device.confidence += 15;
  }
  return device;
};

const persist = device => new Promise((resolve, reject) => {
  deviceDb.upsertDevice(device, error => error ? reject(error) : resolve());
});

const scan = async () => {
  if (runningScan) return runningScan;
  runningScan = (async () => {
    lastScan = { ...lastScan, running: true, startedAt: new Date().toISOString() };
    const records = new Map();
    const sources = [];

    const context = await collectNetworkRoles(records);
    sources.push('ip-route', 'local-interfaces', 'networkmanager');

    await Promise.all([
      collectNeighbors(records).then(() => sources.push('ip-neigh', 'proc-net-arp', 'arp')),
      collectTailscale(records).then(() => sources.push('tailscale')),
      collectPiHole(records).then(() => sources.push('pihole'))
    ]);
    collectDhcp(records);
    sources.push('dhcp');

    const ssdp = await collectSsdp();
    if (ssdp.size) sources.push('ssdp');

    const devices = await Promise.all([...records.values()].map(device => resolveIdentity(device, ssdp)));
    for (const device of devices) {
      device.vendor ||= lookupVendor(device.mac_address);
      classify(device, context);
      await persist(device);
    }

    await new Promise(resolve => deviceDb.markInactive(() => resolve()));
    lastScan = {
      running: false,
      startedAt: lastScan.startedAt,
      completedAt: new Date().toISOString(),
      devices: devices.length,
      sources: [...new Set(sources)]
    };
    return lastScan;
  })().catch(error => {
    lastScan = { ...lastScan, running: false, completedAt: new Date().toISOString(), error: error.message };
    console.error('Device discovery failed:', error);
    throw error;
  }).finally(() => {
    runningScan = null;
  });
  return runningScan;
};

const startScanner = () => {
  scan().catch(() => {});
  const interval = setInterval(() => scan().catch(() => {}), Number(process.env.SCANNER_INTERVAL_MS || 30000));
  interval.unref();
};

const getScanStatus = () => lastScan;

module.exports = {
  startScanner,
  scan,
  getScanStatus,
  normalizeMac,
  connectionFromInterface,
  lookupVendor
};
