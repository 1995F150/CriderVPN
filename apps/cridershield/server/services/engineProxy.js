const http = require('http');
const https = require('https');

const DEFAULT_UPSTREAM = 'http://127.0.0.1:8000';
const MAX_REQUESTS = 100;
const HEALTH_PATH = '/api/health';

const state = {
  startedAt: new Date().toISOString(),
  lastError: null,
  requests: [],
  health: {
    checkedAt: null,
    reachable: false,
    status: null,
    latencyMs: null,
    error: 'Health check has not run yet'
  }
};

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 128, maxFreeSockets: 32 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 128, maxFreeSockets: 32 });

const upstreamBase = () => {
  const value = process.env.CRIDERGPT_ENGINE_UPSTREAM || DEFAULT_UPSTREAM;
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('CRIDERGPT_ENGINE_UPSTREAM must use http:// or https://');
  }
  return url;
};

const resolveUpstreamPath = (requestUrl) => {
  const parsed = new URL(requestUrl, 'http://cridershield.local');
  let pathname;

  if (parsed.pathname === '/engine/api') {
    pathname = '/api';
  } else if (parsed.pathname.startsWith('/engine/api/')) {
    pathname = parsed.pathname.slice('/engine'.length);
  } else if (parsed.pathname === '/engine/dashboard') {
    pathname = '/dashboard';
  } else if (parsed.pathname.startsWith('/engine/dashboard/')) {
    pathname = parsed.pathname.slice('/engine'.length);
  } else if (parsed.pathname === '/docs' || parsed.pathname.startsWith('/docs/')) {
    pathname = parsed.pathname;
  } else {
    return null;
  }

  return `${pathname}${parsed.search}`;
};

const classifyError = (error) => {
  const code = error?.code || '';
  if (code === 'ETIMEDOUT' || error?.name === 'AbortError') return 'timeout';
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) return 'dns';
  if (String(code).startsWith('ERR_TLS') || code.includes('CERT')) return 'tls';
  if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)) {
    return 'connection';
  }
  return 'upstream';
};

const clientAddress = (req) => {
  const forwarded = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
};

const recordRequest = (entry) => {
  state.requests.unshift(entry);
  if (state.requests.length > MAX_REQUESTS) state.requests.length = MAX_REQUESTS;
};

const recordError = (error, context) => {
  state.lastError = {
    timestamp: new Date().toISOString(),
    type: classifyError(error),
    code: error?.code || null,
    message: error?.message || 'Unknown proxy error',
    ...context
  };
};

const forwardedHeaders = (req) => {
  const headers = { ...req.headers };
  delete headers['proxy-connection'];

  const remoteAddress = clientAddress(req);
  const existingForwardedFor = headers['x-forwarded-for'];
  headers['x-forwarded-for'] = existingForwardedFor
    ? `${existingForwardedFor}, ${remoteAddress}`
    : remoteAddress;
  headers['x-forwarded-proto'] = headers['x-forwarded-proto'] ||
    (req.socket.encrypted ? 'https' : 'http');
  headers['x-forwarded-host'] = headers['x-forwarded-host'] || headers.host;

  // Authorization, X-API-Key, Content-Type, Accept, Host, Origin and every
  // other end-to-end header remain unchanged.
  return headers;
};

const proxyHttpRequest = (req, res, upstreamPath) => {
  const startedAt = Date.now();
  const target = new URL(upstreamPath, upstreamBase());
  const transport = target.protocol === 'https:' ? https : http;
  let requestBytes = 0;
  let responseBytes = 0;
  let completed = false;

  req.on('data', (chunk) => {
    requestBytes += chunk.length;
  });

  const finish = (status, error = null) => {
    if (completed) return;
    completed = true;
    const entry = {
      timestamp: new Date().toISOString(),
      clientIp: clientAddress(req),
      method: req.method,
      url: req.originalUrl || req.url,
      upstreamUrl: target.toString(),
      status,
      durationMs: Date.now() - startedAt,
      requestBytes,
      responseBytes,
      errorType: error ? classifyError(error) : null,
      error: error?.message || null
    };
    recordRequest(entry);
    if (error) recordError(error, entry);
    console.log(JSON.stringify({ event: 'engine_proxy_request', ...entry }));
  };

  const upstreamRequest = transport.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || undefined,
    method: req.method,
    path: `${target.pathname}${target.search}`,
    headers: forwardedHeaders(req),
    agent: target.protocol === 'https:' ? httpsAgent : httpAgent
  }, (upstreamResponse) => {
    res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.on('data', (chunk) => {
      responseBytes += chunk.length;
    });
    upstreamResponse.on('end', () => finish(upstreamResponse.statusCode || 502));
    upstreamResponse.on('error', (error) => {
      finish(upstreamResponse.statusCode || 502, error);
      if (!res.destroyed) res.destroy(error);
    });
    upstreamResponse.pipe(res);
  });

  const timeoutMs = Number(process.env.PROXY_REQUEST_TIMEOUT_MS || 120000);
  upstreamRequest.setTimeout(timeoutMs, () => {
    const error = new Error(`Upstream timed out after ${timeoutMs} ms`);
    error.code = 'ETIMEDOUT';
    upstreamRequest.destroy(error);
  });

  upstreamRequest.on('error', (error) => {
    finish(502, error);
    if (!res.headersSent) {
      res.status(502).json({
        error: 'Bad Gateway',
        message: 'CriderGPT Engine upstream is unavailable',
        type: classifyError(error)
      });
    } else if (!res.destroyed) {
      res.destroy(error);
    }
  });

  req.on('aborted', () => upstreamRequest.destroy());
  req.pipe(upstreamRequest);
};

