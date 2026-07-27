'use client';

import { useEffect, useState } from 'react';
import { CircleCheck, CircleX, RefreshCw } from 'lucide-react';

type SystemData = {
  services: Record<string, string>;
  tailscale: {
    connected: boolean;
    exitNode: boolean;
    tailnet: string | null;
    dnsName?: string | null;
  };
  proxy: { http: boolean; socks5: boolean };
  integrations: {
    pihole: { url: string; credentialConfigured: boolean };
  };
  checkedAt: string;
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
          <p className="text-sm text-slate-400">Live state from systemd, Tailscale, proxies and Pi-hole configuration.</p>
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
        </>
      )}
    </div>
  );
}
