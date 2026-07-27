const baseUrl = (process.env.PIHOLE_URL || 'http://127.0.0.1').replace(/\/+$/, '');
const password = process.env.PIHOLE_APP_PASSWORD || '';

let session = null;
let sessionExpiresAt = 0;

class PiHoleError extends Error {
  constructor(message, status = 502, details = null) {
    super(message);
    this.name = 'PiHoleError';
    this.status = status;
    this.details = details;
  }
}

const authenticate = async () => {
  if (!password) return null;
  if (session && Date.now() < sessionExpiresAt - 30000) return session;

  const response = await fetch(`${baseUrl}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(5000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.session?.valid) {
    throw new PiHoleError('Pi-hole authentication failed', response.status, body.error);
  }

  session = {
    sid: body.session.sid,
    csrf: body.session.csrf
  };
  sessionExpiresAt = Date.now() + ((body.session.validity || 300) * 1000);
  return session;
};

const request = async (path, options = {}, allowRetry = true) => {
  const auth = await authenticate();
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(auth ? { 'X-FTL-SID': auth.sid, 'X-FTL-CSRF': auth.csrf } : {}),
    ...options.headers
  };

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(8000)
    });
  } catch (error) {
    throw new PiHoleError('Pi-hole is unreachable', 503, error.message);
  }

  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (response.status === 401 && auth && allowRetry) {
    session = null;
    sessionExpiresAt = 0;
    return request(path, options, false);
  }
  if (!response.ok) {
    const hint = !password && response.status === 401
      ? 'Set PIHOLE_APP_PASSWORD in /etc/cridervpn/cridershield.env'
      : body?.error?.hint;
    throw new PiHoleError(body?.error?.message || `Pi-hole request failed (${response.status})`, response.status, hint);
  }
  return body;
};

const rangeToSeconds = (range) => {
  const values = { hour: 3600, day: 86400, week: 604800 };
  return values[range] || values.day;
};

const getSummary = async () => {
  const [summary, blocking] = await Promise.all([
    request('/api/stats/summary'),
    request('/api/dns/blocking')
  ]);
  const queries = summary.queries || {};
  return {
    source: 'Pi-hole',
    connected: true,
    configured: Boolean(password),
    blocking: blocking.blocking === true,
    totalQueries: Number(queries.total || 0),
    blockedQueries: Number(queries.blocked || 0),
    blockedCount: Number(queries.blocked || 0),
    blockRate: Number(queries.percent_blocked || 0),
    uniqueDomains: Number(queries.unique_domains || 0),
    cachedQueries: Number(queries.cached || 0),
    forwardedQueries: Number(queries.forwarded || 0),
    clients: summary.clients || { active: 0, total: 0 },
    gravity: summary.gravity || {}
  };
};

const getQueries = async ({ limit = 50, offset = 0, domain = '', clientIp = '', action = '' } = {}) => {
  const length = Math.min(Math.max(Number(limit) || 50, 1), 500);
  const params = new URLSearchParams({ length: String(length + Math.max(Number(offset) || 0, 0)) });
  if (domain) params.set('domain', domain);
  if (clientIp) params.set('client_ip', clientIp);
  const body = await request(`/api/queries?${params}`);
  let queries = Array.isArray(body.queries) ? body.queries : [];
  if (action) {
    const blocked = action.toUpperCase() === 'BLOCK';
    queries = queries.filter(query => {
      const status = String(query.status || '');
      return Boolean(status.startsWith('GRAVITY') || status.includes('BLOCK')) === blocked;
    });
  }
  return queries.slice(Number(offset) || 0).map(query => {
    const status = String(query.status || '');
    return {
      id: query.id,
      timestamp: query.time ? new Date(query.time * 1000).toISOString() : query.timestamp,
      domain: query.domain,
      client_ip: query.client?.ip || query.client,
      client_name: query.client?.name || null,
      query_type: query.type,
      action: status.startsWith('GRAVITY') || status.includes('BLOCK') ? 'BLOCK' : 'ALLOW',
      status,
      upstream: query.upstream?.name || query.upstream,
      response_time: query.reply?.time ?? query.response
    };
  });
};

const getAnalytics = async (range = 'day') => {
  const until = Math.floor(Date.now() / 1000);
  const from = until - rangeToSeconds(range);
  const [summary, history, top] = await Promise.all([
    getSummary(),
    request(`/api/history?from=${from}&until=${until}`),
    request('/api/stats/top_domains?count=10')
  ]);
  const rows = Array.isArray(history.history) ? history.history : [];
  const trend = rows.map(row => ({
    time: new Date((row.timestamp || row.time || 0) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    queries: Number(row.total || row.queries || 0),
    blocked: Number(row.blocked || 0)
  }));
  const domains = top.domains || top.top_domains || [];
  return {
    overview: summary,
    trend,
    topDomains: domains.map(item => ({
      domain: item.domain || item.name,
      count: Number(item.count || item.hits || 0)
    }))
  };
};

const getDomains = async () => {
  const body = await request('/api/domains');
  const domains = Array.isArray(body.domains) ? body.domains : [];
  return domains.map((domain, index) => ({
    id: domain.id || `${domain.type}:${domain.kind}:${domain.domain}:${index}`,
    domain: domain.domain,
    action: domain.type === 'allow' ? 'ALLOW' : 'BLOCK',
    kind: domain.kind || 'exact',
    enabled: domain.enabled !== false,
    comment: domain.comment || '',
    groups: domain.groups || []
  }));
};

const addDomain = async ({ domain, action = 'BLOCK', kind = 'exact', comment = '' }) => {
  const type = String(action).toUpperCase() === 'ALLOW' ? 'allow' : 'deny';
  const normalizedKind = kind === 'regex' ? 'regex' : 'exact';
  return request('/api/domains', {
    method: 'POST',
    body: JSON.stringify({ domain, comment, enabled: true, type, kind: normalizedKind })
  });
};

const deleteDomain = async ({ domain, action = 'BLOCK', kind = 'exact' }) => {
  const type = String(action).toUpperCase() === 'ALLOW' ? 'allow' : 'deny';
  const normalizedKind = kind === 'regex' ? 'regex' : 'exact';
  return request(`/api/domains/${type}/${normalizedKind}/${encodeURIComponent(domain)}`, {
    method: 'DELETE'
  });
};

module.exports = {
  PiHoleError,
  baseUrl,
  getSummary,
  getQueries,
  getAnalytics,
  getDomains,
  addDomain,
  deleteDomain
};
