'use client';
import React, { useEffect, useState } from 'react';
import { TrendChart } from '../../components/charts/LineChart';
import { StatCard } from '@/components/dashboard/StatCard';
import { Activity, Shield, Percent } from 'lucide-react';

export default function AnalyticsPage() {
  const [overview, setOverview] = useState({ totalQueries: 0, blockedQueries: 0, blockRate: 0 });
  const [trend, setTrend] = useState([]);
  const [topDomains, setTopDomains] = useState([]);
  const [range, setRange] = useState('day');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/v1/analytics?range=${range}`)
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.details || body.error || 'Unable to load Pi-hole analytics');
        return body;
      })
      .then(data => {
        setOverview(data.overview);
        setTrend(data.trend);
        setTopDomains(data.topDomains);
        setError('');
      })
      .catch(err => setError(err.message));
  }, [range]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Network Analytics</h1>
        <select value={range} onChange={(e) => setRange(e.target.value)} className="border p-2 rounded bg-white dark:bg-gray-800 dark:text-white">
          <option value="hour">Last Hour</option>
          <option value="day">Last 24 Hours</option>
          <option value="week">Last 7 Days</option>
        </select>
      </div>
      {error && <div className="rounded border border-amber-700 bg-amber-950/30 p-4 text-amber-200">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Queries" value={overview.totalQueries} icon={Activity} />
        <StatCard title="Blocked Queries" value={overview.blockedQueries} icon={Shield} status="green" />
        <StatCard title="Block Rate" value={`${overview.blockRate}%`} icon={Percent} status="neutral" />
      </div>
      <TrendChart data={trend} />
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
        <h3 className="text-sm font-medium text-gray-500 mb-4">Top Allowed Domains</h3>
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {topDomains.map((d: any, i) => (
            <li key={i} className="py-2 flex justify-between">
              <span className="text-sm text-gray-900 dark:text-white">{d.domain}</span>
              <span className="text-sm text-gray-500">{d.count} reqs</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
