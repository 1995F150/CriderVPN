const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(process.env.DB_PATH || path.join(__dirname, '../../data/devices.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS devices (
    mac_address TEXT PRIMARY KEY, ip_address TEXT, hostname TEXT, friendly_name TEXT,
    vendor TEXT, device_type TEXT, os TEXT, first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'Online',
    notes TEXT, tags TEXT, group_name TEXT, icon TEXT
  )`);
});

const upsertDevice = (dev) => {
  db.get(`SELECT * FROM devices WHERE mac_address = ?`, [dev.mac_address], (err, row) => {
    if (!row) {
      db.run(`INSERT INTO devices (mac_address, ip_address, status) VALUES (?, ?, ?)`, [dev.mac_address, dev.ip_address, 'Online']);
    } else {
      db.run(`UPDATE devices SET ip_address = ?, last_seen = CURRENT_TIMESTAMP, status = 'Online' WHERE mac_address = ?`, [dev.ip_address, dev.mac_address]);
    }
  });
};

const markOffline = () => db.run(`UPDATE devices SET status = 'Offline' WHERE last_seen < datetime('now', '-5 minutes')`);
const getDevices = (cb) => db.all(`SELECT * FROM devices ORDER BY last_seen DESC`, cb);
const updateDevice = (mac, data, cb) => {
  db.run(`UPDATE devices SET friendly_name = ?, icon = ?, group_name = ?, notes = ? WHERE mac_address = ?`, [data.friendly_name, data.icon, data.group_name, data.notes, mac], cb);
};

module.exports = { upsertDevice, markOffline, getDevices, updateDevice, db };
