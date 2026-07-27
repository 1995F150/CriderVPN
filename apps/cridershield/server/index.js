const express = require('express');
const cors = require('cors');
const next = require('next');

const auth = require('./middleware/auth');
const telemetryRouter = require('./routes/telemetry');
const dnsServer = require('./dns/server');
const dnsRoutes = require('./routes/dns');
const logsRoutes = require('./routes/logs');
const devicesRoutes = require('./routes/devices');
const rulesRoutes = require('./routes/rules');
const scanner = require('./services/scanner');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const PORT = process.env.PORT || 3000;

nextApp.prepare().then(() => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/v1/auth', auth.router);
  app.use('/api/v1/telemetry', telemetryRouter);
  app.use('/api/v1/dns', dnsRoutes);
  app.use('/api/v1/logs', logsRoutes);
  app.use('/api/v1/devices', devicesRoutes);
  app.use('/api/v1/rules', rulesRoutes);
  app.use('/api/v1/analytics', require('./routes/analytics'));

  app.get('/api/v1/status', (req, res) => {
    res.json({ status: 'running' });
  });

  app.all('*', (req, res) => {
    return handle(req, res);
  });

  app.listen(PORT, () => {
    console.log(`CriderShield running on port ${PORT}`);

    dnsServer.start();
    scanner.start();
  });
}).catch((error) => {
  console.error('Failed to start CriderShield:', error);
  process.exit(1);
});
