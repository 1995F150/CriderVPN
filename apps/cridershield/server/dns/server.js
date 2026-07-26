const dgram = require('dgram');
const filter = require('./filter');
const ruleEngine = require('../services/ruleEngine');
const deviceDb = require('../database/deviceDb');

function start() {
  const server = dgram.createSocket('udp4');

  server.on('message', async (msg, rinfo) => {
    // Basic domain extraction
    const msgString = msg.toString('utf8');
    const domainMatch = msgString.match(/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const domain = domainMatch ? domainMatch[0] : 'unknown.local';

    // Get device info to find MAC address for rule engine
    deviceDb.getByIp(rinfo.address, async (err, device) => {
      const clientMac = device ? device.mac : 'unknown';
      
      // Phase 6: Evaluate query via Rule Engine
      const decision = await ruleEngine.evaluate(domain, clientMac);
      
      if (decision.action === 'BLOCK') {
        console.log(`[Rule Engine] BLOCKED: ${domain} for ${clientMac}`);
        return;
      }

      // Existing blocklist check
      if (filter.isBlocked(domain)) {
        console.log(`[Filter] BLOCKED: ${domain}`);
        return;
      }

      console.log(`[Allowed] ${domain} (Client: ${clientMac})`);
      // DNS resolution/forwarding logic...
    });
  });

  server.bind(53, () => {
    console.log('DNS Server listening on port 53');
  });
}

module.exports = { start };