const middleware = (req, res, next) => {
  const upstreamPath = resolveUpstreamPath(req.originalUrl || req.url);
  if (!upstreamPath) return next();
  return proxyHttpRequest(req, res, upstreamPath);
};

const proxyWebSocket = (req, socket, head) => {
  const upstreamPath = resolveUpstreamPath(req.url);
  if (!upstreamPath) return false;

  const target = new URL(upstreamPath, upstreamBase());
  const transport = target.protocol === 'https:' ? https : http;
  const upstreamRequest = transport.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || undefined,
    method: req.method || 'GET',
    path: `${target.pathname}${target.search}`,
    headers: forwardedHeaders(req),
    agent: false
  });

  upstreamRequest.on('upgrade', (upstreamResponse, upstreamSocket, upstreamHead) => {
    const headerLines = Object.entries(upstreamResponse.headers)
      .flatMap(([name, value]) => {
        const values = Array.isArray(value) ? value : [value];
        return values.filter((item) => item !== undefined).map((item) => `${name}: ${item}`);
      });
    socket.write(
      `HTTP/1.1 ${upstreamResponse.statusCode} ${upstreamResponse.statusMessage}\r\n` +
      `${headerLines.join('\r\n')}\r\n\r\n`
    );
    if (head?.length) upstreamSocket.write(head);
    if (upstreamHead?.length) socket.write(upstreamHead);
    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });

  upstreamRequest.on('response', (response) => {
    socket.write(`HTTP/1.1 ${response.statusCode || 502} Upgrade Failed\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  });

  upstreamRequest.on('error', (error) => {
    recordError(error, {
      method: req.method || 'GET',
      url: req.url,
      upstreamUrl: target.toString()
    });
    if (!socket.destroyed) socket.destroy();
  });

  upstreamRequest.end();
  return true;
};

const checkHealth = async () => {
  const startedAt = Date.now();
  const target = new URL(HEALTH_PATH, upstreamBase());
  const controller = new AbortController();
  const timeoutMs = Number(process.env.PROXY_HEALTH_TIMEOUT_MS || 5000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store'
    });
    state.health = {
      checkedAt: new Date().toISOString(),
      reachable: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      error: response.ok ? null : `HTTP ${response.status}`
    };
  } catch (error) {
    state.health = {
      checkedAt: new Date().toISOString(),
      reachable: false,
      status: null,
      latencyMs: Date.now() - startedAt,
      error: error.name === 'AbortError' ? 'Health check timed out' : error.message,
      errorType: classifyError(error)
    };
    recordError(error, { method: 'GET', upstreamUrl: target.toString(), healthCheck: true });
  } finally {
    clearTimeout(timer);
  }

  return state.health;
};

let monitor = null;
const startHealthMonitor = () => {
  if (monitor) return;
  checkHealth();
  const intervalMs = Number(process.env.PROXY_HEALTH_INTERVAL_MS || 15000);
  monitor = setInterval(checkHealth, intervalMs);
  monitor.unref();
};

const diagnostics = () => ({
  routes: [
    { publicPath: '/engine/api/*', upstreamPath: '/api/*', methods: 'ALL' },
    { publicPath: '/engine/dashboard', upstreamPath: '/dashboard', methods: 'ALL' },
    { publicPath: '/docs', upstreamPath: '/docs', methods: 'ALL' }
  ],
  upstream: upstreamBase().toString().replace(/\/$/, ''),
  health: state.health,
  lastError: state.lastError,
  requests: state.requests,
  counters: state.requests.reduce((result, request) => {
    const key = String(request.status);
    result.statusCodes[key] = (result.statusCodes[key] || 0) + 1;
    if (request.errorType) {
      result.errors[request.errorType] = (result.errors[request.errorType] || 0) + 1;
    }
    return result;
  }, { statusCodes: {}, errors: {} }),
  startedAt: state.startedAt
});

module.exports = {
  checkHealth,
  diagnostics,
  middleware,
  proxyWebSocket,
  resolveUpstreamPath,
  startHealthMonitor
};
