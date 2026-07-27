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

const collect = async () => {
  const names = ['pihole-FTL', 'tailscaled', 'squid', 'danted', 'cridershield'];
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

  return {
    services,
    tailscale,
    proxy: {
      http: services.squid === 'active',
      socks5: services.danted === 'active'
    },
    checkedAt: new Date().toISOString()
  };
};

module.exports = { collect };
