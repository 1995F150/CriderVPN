const express = require('express');
const systemStatus = require('../services/systemStatus');
const pihole = require('../services/pihole');
const router = express.Router();

router.get('/', async (req, res) => {
  const status = await systemStatus.collect();
  res.json({
    ...status,
    integrations: {
      pihole: {
        url: pihole.baseUrl,
        credentialConfigured: Boolean(process.env.PIHOLE_APP_PASSWORD)
      }
    }
  });
});

module.exports = router;
