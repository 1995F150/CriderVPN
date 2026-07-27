const express = require('express');
const pihole = require('../services/pihole');
const router = express.Router();

const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

router.get('/', async (req, res) => {
  try {
    const rows = await pihole.getQueries({
      limit: req.query.limit,
      offset: req.query.offset,
      domain: req.query.domain,
      clientIp: req.query.clientIp,
      action: req.query.action
    });
    res.json(rows);
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message, details: error.details || null });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const rows = await pihole.getQueries({ limit: 500 });
    const columns = ['timestamp', 'domain', 'client_ip', 'query_type', 'action', 'status', 'upstream', 'response_time'];
    const csv = [
      columns.join(','),
      ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))
    ].join('\n');
    res.type('text/csv').attachment('pihole-query-log.csv').send(csv);
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message, details: error.details || null });
  }
});

module.exports = router;
