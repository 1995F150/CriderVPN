class DNSFilter {
  constructor() {
    this.blocklist = new Set();
    this.allowlist = new Set();
    this.wildcardRules = []; // e.g., ['*.doubleclick.net']
  }

  evaluate(domain, clientIp) {
    if (this.allowlist.has(domain)) {
      return { action: 'ALLOW', ruleMatched: domain };
    }
    if (this.blocklist.has(domain)) {
      return { action: 'BLOCK', ruleMatched: domain };
    }
    for (const rule of this.wildcardRules) {
      const regex = new RegExp('^' + rule.replace(/\./g, '\\\\.').replace(/\*/g, '.*') + '$');
      if (regex.test(domain)) {
        return { action: 'BLOCK', ruleMatched: rule };
      }
    }
    return { action: 'ALLOW', ruleMatched: 'default' };
  }
}

const filter = new DNSFilter();
module.exports = filter;
