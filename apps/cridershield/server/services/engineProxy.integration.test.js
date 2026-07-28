const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const engineProxy = require('./engineProxy');

const listen = (server) => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});

const close = (server) => new Promise((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
});

test('forwards POST method, raw body, query string and required headers', async (t) => {
  const received = {};
  const upstream = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      received.method = req.method;
      received.url = req.url;
      received.headers = req.headers;
      received.body = Buffer.concat(chunks);
      res.writeHead(201, { 'content-type': 'application/octet-stream' });
      res.end(Buffer.from([0, 1, 2, 3]));
    });
  });
  const upstreamPort = await listen(upstream);
  process.env.CRIDERGPT_ENGINE_UPSTREAM = `http://127.0.0.1:${upstreamPort}`;

  const proxy = http.createServer((req, res) => {
    req.originalUrl = req.url;
    res.status = (status) => {
      res.statusCode = status;
      return res;
    };
    res.json = (value) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(value));
    };
    engineProxy.middleware(req, res, () => {
      res.writeHead(404);
      res.end();
    });
  });
  const proxyPort = await listen(proxy);

  t.after(async () => {
    delete process.env.CRIDERGPT_ENGINE_UPSTREAM;
    await close(proxy);
    await close(upstream);
  });

  const body = Buffer.from([0, 255, 17, 42, 99]);
  const response = await fetch(`http://127.0.0.1:${proxyPort}/engine/api/chat?stream=true`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer test-token',
      'x-api-key': 'test-key',
      'content-type': 'application/octet-stream',
      accept: 'application/octet-stream',
      origin: 'https://cridergpt.com'
    },
    body
  });

  assert.equal(response.status, 201);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from([0, 1, 2, 3]));
  assert.equal(received.method, 'POST');
  assert.equal(received.url, '/api/chat?stream=true');
  assert.deepEqual(received.body, body);
  assert.equal(received.headers.authorization, 'Bearer test-token');
  assert.equal(received.headers['x-api-key'], 'test-key');
  assert.equal(received.headers['content-type'], 'application/octet-stream');
  assert.equal(received.headers.accept, 'application/octet-stream');
  assert.equal(received.headers.origin, 'https://cridergpt.com');
});
