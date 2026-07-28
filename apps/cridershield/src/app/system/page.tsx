'use client';

import { useEffect, useState } from 'react';
import { CircleCheck, CircleX, RefreshCw } from 'lucide-react';

type EndpointHealth = {
  url: string;
  reachable: boolean;
  httpStatus: number | null;
  latencyMs: number;
  status: string;
  ready: boolean;
  version: string | null;
  dependencies: Record<string, boolean | string | object>;
  capabilities: Record<string, boolean> | string[];
  error: string | null;
};

type SystemData = {
  services: Record<string, string>;
  tailscale: {
    connected: boolean;
    exitNode: boolean;
    tailnet: string | null;
    dnsName?: string | null;
  };
  proxy: { http: boolean; socks5: boolean };
  cridergptEngine: {
    local: EndpointHealth;
    publicProxy: EndpointHealth;
    localService: string;
    videoWorker: string;
    healthy: boolean;
  };
  integrations: {
    pihole: { url: string; credentialConfigured: boolean };
  };
  checkedAt: string;
};

const endpointState = (endpoint: EndpointHealth) => {
  if (!endpoint.reachable) return 'Unreachable';
  return endpoint.ready ? 'Healthy' : 'Degraded';
};

export default function SystemPage() {
  const [data, setData] = useState<SystemData | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    const response = await fetch('/api/v1/system');
    if (!response.ok) {
      setError('Unable to read service status');
      return;
    }
    setData(await response.json());
    setError('');
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System & Integrations</h1>
          <p className="text-sm text-slate-400">Independent local Engine and public reverse-proxy health, plus systemd, Tailscale, proxies and Pi-hole.</p>
        </div>
        <button onClick={load} className="rounded-lg border border-slate-700 p-2 hover:bg-slate-800" aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-300">{error}</div>}
      {!data && !error && <div className="text-slate-400">Loading live service status…</div>}

      {data && (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(data.services).map(([name, state]) => {
              const healthy = state === 'active';
              return (
                <div key={name} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div>
                    <div className="font-medium">{name}</div>
                    <div className="text-sm text-slate-400">{state}</div>
                  </div>
                  {healthy ? <CircleCheck className="text-emerald-400" /> : <CircleX className="text-slate-500" />}
                </div>
              );
            })}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="font-semibold">Tailscale</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-400">Connected</dt><dd>{data.tailscale.connected ? 'Yes' : 'No'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Offers exit node</dt><dd>{data.tailscale.exitNode ? 'Yes' : 'No'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Tailnet</dt><dd>{data.tailscale.tailnet || 'Unavailable'}</dd></div>
              </dl>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="font-semibold">Pi-hole API</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-400">URL</dt><dd>{data.integrations.pihole.url}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">Application password</dt><dd>{data.integrations.pihole.credentialConfigured ? 'Configured' : 'Not configured'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">HTTP proxy</dt><dd>{data.proxy.http ? 'Online' : 'Offline'}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-400">SOCKS5 proxy</dt><dd>{data.proxy.socks5 ? 'Online' : 'Offline'}</dd></div>
              </dl>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">CriderGPT Engine</h2>
                <p className="mt-1 text-sm text-slate-400">Local service health is independent from public reverse-proxy availability.</p>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs ${
                data.cridergptEngine.healthy
                  ? 'border-emerald-700 bg-emerald-950/50 text-emerald-300'
                  : 'border-amber-700 bg-amber-950/50 text-amber-300'
              }`}>
                {data.cridergptEngine.healthy ? 'Engine Healthy' : 'Engine Unhealthy'}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {[
                ['Local Engine', data.cridergptEngine.local],
                ['Public Reverse Proxy', data.cridergptEngine.publicProxy]
              ].map(([label, endpoint]) => {
                const health = endpoint as EndpointHealth;
                return (
                  <div key={label as string} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-medium">{label as string}</h3>
                      <span className={health.reachable && health.ready ? 'text-emerald-300' : 'text-amber-300'}>
                        {endpointState(health)}
                      </span>
                    </div>
                    <a href={health.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-xs text-blue-400 hover:text-blue-300">
                      {health.url}
                    </a>
                    <dl className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between gap-4"><dt className="text-slate-400">HTTP status</dt><dd>{health.httpStatus ?? 'Unavailable'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-slate-400">Response time</dt><dd>{health.latencyMs} ms</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-slate-400">Readiness</dt><dd>{health.ready ? 'Ready' : 'Not confirmed'}</dd></div>
                      {health.version && <div className="flex justify-between gap-4"><dt className="text-slate-400">Version</dt><dd>{health.version}</dd></div>}
                      {health.error && <div className="flex justify-between gap-4 text-amber-300"><dt>Error</dt><dd>{health.error}</dd></div>}
                    </dl>
                  </div>
                );
              })}
            </div>

            <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
              <div className="flex justify-between gap-4"><dt className="text-slate-400">Local engine service</dt><dd>{data.cridergptEngine.localService}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-400">Video worker</dt><dd>{data.cridergptEngine.videoWorker}</dd></div>
            </dl>

            {Object.keys(data.cridergptEngine.local.dependencies).length > 0 && (
              <div className="mt-5">
                <h3 className="text-sm font-medium text-slate-300">Local Engine dependencies</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(data.cridergptEngine.local.dependencies).map(([name, value]) => (
                    <span key={name} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                      {name}: {typeof value === 'boolean' ? (value ? 'Ready' : 'Unavailable') : typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
