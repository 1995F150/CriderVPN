const express = require('express');
const pihole = require('../services/pihole');
const router = express.Router();

const handle = (res, error) => {
  console.error('Pi-hole API error:', error.message);
  res.status(error.status || 502).json({
    error: error.message,
    details: error.details || null,
    source: 'Pi-hole'
  });
};

router.get('/status', async (req, res) => {
  try {
    res.json(await pihole.getSummary());
  } catch (error) {
    handle(res, error);
  }
});

router.get('/stats', async (req, res) => {
  try {
    res.json(await pihole.getSummary());
  } catch (error) {
    handle(res, error);
  }
});

router.get('/logs', async (req, res) => {
  try {
    res.json(await pihole.getQueries({ limit: req.query.limit || 100 }));
  } catch (error) {
    handle(res, error);
  }
});

module.exports = router;
