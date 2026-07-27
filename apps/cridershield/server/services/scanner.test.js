const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');

process.env.CRIDER_DATA_DIR = path.join(os.tmpdir(), `cridershield-scanner-test-${process.pid}`);
const scanner = require('./scanner');

test('normalizes valid MAC addresses and rejects invalid values', () => {
  assert.equal(scanner.normalizeMac('AA-BB-CC-DD-EE-FF'), 'aa:bb:cc:dd:ee:ff');
  assert.equal(scanner.normalizeMac('not-a-mac'), '');
});

test('classifies Linux interface names into connection types', () => {
  assert.equal(scanner.connectionFromInterface('wlan0'), 'Wi-Fi');
  assert.equal(scanner.connectionFromInterface('enp3s0'), 'Ethernet');
  assert.equal(scanner.connectionFromInterface('tailscale0'), 'Tailscale');
  assert.equal(scanner.connectionFromInterface('docker0'), 'Docker');
  assert.equal(scanner.connectionFromInterface('virbr0'), 'Virtual Machine');
  assert.equal(scanner.connectionFromInterface('veth1234'), 'Container');
});
