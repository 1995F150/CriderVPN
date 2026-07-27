const express = require('express');
const router = express.Router();
const si = require('systeminformation');
const auth = require('../middleware/auth');

router.get('/stream', auth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendUpdate = async () => {
    try {
      const [cpu, load, mem, fs, os, time, net, proc] = await Promise.all([
        si.cpu(),
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.osInfo(),
        si.time(),
        si.networkInterfaces(),
        si.processes()
      ]);

      const data = { cpu, load, mem, fs, os, time, net, proc };
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
