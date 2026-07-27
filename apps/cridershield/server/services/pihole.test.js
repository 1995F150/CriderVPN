const test = require('node:test');
const assert = require('node:assert/strict');
const pihole = require('./pihole');

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

test('normalizes Pi-hole summary data', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async (url) => {
    if (String(url).endsWith('/api/stats/summary')) {
      return jsonResponse({
        queries: { total: 120, blocked: 30, percent_blocked: 25, unique_domains: 80, cached: 20, forwarded: 70 },
        clients: { active: 4, total: 7 }
      });
    }
    return jsonResponse({ blocking: true });
  };

  const summary = await pihole.getSummary();
  assert.equal(summary.totalQueries, 120);
  assert.equal(summary.blockedQueries, 30);
  assert.equal(summary.blockRate, 25);
  assert.equal(summary.blocking, true);
  assert.equal(summary.clients.active, 4);
});

test('normalizes domain records and writes Pi-hole domain payloads', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (options.method === 'POST') return jsonResponse({ domains: [] }, 201);
    return jsonResponse({
      domains: [{ id: 4, domain: 'ads.example', type: 'deny', kind: 'exact', enabled: true, comment: 'test' }]
    });
  };

  const domains = await pihole.getDomains();
  assert.deepEqual(domains[0], {
    id: 4,
    domain: 'ads.example',
    action: 'BLOCK',
    kind: 'exact',
    enabled: true,
    comment: 'test',
    groups: []
  });

  await pihole.addDomain({ domain: 'tracker.example', action: 'BLOCK', kind: 'exact', comment: 'added by test' });
  const body = JSON.parse(requests.at(-1).options.body);
  assert.deepEqual(body, {
    domain: 'tracker.example',
    comment: 'added by test',
    enabled: true,
    type: 'deny',
    kind: 'exact'
  });
});
