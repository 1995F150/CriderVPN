'use client';

import { useEffect, useState } from 'react';
import { Activity, Database, Shield, Users } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';

type Stats = {
  connected: boolean;
  blocking: boolean;
  totalQueries: number;
  blockedQueries: number;
  blockRate: number;
  uniqueDomains: number;
  clients: { active: number; total: number };
};

export default function DNSPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    const [statsRes, logsRes] = await Promise.all([
      fetch('/api/v1/dns/stats'),
      fetch('/api/v1/dns/logs?limit=25')
    ]);
    if (!statsRes.ok) {
      const body = await statsRes.json().catch(() => ({}));
      setError(body.details || body.error || 'Pi-hole data is unavailable');
      return;
    }
    setStats(await statsRes.json());
    setLogs(logsRes.ok ? await logsRes.json() : []);
    setError('');
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pi-hole DNS</h1>
        <p className="text-sm text-slate-400">Live statistics and recent queries from the Pi-hole v6 API.</p>
      </div>
      {error && (
        <div className="rounded-lg border border-amber-700 bg-amber-950/30 p-4 text-amber-200">
          <div className="font-medium">Pi-hole connection needs attention</div>
          <div className="mt-1 text-sm">{error}</div>
        </div>
      )}
      {stats && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Queries" value={stats.totalQueries} icon={Activity} />
            <StatCard title="Blocked Queries" value={stats.blockedQueries} icon={Shield} status="green" />
            <StatCard title="Block Rate" value={`${stats.blockRate.toFixed(1)}%`} icon={Database} />
            <StatCard title="Active Clients" value={stats.clients.active} icon={Users} />
          </div>
          <div className={`rounded-lg border p-4 ${stats.blocking ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300' : 'border-red-800 bg-red-950/30 text-red-300'}`}>
            Pi-hole blocking is {stats.blocking ? 'enabled' : 'disabled'}.
          </div>
        </>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800">
          <thead><tr>{['Timestamp', 'Domain', 'Client', 'Action'].map(label => <th key={label} className="px-5 py-3 text-left text-xs uppercase text-slate-400">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-800">
            {logs.map((log, index) => (
              <tr key={log.id || index}>
                <td className="px-5 py-3 text-sm text-slate-400">{log.timestamp}</td>
                <td className="px-5 py-3 text-sm">{log.domain}</td>
                <td className="px-5 py-3 text-sm text-slate-400">{log.client_name || log.client_ip}</td>
                <td className={`px-5 py-3 text-sm font-medium ${log.action === 'BLOCK' ? 'text-red-400' : 'text-emerald-400'}`}>{log.action}</td>
              </tr>
            ))}
            {!logs.length && <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">No query records returned.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
