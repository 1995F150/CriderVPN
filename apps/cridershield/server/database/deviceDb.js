const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = process.env.CRIDER_DATA_DIR || path.join(__dirname, '../../data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new sqlite3.Database(process.env.DB_PATH || path.join(dataDir, 'devices.db'));

const extraColumns = {
  connection_type: 'TEXT',
  interface_name: 'TEXT',
  role: 'TEXT',
  confidence: 'INTEGER DEFAULT 0',
  sources: 'TEXT',
  favorite: 'INTEGER DEFAULT 0',
  dns_queries: 'INTEGER DEFAULT 0',
  blocked_queries: 'INTEGER DEFAULT 0',
  bytes_up: 'INTEGER',
  bytes_down: 'INTEGER',
  metadata: 'TEXT',
  internet_blocked: 'INTEGER DEFAULT 0'
};

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS devices (
    mac_address TEXT PRIMARY KEY, ip_address TEXT, hostname TEXT, friendly_name TEXT,
    vendor TEXT, device_type TEXT, os TEXT, first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'Online',
    notes TEXT, tags TEXT, group_name TEXT, icon TEXT
  )`);

  db.all('PRAGMA table_info(devices)', (error, rows = []) => {
    if (error) return console.error('Unable to inspect devices schema:', error.message);
    const existing = new Set(rows.map(row => row.name));
    for (const [name, definition] of Object.entries(extraColumns)) {
      if (!existing.has(name)) {
        db.run(`ALTER TABLE devices ADD COLUMN ${name} ${definition}`);
      }
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS device_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mac_address TEXT NOT NULL,
    ip_address TEXT,
    status TEXT,
    observed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_device_history_mac_time ON device_history(mac_address, observed_at DESC)');

  db.run(`CREATE TABLE IF NOT EXISTS device_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mac_address TEXT,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged INTEGER DEFAULT 0
  )`);
});

const clean = value => value === undefined || value === null || value === '' ? null : value;
const json = value => JSON.stringify(value || {});

const addEvent = (mac, type, message) => {
  db.run(
    'INSERT INTO device_events (mac_address, event_type, message) VALUES (?, ?, ?)',
    [mac || null, type, message]
  );
};

const upsertDevice = (device, callback = () => {}) => {
  const mac = String(device.mac_address || '').toLowerCase();
  if (!mac) return callback(new Error('mac_address or stable device key is required'));

  db.get('SELECT * FROM devices WHERE mac_address = ?', [mac], (lookupError, existing) => {
    if (lookupError) return callback(lookupError);

    const values = [
      mac,
      clean(device.ip_address),
      clean(device.hostname),
      clean(device.vendor),
      clean(device.device_type),
      clean(device.os),
      device.status || 'Online',
      clean(device.icon),
      clean(device.connection_type),
      clean(device.interface_name),
      clean(device.role),
      Number(device.confidence || 0),
      json(device.sources),
      Number(device.dns_queries || 0),
      Number(device.blocked_queries || 0),
      device.bytes_up ?? null,
      device.bytes_down ?? null,
      json(device.metadata)
    ];

    db.run(`INSERT INTO devices (
      mac_address, ip_address, hostname, vendor, device_type, os, status, icon,
      connection_type, interface_name, role, confidence, sources, dns_queries,
      blocked_queries, bytes_up, bytes_down, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(mac_address) DO UPDATE SET
      ip_address = COALESCE(excluded.ip_address, devices.ip_address),
      hostname = COALESCE(excluded.hostname, devices.hostname),
      vendor = COALESCE(excluded.vendor, devices.vendor),
      device_type = COALESCE(excluded.device_type, devices.device_type),
      os = COALESCE(excluded.os, devices.os),
      status = excluded.status,
      icon = COALESCE(devices.icon, excluded.icon),
      connection_type = COALESCE(excluded.connection_type, devices.connection_type),
      interface_name = COALESCE(excluded.interface_name, devices.interface_name),
      role = COALESCE(excluded.role, devices.role),
      confidence = MAX(excluded.confidence, devices.confidence),
      sources = excluded.sources,
      dns_queries = excluded.dns_queries,
      blocked_queries = excluded.blocked_queries,
      bytes_up = excluded.bytes_up,
      bytes_down = excluded.bytes_down,
      metadata = excluded.metadata,
      last_seen = CURRENT_TIMESTAMP`, values, function (writeError) {
      if (writeError) return callback(writeError);

      const changed = !existing ||
        existing.ip_address !== device.ip_address ||
        existing.status !== (device.status || 'Online');

      if (!existing) {
        addEvent(mac, 'new_device', `${device.hostname || device.role || device.vendor || 'A new device'} joined the network`);
      }

      if (changed) {
        db.run(
          'INSERT INTO device_history (mac_address, ip_address, status, metadata) VALUES (?, ?, ?, ?)',
          [mac, clean(device.ip_address), device.status || 'Online', json(device.metadata)]
        );
      }
      callback(null, { created: !existing });
    });
  });
};

const markInactive = (callback = () => {}) => {
  db.all(
    `SELECT mac_address, COALESCE(friendly_name, hostname, role, vendor, ip_address, 'Device') AS name, status,
      CASE
        WHEN last_seen < datetime('now', '-5 minutes') THEN 'Offline'
        WHEN last_seen < datetime('now', '-90 seconds') THEN 'Idle'
        ELSE 'Online'
      END AS next_status
     FROM devices`,
    (error, rows = []) => {
      if (error) return callback(error);
      const changed = rows.filter(row => row.status !== row.next_status);
      db.run(`UPDATE devices SET status = CASE
        WHEN last_seen < datetime('now', '-5 minutes') THEN 'Offline'
        WHEN last_seen < datetime('now', '-90 seconds') THEN 'Idle'
        ELSE 'Online'
      END`, updateError => {
        if (!updateError) {
          changed.forEach(row => addEvent(
            row.mac_address,
            row.next_status === 'Offline' ? 'offline' : 'status',
            `${row.name} is now ${row.next_status.toLowerCase()}`
          ));
        }
        callback(updateError);
      });
    }
  );
};

const getDevices = (callback) => db.all(
  `SELECT * FROM devices
   ORDER BY favorite DESC,
     CASE status WHEN 'Online' THEN 0 WHEN 'Idle' THEN 1 ELSE 2 END,
     last_seen DESC`,
  callback
);

const getByIp = (ip, callback) => db.get('SELECT * FROM devices WHERE ip_address = ?', [ip], callback);
const getDevice = (mac, callback) => db.get('SELECT * FROM devices WHERE mac_address = ?', [mac.toLowerCase()], callback);

const setInternetBlocked = (mac, blocked, callback) => {
  db.run(
    'UPDATE devices SET internet_blocked = ? WHERE mac_address = ?',
    [blocked ? 1 : 0, mac.toLowerCase()],
    function (error) {
      if (!error && this.changes) {
        addEvent(
          mac.toLowerCase(),
          blocked ? 'internet_blocked' : 'internet_restored',
          blocked ? 'Internet access was blocked for this device' : 'Internet access was restored for this device'
        );
      }
      callback(error, this.changes);
    }
  );
};

const getBlockedDevices = (callback) => db.all(
  'SELECT mac_address, ip_address FROM devices WHERE internet_blocked = 1',
  callback
);

const purgeInvalidDiscoveryRecords = (callback = () => {}) => {
  const invalidMacs = ['00:00:00:00:00:00', 'ff:ff:ff:ff:ff:ff'];
  const placeholders = invalidMacs.map(() => '?').join(', ');

  db.serialize(() => {
    db.run(`DELETE FROM device_history WHERE mac_address IN (${placeholders})`, invalidMacs);
    db.run(`DELETE FROM device_events WHERE mac_address IN (${placeholders})`, invalidMacs);
    db.run(`DELETE FROM devices WHERE mac_address IN (${placeholders})`, invalidMacs, callback);
  });
};

const updateDevice = (mac, data, callback) => {
  db.run(
    `UPDATE devices SET
      friendly_name = ?,
      icon = ?,
      group_name = ?,
      notes = ?,
      favorite = ?
     WHERE mac_address = ?`,
    [
      clean(data.friendly_name),
      clean(data.icon),
      clean(data.group_name),
      clean(data.notes),
      data.favorite ? 1 : 0,
      mac.toLowerCase()
    ],
    callback
  );
};

const getHistory = (mac, limit, callback) => db.all(
  'SELECT * FROM device_history WHERE mac_address = ? ORDER BY observed_at DESC LIMIT ?',
  [mac.toLowerCase(), Math.min(Math.max(Number(limit) || 100, 1), 1000)],
  callback
);

const getEvents = (limit, callback) => db.all(
  'SELECT * FROM device_events ORDER BY created_at DESC LIMIT ?',
  [Math.min(Math.max(Number(limit) || 50, 1), 250)],
  callback
);

const acknowledgeEvent = (id, callback) => db.run(
  'UPDATE device_events SET acknowledged = 1 WHERE id = ?',
  [id],
  callback
);

module.exports = {
  upsertDevice,
  markInactive,
  getDevices,
  getByIp,
  getDevice,
  setInternetBlocked,
  getBlockedDevices,
  purgeInvalidDiscoveryRecords,
  updateDevice,
  getHistory,
  getEvents,
  acknowledgeEvent,
  db
};
