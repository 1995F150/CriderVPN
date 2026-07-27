const express = require('express');
const router = express.Router();
const si = require('systeminformation');

const collectTelemetry = async () => {
  const [cpu, load, mem, fs, os, time, net, proc] = await Promise.all([
    si.cpu(),
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.osInfo(),
    si.time(),
    si.networkStats(),
    si.processes()
  ]);

  return {
    cpu: { ...cpu, load: load.currentLoad },
    mem,
    storage: { disks: fs },
    os,
    uptime: time.uptime,
    net: net[0] || { rx_sec: 0, tx_sec: 0 },
    proc
  };
};

router.get('/', async (req, res) => {
  try {
    res.json(await collectTelemetry());
  } catch (error) {
    console.error('Telemetry error:', error);
    res.status(500).json({ error: 'Unable to collect telemetry' });
  }
});

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendUpdate = async () => {
    try {
      const data = await collectTelemetry();
      res.write('data: ' + JSON.stringify(data) + '\n\n');
    } catch (error) {
      console.error('SSE Error:', error);
    }
  };

  const interval = setInterval(sendUpdate, 2000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

module.exports = router;
