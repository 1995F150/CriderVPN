const { execFile } = require('child_process');
const deviceDb = require('../database/deviceDb');

const scan = () => {
  execFile('/usr/sbin/ip', ['neigh', 'show'], (err, stdout) => {
    if (err) return;
    stdout.split('\n').forEach(line => {
      const fields = line.trim().split(/\s+/);
      const lladdr = fields.indexOf('lladdr');
      if (fields[0] && lladdr >= 0 && fields[lladdr + 1]) {
        const mac = fields[lladdr + 1].toLowerCase();
        if (mac !== 'ff:ff:ff:ff:ff:ff') {
          deviceDb.upsertDevice({ mac_address: mac, ip_address: fields[0] });
        }
      }
    });
    deviceDb.markOffline();
  });
};

const startScanner = () => { scan(); setInterval(scan, 30000); };
module.exports = { startScanner };
