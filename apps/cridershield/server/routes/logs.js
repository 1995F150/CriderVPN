const express = require('express');
const router = express.Router();
const logDb = require('../database/logDb');

router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const filters = { domain: req.query.domain, clientIp: req.query.clientIp, action: req.query.action };
  logDb.getLogs(filters, limit, offset, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/export/csv', (req, res) => {
  logDb.getLogs({}, 10000, 0, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows.length) return res.send('No logs');
    const headers = Object.keys(rows[0]).join(',');
    const csv = [headers].concat(rows.map(r => Object.values(r).join(','))).join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('dns_logs.csv');
    res.send(csv);
  });
});

module.exports = router;
