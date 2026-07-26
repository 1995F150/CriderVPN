const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(path.join(dataDir, 'dns_logs.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS dns_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    domain TEXT,
    query_type TEXT,
    client_ip TEXT,
    device_name TEXT,
    mac_address TEXT,
    action TEXT,
    rule TEXT,
    upstream TEXT,
    response_time INTEGER,
    cache_hit BOOLEAN,
    response_code TEXT
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_domain ON dns_logs(domain)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_client_ip ON dns_logs(client_ip)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON dns_logs(timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_action ON dns_logs(action)`);
});

const insertLog = (log) => {
  const stmt = db.prepare(`INSERT INTO dns_logs (domain, query_type, client_ip, action, rule, upstream, response_time, cache_hit, response_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  stmt.run(log.domain, log.queryType || 'A', log.clientIp, log.status, log.rule, log.upstream || '1.1.1.1', log.responseTime || 0, log.cacheHit ? 1 : 0, log.responseCode || 'NOERROR');
  stmt.finalize();
};

const getLogs = (filters, limit, offset, callback) => {
  let query = `SELECT * FROM dns_logs WHERE 1=1`;
  let params = [];
  if (filters.domain) { query += ` AND domain LIKE ?`; params.push(`%${filters.domain}%`); }
  if (filters.clientIp) { query += ` AND client_ip = ?`; params.push(filters.clientIp); }
  if (filters.action) { query += ` AND action = ?`; params.push(filters.action); }
  query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  db.all(query, params, callback);
};

const cleanupLogs = (days = 30) => {
  db.run(`DELETE FROM dns_logs WHERE timestamp < datetime('now', '-${days} days')`);
};
setInterval(() => cleanupLogs(30), 864000000); // 30 days default retention cleanup

module.exports = { insertLog, getLogs, db };
