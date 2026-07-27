'use client';
import React, { useEffect, useState } from 'react';
import { Monitor, Smartphone, Server } from 'lucide-react';

export default function ClientsPage() {
  const [devices, setDevices] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any | null>(null);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await fetch('/api/v1/devices');
        setDevices(await res.json());
      } catch (e) { console.error('Error fetching devices', e); }
    };
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, []);

  const filtered = devices.filter((d: any) => 
    d.ip_address?.includes(search) || d.mac_address?.includes(search) || d.friendly_name?.toLowerCase().includes(search.toLowerCase())
  );

  const saveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await fetch(`/api/v1/devices/${encodeURIComponent(editing.mac_address)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editing,
        friendly_name: formData.get('friendly_name')
      })
    });
    setEditing(null);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Network Clients</h1>
      </div>
      <div className="flex space-x-4 mb-4">
        <input type="text" placeholder="Search devices by IP, MAC, or Name..." className="border p-2 rounded w-full md:w-1/3 bg-white dark:bg-gray-800 dark:text-white" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MAC Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map((d: any) => (
              <tr key={d.mac_address} className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                <td className="px-6 py-4 flex items-center space-x-3">
                  <Monitor className="text-gray-400 w-5 h-5" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{d.friendly_name || d.hostname || 'Unknown Device'}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{d.ip_address}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{d.mac_address}</td>
                <td className={`px-6 py-4 text-sm font-bold ${d.status === 'Online' ? 'text-green-500' : 'text-gray-400'}`}>{d.status}</td>
                <td className="px-6 py-4 text-right"><button onClick={() => setEditing(d)} className="text-sm text-blue-400">Rename</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <form onSubmit={saveName} className="flex max-w-xl gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <input name="friendly_name" defaultValue={editing.friendly_name || editing.hostname || ''} required className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 p-2" aria-label="Friendly device name" />
          <button className="rounded bg-blue-600 px-4 py-2">Save name</button>
          <button type="button" onClick={() => setEditing(null)} className="rounded border border-slate-700 px-4 py-2">Cancel</button>
        </form>
      )}
    </div>
  );
}
