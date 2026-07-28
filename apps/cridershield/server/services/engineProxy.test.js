const assert = require('node:assert/strict');
const test = require('node:test');
const { resolveUpstreamPath } = require('./engineProxy');

test('rewrites API paths and preserves query strings', () => {
  assert.equal(
    resolveUpstreamPath('/engine/api/chat?stream=true&model=local'),
    '/api/chat?stream=true&model=local'
  );
  assert.equal(resolveUpstreamPath('/engine/api/health'), '/api/health');
  assert.equal(resolveUpstreamPath('/engine/api'), '/api');
});

test('rewrites dashboard and documentation paths', () => {
  assert.equal(resolveUpstreamPath('/engine/dashboard'), '/dashboard');
  assert.equal(resolveUpstreamPath('/engine/dashboard/assets/app.js'), '/dashboard/assets/app.js');
  assert.equal(resolveUpstreamPath('/docs'), '/docs');
  assert.equal(resolveUpstreamPath('/docs/openapi.json?format=json'), '/docs/openapi.json?format=json');
});

test('does not proxy unrelated CriderShield routes', () => {
  assert.equal(resolveUpstreamPath('/api/v1/system'), null);
  assert.equal(resolveUpstreamPath('/dashboard'), null);
  assert.equal(resolveUpstreamPath('/engine/not-api'), null);
});
