const express = require('express');
const router = express.Router();
const deviceDb = require('../database/deviceDb');

router.get('/', (req, res) => {
  deviceDb.getDevices((err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.put('/:mac', (req, res) => {
  deviceDb.updateDevice(req.params.mac, req.body, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

module.exports = router;
