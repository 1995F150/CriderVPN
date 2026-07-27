class DNSCache {
  constructor() { this.cache = new Map(); }
  get(domain) {
    const entry = this.cache.get(domain);
    if (entry && entry.expires > Date.now()) return entry.data;
    if (entry) this.cache.delete(domain);
    return null;
  }
  set(domain, data, ttl = 300) {
    this.cache.set(domain, { data, expires: Date.now() + (ttl * 1000) });
  }
  getStats() { return { size: this.cache.size }; }
}
module.exports = new DNSCache();
