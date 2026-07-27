const express = require('express');
const router = express.Router();
const logger = require('../dns/logger');
const filter = require('../dns/filter');
const cache = require('../dns/cache');

router.get('/stats', (req, res) => res.json(logger.getStats()));
router.get('/logs', (req, res) => res.json(logger.getLogs()));
router.get('/cache', (req, res) => res.json(cache.getStats()));
router.post('/rules', (req, res) => {
  const { action, domain } = req.body;
  if (action === 'BLOCK') filter.addBlock(domain);
  if (action === 'ALLOW') filter.addAllow(domain);
  res.json({ success: true });
});

module.exports = router;
