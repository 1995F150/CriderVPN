const express = require('express');
const router = express.Router();
const deviceDb = require('../database/deviceDb');
const scanner = require('../services/scanner');
const accessControl = require('../services/accessControl');

const deserialize = row => ({
  ...row,
  favorite: Boolean(row.favorite),
  internet_blocked: Boolean(row.internet_blocked),
  confidence: Number(row.confidence || 0),
  dns_queries: Number(row.dns_queries || 0),
  blocked_queries: Number(row.blocked_queries || 0),
  sources: (() => { try { return JSON.parse(row.sources || '[]'); } catch { return []; } })(),
  metadata: (() => { try { return JSON.parse(row.metadata || '{}'); } catch { return {}; } })()
});

router.get('/', (req, res) => {
  deviceDb.getDevices((error, rows) => {
    if (error) return res.status(500).json({ error: error.message });
    res.json(rows.map(deserialize));
  });
});

router.post('/scan', async (req, res) => {
  try {
    res.json(await scanner.scan());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/scan/status', (req, res) => {
  res.json(scanner.getScanStatus());
});

router.get('/topology', (req, res) => {
  deviceDb.getDevices((error, rows) => {
    if (error) return res.status(500).json({ error: error.message });
    const devices = rows.map(deserialize);
    const gateway = devices.find(device => device.role === 'Gateway Router');
    const server = devices.find(device => device.role === 'VPN Gateway');
    const shared = devices.filter(device => device.role === 'Shared LAN');
    const clients = devices.filter(device => !['Gateway Router', 'VPN Gateway', 'Shared LAN'].includes(device.role));

    const nodes = devices.map(device => ({
      id: device.mac_address,
      label: device.friendly_name || device.hostname || device.role || device.vendor || device.ip_address || 'Unknown Device',
      type: device.device_type,
      status: device.status,
      ip: device.ip_address
    }));
    const edges = [];
    if (gateway && server) edges.push({ from: gateway.mac_address, to: server.mac_address, type: 'uplink' });
    shared.forEach(network => {
      if (server) edges.push({ from: server.mac_address, to: network.mac_address, type: 'shared' });
    });
    clients.forEach(client => {
      const parent = client.connection_type === 'Tailscale'
        ? server
        : shared[0] || server || gateway;
      if (parent) edges.push({ from: parent.mac_address, to: client.mac_address, type: client.connection_type || 'network' });
    });

    res.json({ nodes, edges });
  });
});

router.get('/events', (req, res) => {
  deviceDb.getEvents(req.query.limit, (error, rows) => {
    if (error) return res.status(500).json({ error: error.message });
    res.json(rows);
  });
});

router.post('/events/:id/acknowledge', (req, res) => {
  deviceDb.acknowledgeEvent(req.params.id, error => {
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });
});

router.post('/:mac/internet-access', (req, res) => {
  const blocked = req.body?.blocked;
  if (typeof blocked !== 'boolean') {
    return res.status(400).json({ error: 'blocked must be true or false' });
  }

  deviceDb.getDevice(req.params.mac, async (lookupError, device) => {
    if (lookupError) return res.status(500).json({ error: lookupError.message });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const protectedRoles = new Set(['Gateway Router', 'VPN Gateway', 'Shared LAN']);
    if (protectedRoles.has(device.role)) {
      return res.status(409).json({ error: `${device.role} is protected from client blocking` });
    }
    if (!device.ip_address) {
      return res.status(409).json({ error: 'This device has no usable IP address yet' });
    }

    try {
      await accessControl.apply(device.ip_address, blocked);
      deviceDb.setInternetBlocked(req.params.mac, blocked, async (writeError, changes) => {
        if (writeError || !changes) {
          try { await accessControl.apply(device.ip_address, !blocked); } catch {}
          return res.status(writeError ? 500 : 404).json({
            error: writeError?.message || 'Device not found'
          });
        }
        res.json({
          success: true,
          internet_blocked: blocked,
          ip_address: device.ip_address
        });
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

router.get('/:mac/history', (req, res) => {
  deviceDb.getHistory(req.params.mac, req.query.limit, (error, rows) => {
    if (error) return res.status(500).json({ error: error.message });
    res.json(rows.map(row => ({
      ...row,
      metadata: (() => { try { return JSON.parse(row.metadata || '{}'); } catch { return {}; } })()
    })));
  });
});

router.put('/:mac', (req, res) => {
  const allowed = {
    friendly_name: String(req.body.friendly_name || '').trim().slice(0, 120),
    icon: String(req.body.icon || '').trim().slice(0, 40),
    group_name: String(req.body.group_name || '').trim().slice(0, 80),
    notes: String(req.body.notes || '').trim().slice(0, 1000),
    favorite: Boolean(req.body.favorite)
  };
  deviceDb.updateDevice(req.params.mac, allowed, error => {
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });
});

module.exports = router;
