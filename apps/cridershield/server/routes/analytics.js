const express = require('express');
const pihole = require('../services/pihole');
const router = express.Router();

const load = async (req, res) => {
  try {
    res.json(await pihole.getAnalytics(req.query.range));
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message, details: error.details || null });
  }
};

router.get('/', load);
router.get('/overview', async (req, res) => {
  try {
    const data = await pihole.getAnalytics(req.query.range);
    res.json(data.overview);
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message, details: error.details || null });
  }
});
router.get('/trend', async (req, res) => {
  try {
    const data = await pihole.getAnalytics(req.query.range);
    res.json(data.trend);
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message, details: error.details || null });
  }
});
router.get('/top-domains', async (req, res) => {
  try {
    const data = await pihole.getAnalytics(req.query.range);
    res.json(data.topDomains);
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message, details: error.details || null });
  }
});

module.exports = router;
