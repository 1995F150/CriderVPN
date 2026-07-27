'use client';

import React, { useEffect, useState } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';

export default function DNSPage() {
  const [stats, setStats] = useState({ totalQueries: 0, blockedCount: 0 });
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await fetch('/api/v1/dns/stats');
        const statsData = await statsRes.json();
        setStats(statsData);

        const logsRes = await fetch('/api/v1/dns/logs');
        const logsData = await logsRes.json();
        setLogs(logsData);
      } catch (error) {
        console.error('Error fetching DNS data:', error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">DNS Filtering Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <StatCard title="Total Queries" value={stats.totalQueries} />
        <StatCard title="Blocked Queries" value={stats.blockedCount} color="red" />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client IP</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log: any, index: number) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.timestamp}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.domain}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.clientIp}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${log.status === 'BLOCK' ? 'text-red-600' : 'text-green-600'}`}>
                  {log.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
