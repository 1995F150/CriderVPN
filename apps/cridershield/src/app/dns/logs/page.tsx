'use client';
import React, { useEffect, useState } from 'react';

export default function DNSLogsPage() {
  const [logs, setLogs] = useState([]);
  const [filterDomain, setFilterDomain] = useState('');
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => {
    const fetchLogs = async () => {
      const res = await fetch(`http://localhost:3000/api/v1/logs?limit=${limit}&offset=${page * limit}&domain=${filterDomain}`);
      setLogs(await res.json());
    };
    fetchLogs();
  }, [page, filterDomain]);

  const exportCSV = () => window.open('http://localhost:3000/api/v1/logs/export/csv');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">DNS Query Logs</h1>
        <button onClick={exportCSV} className="bg-blue-600 text-white px-4 py-2 rounded">Export CSV</button>
      </div>
      <div className="flex space-x-4 mb-4">
        <input type="text" placeholder="Filter by domain..." className="border p-2 rounded bg-white dark:bg-gray-800 dark:text-white" value={filterDomain} onChange={(e) => setFilterDomain(e.target.value)} />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Domain</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client IP</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {logs.map((log: any, i) => (
              <tr key={i}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.timestamp}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{log.domain}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.client_ip}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${log.action === 'BLOCK' ? 'text-red-500' : 'text-green-500'}`}>{log.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between">
        <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-4 py-2 border rounded dark:text-white">Previous</button>
        <button onClick={() => setPage(page + 1)} className="px-4 py-2 border rounded dark:text-white">Next</button>
      </div>
    </div>
  );
}
