const express = require('express');
const cookieParser = require('cookie-parser');
const next = require('next');

const auth = require('./middleware/auth');
const authRouter = require('./routes/auth');
const telemetryRouter = require('./routes/telemetry');
const dnsRoutes = require('./routes/dns');
const logsRoutes = require('./routes/logs');
const devicesRoutes = require('./routes/devices');
const rulesRoutes = require('./routes/rules');
const scanner = require('./services/scanner');
const systemRoutes = require('./routes/system');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required in production');
}

nextApp.prepare().then(() => {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.set('trust proxy', 'loopback');
  app.use('/api/auth', authRouter);
  app.use('/api/v1', auth());
  app.use('/api/v1/telemetry', telemetryRouter);
  app.use('/api/v1/dns', dnsRoutes);
  app.use('/api/v1/logs', logsRoutes);
  app.use('/api/v1/devices', devicesRoutes);
  app.use('/api/v1/rules', rulesRoutes);
  app.use('/api/v1/analytics', require('./routes/analytics'));
  app.use('/api/v1/system', systemRoutes);

  app.get('/api/v1/status', (req, res) => {
    res.json({ status: 'running' });
  });

  app.all('*', (req, res) => {
    return handle(req, res);
  });

  app.listen(PORT, () => {
    console.log(`CriderShield running on port ${PORT}`);

    if (process.env.SCANNER_ENABLED !== 'false') {
      scanner.startScanner();
    }
  });
}).catch((error) => {
  console.error('Failed to start CriderShield:', error);
  process.exit(1);
});
