const { db } = require('./logDb');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS hourly_stats (
    hour DATETIME PRIMARY KEY, total_queries INTEGER, blocked_queries INTEGER,
    unique_devices INTEGER, top_domains TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS daily_stats (
    day DATE PRIMARY KEY, total_queries INTEGER, blocked_queries INTEGER,
    unique_devices INTEGER, top_domains TEXT
  )`);
});

const aggregateHourly = () => {
  db.run(`INSERT OR REPLACE INTO hourly_stats (hour, total_queries, blocked_queries, unique_devices)
    SELECT strftime('%Y-%m-%d %H:00:00', timestamp) as hour, COUNT(*) as total,
    SUM(CASE WHEN action = 'BLOCK' THEN 1 ELSE 0 END) as blocked, COUNT(DISTINCT client_ip)
    FROM dns_logs WHERE timestamp >= datetime('now', '-1 hour') GROUP BY hour`);
};

setInterval(aggregateHourly, 5 * 60 * 1000); // Run every 5 minutes

module.exports = { db };
