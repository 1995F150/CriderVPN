const express = require('express');
const router = express.Router();
const { db } = require('../database/analyticsDb');

router.get('/overview', (req, res) => {
  const range = req.query.range || '-24 hours';
  db.get(`SELECT COUNT(*) as total, SUM(CASE WHEN action='BLOCK' THEN 1 ELSE 0 END) as blocked
          FROM dns_logs WHERE timestamp >= datetime('now', ?)`, [range], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ totalQueries: row.total || 0, blockedQueries: row.blocked || 0, blockRate: row.total ? ((row.blocked / row.total) * 100).toFixed(1) : 0 });
  });
});

router.get('/trend', (req, res) => {
  db.all(`SELECT strftime('%H:00', timestamp) as time, COUNT(*) as queries, SUM(CASE WHEN action='BLOCK' THEN 1 ELSE 0 END) as blocked 
          FROM dns_logs WHERE timestamp >= datetime('now', '-24 hours') GROUP BY time ORDER BY time ASC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/top-domains', (req, res) => {
  db.all(`SELECT domain, COUNT(*) as count FROM dns_logs WHERE action='ALLOW' GROUP BY domain ORDER BY count DESC LIMIT 10`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
