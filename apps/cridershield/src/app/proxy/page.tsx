'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type ProxyRequest = {
  timestamp: string;
  clientIp: string;
  method: string;
  url: string;
  upstreamUrl: string;
  status: number;
  durationMs: number;
  requestBytes: number;
  responseBytes: number;
  errorType: string | null;
  error: string | null;
};

type Diagnostics = {
  routes: Array<{ publicPath: string; upstreamPath: string; methods: string }>;
  upstream: string;
  health: {
    checkedAt: string | null;
    reachable: boolean;
    status: number | null;
    latencyMs: number | null;
    error: string | null;
    errorType?: string;
  };
  lastError: {
    timestamp: string;
    type: string;
    code: string | null;
    message: string;
  } | null;
  requests: ProxyRequest[];
  counters: {
    statusCodes: Record<string, number>;
    errors: Record<string, number>;
  };
};

export default function ProxyDiagnosticsPage() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/proxy', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Diagnostics returned HTTP ${response.status}`);
      setData(await response.json());
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load diagnostics');
    }
  }, []);

  const checkNow = async () => {
    await fetch('/api/v1/proxy/health-check', { method: 'POST' });
    await load();
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reverse Proxy Diagnostics</h1>
          <p className="text-sm text-slate-400">Live Engine routes, upstream health, errors and the last 100 requests.</p>
        </div>
        <button onClick={checkNow} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">
          <RefreshCw className="h-4 w-4" /> Check now
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-300">{error}</div>}

      {data && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-sm text-slate-400">Upstream</div>
              <div className="mt-2 break-all font-medium">{data.upstream}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-sm text-slate-400">Health</div>
              <div className={`mt-2 text-lg font-semibold ${data.health.reachable ? 'text-emerald-300' : 'text-red-300'}`}>
                {data.health.reachable ? 'Reachable' : 'Unreachable'}
              </div>
              <div className="mt-1 text-sm text-slate-400">HTTP {data.health.status ?? 'Unavailable'} · {data.health.latencyMs ?? '—'} ms</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <div className="text-sm text-slate-400">Last proxy error</div>
              <div className="mt-2 text-sm">
                {data.lastError ? `${data.lastError.type}: ${data.lastError.message}` : 'None recorded'}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold">Registered routes</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-400"><tr><th className="pb-2">Public</th><th className="pb-2">Upstream</th><th className="pb-2">Methods</th></tr></thead>
                <tbody>
                  {data.routes.map((route) => (
                    <tr key={route.publicPath} className="border-t border-slate-800">
                      <td className="py-2 font-mono">{route.publicPath}</td>
                      <td className="py-2 font-mono">{route.upstreamPath}</td>
                      <td className="py-2">{route.methods}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="font-semibold">Upstream status codes</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(data.counters.statusCodes).map(([code, count]) => (
                  <span key={code} className="rounded-full border border-slate-700 px-3 py-1 text-sm">HTTP {code}: {count}</span>
                ))}
                {!Object.keys(data.counters.statusCodes).length && <span className="text-sm text-slate-400">No requests yet</span>}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="font-semibold">Proxy failures</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {['connection', 'tls', 'dns', 'timeout', 'upstream'].map((type) => (
                  <span key={type} className="rounded-full border border-slate-700 px-3 py-1 text-sm">{type}: {data.counters.errors[type] || 0}</span>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold">Last 100 requests</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left text-xs">
                <thead className="text-slate-400">
                  <tr><th className="pb-2">Timestamp</th><th>Client</th><th>Method</th><th>URL</th><th>Upstream</th><th>Status</th><th>Duration</th><th>Bytes in/out</th></tr>
                </thead>
                <tbody>
                  {data.requests.map((request, index) => (
                    <tr key={`${request.timestamp}-${index}`} className="border-t border-slate-800 align-top">
                      <td className="py-2">{new Date(request.timestamp).toLocaleString()}</td>
                      <td className="py-2">{request.clientIp}</td>
                      <td className="py-2 font-semibold">{request.method}</td>
                      <td className="max-w-64 break-all py-2">{request.url}</td>
                      <td className="max-w-72 break-all py-2">{request.upstreamUrl}</td>
                      <td className="py-2">{request.status}</td>
                      <td className="py-2">{request.durationMs} ms</td>
                      <td className="py-2">{request.requestBytes} / {request.responseBytes}</td>
                    </tr>
                  ))}
                  {!data.requests.length && <tr><td colSpan={8} className="py-8 text-center text-slate-400">No proxy requests recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
