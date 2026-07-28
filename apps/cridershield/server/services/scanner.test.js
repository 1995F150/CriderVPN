const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');

process.env.CRIDER_DATA_DIR = path.join(os.tmpdir(), `cridershield-scanner-test-${process.pid}`);
const scanner = require('./scanner');

test('normalizes valid unicast MAC addresses and rejects unusable identities', () => {
  assert.equal(scanner.normalizeMac('AA-BB-CC-DD-EE-FF'), 'aa:bb:cc:dd:ee:ff');
  assert.equal(scanner.normalizeMac('c2:5e:87:c4:73:aa'), 'c2:5e:87:c4:73:aa');
  assert.equal(scanner.normalizeMac('not-a-mac'), '');
  assert.equal(scanner.normalizeMac('00:00:00:00:00:00'), '');
  assert.equal(scanner.normalizeMac('ff:ff:ff:ff:ff:ff'), '');
  assert.equal(scanner.normalizeMac('01:00:5e:00:00:fb'), '');
});

test('classifies Linux interface names into connection types', () => {
  assert.equal(scanner.connectionFromInterface('wlan0'), 'Wi-Fi');
  assert.equal(scanner.connectionFromInterface('enp3s0'), 'Ethernet');
  assert.equal(scanner.connectionFromInterface('tailscale0'), 'Tailscale');
  assert.equal(scanner.connectionFromInterface('docker0'), 'Docker');
  assert.equal(scanner.connectionFromInterface('virbr0'), 'Virtual Machine');
  assert.equal(scanner.connectionFromInterface('veth1234'), 'Container');
});
