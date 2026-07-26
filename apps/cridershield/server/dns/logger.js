const logDb = require('../database/logDb');

class DNSLogger {
  constructor() {
    this.stats = { totalQueries: 0, blockedCount: 0 };
  }
  log(query) {
    logDb.insertLog(query);
    this.stats.totalQueries++;
    if (query.status === 'BLOCK') this.stats.blockedCount++;
  }
  getStats() { return this.stats; }
}
module.exports = new DNSLogger();
