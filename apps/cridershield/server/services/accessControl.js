const { execFile } = require('child_process');
const net = require('net');
const deviceDb = require('../database/deviceDb');

const helper = '/usr/local/sbin/cridervpn-device-access';

const apply = (ipAddress, blocked) => new Promise((resolve, reject) => {
  if (!net.isIP(ipAddress)) {
    return reject(new Error('A valid client IP address is required'));
  }

  execFile(
    '/usr/bin/sudo',
    ['-n', helper, blocked ? 'block' : 'unblock', ipAddress],
    { timeout: 10000, windowsHide: true },
    (error, stdout, stderr) => {
      if (error) {
        const detail = String(stderr || stdout || '').trim();
        return reject(new Error(detail || 'Unable to update the client firewall rule'));
      }
      resolve(String(stdout || '').trim());
    }
  );
});

const restoreBlockedDevices = () => {
  deviceDb.getBlockedDevices(async (error, devices = []) => {
    if (error) return console.error('Unable to read blocked clients:', error.message);

    const results = await Promise.allSettled(
      devices.filter(device => net.isIP(device.ip_address)).map(device => apply(device.ip_address, true))
    );
    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length) {
      console.error(`Unable to restore ${failed.length} client access rule(s).`);
    }
  });
};

module.exports = { apply, restoreBlockedDevices };
