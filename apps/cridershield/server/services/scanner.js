const { exec } = require('child_process');
const deviceDb = require('../database/deviceDb');

const scan = () => {
  exec('arp -a', (err, stdout) => {
    if (err) return;
    const macRegex = /([0-9A-Fa-f]{1,2}[:-]){5}([0-9A-Fa-f]{1,2})/;
    const ipRegex = /\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b/;
    stdout.split('\\n').forEach(line => {
      const macM = line.match(macRegex);
      const ipM = line.match(ipRegex);
      if (macM && ipM) {
        const mac = macM[0].replace(/-/g, ':').toLowerCase();
        if (mac !== 'ff:ff:ff:ff:ff:ff') deviceDb.upsertDevice({ mac_address: mac, ip_address: ipM[0] });
      }
    });
    deviceDb.markOffline();
  });
};

const startScanner = () => { scan(); setInterval(scan, 30000); };
module.exports = { startScanner };
