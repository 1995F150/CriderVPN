const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const run = async (file, args = [], timeout = 3000) => {
  try {
    const { stdout } = await execFileAsync(file, args, { timeout });
    return stdout.trim();
  } catch (error) {
    return error.stdout?.trim() || '';
  }
};

const serviceState = async (name) => {
  const state = await run('/usr/bin/systemctl', ['is-active', name]);
  return ['active', 'inactive', 'failed', 'activating', 'deactivating'].includes(state) ? state : 'unavailable';
};

const checkJsonEndpoint = async (url, timeout = 5000) => {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store'
    });
    let body = {};
    try {
      body = await response.json();
    } catch {}

    return {
      url,
      reachable: response.ok,
      httpStatus: response.status,
      latencyMs: Date.now() - started,
      status: body.status || (response.ok ? 'reachable' : 'error'),
      ready: Boolean(body.ready),
      version: body.engine_version || body.version || null,
      dependencies: body.dependencies || {},
      capabilities: body.capabilities || {},
      error: response.ok ? null : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      url,
      reachable: false,
      httpStatus: null,
      latencyMs: Date.now() - started,
      status: 'unreachable',
      ready: false,
      version: null,
      dependencies: {},
      capabilities: {},
      error: error.name === 'AbortError' ? 'Request timed out' : error.message
    };
  } finally {
    clearTimeout(timer);
  }
};

const collect = async () => {
  const names = [
    'pihole-FTL',
    'tailscaled',
    'squid',
    'danted',
    'cridershield',
    'cridergpt-engine',
    'cridergpt-video-worker'
  ];
  const states = await Promise.all(names.map(serviceState));
  const services = Object.fromEntries(names.map((name, index) => [name, states[index]]));

  const tailscaleRaw = await run('/usr/bin/tailscale', ['status', '--json']);
  let tailscale = { connected: false, exitNode: false, tailnet: null };
  if (tailscaleRaw) {
    try {
      const status = JSON.parse(tailscaleRaw);
      tailscale = {
        connected: status.BackendState === 'Running',
        exitNode: Boolean(status.Self?.ExitNodeOption),
        tailnet: status.CurrentTailnet?.Name || null,
        dnsName: status.Self?.DNSName || null
      };
    } catch {
      tailscale.error = 'Unable to parse Tailscale status';
    }
  }

  const localHealthUrl = process.env.CRIDERGPT_ENGINE_LOCAL_HEALTH_URL ||
    'http://127.0.0.1:8000/api/health';
  const publicHealthUrl = process.env.CRIDERGPT_ENGINE_PUBLIC_HEALTH_URL ||
    process.env.CRIDERGPT_ENGINE_HEALTH_URL ||
    'https://cridergpt.com/engine/api/health';
  const [localHealth, publicHealth] = await Promise.all([
    checkJsonEndpoint(localHealthUrl),
    checkJsonEndpoint(publicHealthUrl)
  ]);

  return {
    services,
    tailscale,
    proxy: {
      http: services.squid === 'active',
      socks5: services.danted === 'active'
    },
    cridergptEngine: {
      local: localHealth,
      publicProxy: publicHealth,
      localService: services['cridergpt-engine'],
      videoWorker: services['cridergpt-video-worker'],
      healthy: localHealth.reachable && localHealth.ready
    },
    checkedAt: new Date().toISOString()
  };
};

module.exports = { collect, checkJsonEndpoint };
