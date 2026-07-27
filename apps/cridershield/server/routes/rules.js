const express = require('express');
const pihole = require('../services/pihole');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.json(await pihole.getDomains());
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message, details: error.details || null });
  }
});

router.post('/', async (req, res) => {
  const domain = String(req.body.domain || '').trim().toLowerCase();
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  try {
    await pihole.addDomain({ ...req.body, domain });
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message, details: error.details || null });
  }
});

router.delete('/', async (req, res) => {
  const domain = String(req.body.domain || '').trim().toLowerCase();
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  try {
    await pihole.deleteDomain({ ...req.body, domain });
    res.json({ success: true });
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message, details: error.details || null });
  }
});

module.exports = router;
