const express = require('express');
const engineProxy = require('../services/engineProxy');

const router = express.Router();

router.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(engineProxy.diagnostics());
});

router.post('/health-check', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await engineProxy.checkHealth());
});

module.exports = router;
