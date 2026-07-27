'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Camera, Container, Gamepad2, Globe2, Heart, Laptop, Lock,
  Monitor, Network, Printer, RefreshCw, Router, Search, Server, Share2,
  Smartphone, Star, Tablet, Tv, Wifi
} from 'lucide-react';

type Device = {
  mac_address: string;
  ip_address?: string;
  hostname?: string;
  friendly_name?: string;
  vendor?: string;
  device_type?: string;
  os?: string;
  first_seen?: string;
  last_seen?: string;
  status: 'Online' | 'Idle' | 'Offline';
  connection_type?: string;
  interface_name?: string;
  role?: string;
  confidence?: number;
  favorite?: boolean;
  dns_queries?: number;
  blocked_queries?: number;
  bytes_up?: number | null;
  bytes_down?: number | null;
  sources?: string[];
  metadata?: Record<string, any>;
  icon?: string;
  group_name?: string;
  notes?: string;
};

type Event = {
  id: number;
  event_type: string;
  message: string;
  created_at: string;
  acknowledged: number;
};

type Topology = {
  nodes: { id: string; label: string; type?: string; status: string; ip?: string }[];
  edges: { from: string; to: string; type: string }[];
};

const iconFor = (device: Device) => {
  const kind = `${device.role || ''} ${device.device_type || ''} ${device.connection_type || ''}`.toLowerCase();
  if (kind.includes('gateway') || kind.includes('router')) return Globe2;
  if (kind.includes('shared')) return Share2;
  if (kind.includes('tailscale') || kind.includes('vpn')) return Lock;
  if (kind.includes('phone')) return Smartphone;
  if (kind.includes('tablet')) return Tablet;
  if (kind.includes('laptop')) return Laptop;
  if (kind.includes('printer')) return Printer;
  if (kind.includes('camera')) return Camera;
  if (kind.includes('console')) return Gamepad2;
  if (kind.includes('tv')) return Tv;
  if (kind.includes('container') || kind.includes('docker')) return Container;
  if (kind.includes('server') || kind.includes('nas')) return Server;
  if (kind.includes('access point') || kind.includes('network')) return Router;
  return Monitor;
};

const statusStyle: Record<string, string> = {
  Online: 'border-emerald-700 bg-emerald-950/40 text-emerald-300',
  Idle: 'border-amber-700 bg-amber-950/40 text-amber-300',
  Offline: 'border-red-800 bg-red-950/40 text-red-300'
};

const connectionIcon = (connection?: string) => {
  const value = String(connection || '').toLowerCase();
  if (value.includes('wi-fi')) return Wifi;
  if (value.includes('tailscale') || value.includes('vpn')) return Lock;
  if (value.includes('bridge') || value.includes('shared')) return Share2;
  return Network;
};

const visibleMac = (mac?: string) => mac && !mac.startsWith('virtual:') ? mac : 'Not available';
const displayName = (device: Device) =>
  device.friendly_name || device.hostname || device.role ||
  (device.vendor ? `${device.vendor} Device` : 'Unknown Device');

const formatBytes = (value?: number | null) => {
  if (value === null || value === undefined) return 'Not available';
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
};

export default function ClientsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [topology, setTopology] = useState<Topology>({ nodes: [], edges: [] });
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Device | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [devicesRes, eventsRes, topologyRes] = await Promise.all([
        fetch('/api/v1/devices'),
        fetch('/api/v1/devices/events?limit=20'),
        fetch('/api/v1/devices/topology')
      ]);
      if (!devicesRes.ok) throw new Error('Unable to load discovered clients');
      setDevices(await devicesRes.json());
      setEvents(eventsRes.ok ? await eventsRes.json() : []);
      setTopology(topologyRes.ok ? await topologyRes.json() : { nodes: [], edges: [] });
      setError('');
    } catch (requestError: any) {
      setError(requestError.message || 'Client discovery is unavailable');
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return devices;
    return devices.filter(device => [
      displayName(device), device.hostname, device.ip_address, device.mac_address,
      device.vendor, device.os, device.connection_type, device.device_type, device.role
    ].some(value => String(value || '').toLowerCase().includes(needle)));
  }, [devices, search]);

  const scanNow = async () => {
    setScanning(true);
    setError('');
    try {
      const response = await fetch('/api/v1/devices/scan', { method: 'POST' });
      if (!response.ok) throw new Error('Discovery scan failed');
      await load();
    } catch (scanError: any) {
      setError(scanError.message);
    } finally {
      setScanning(false);
    }
  };

  const updateDevice = async (device: Device, patch: Partial<Device>) => {
    await fetch(`/api/v1/devices/${encodeURIComponent(device.mac_address)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...device, ...patch })
    });
    await load();
  };

  const saveName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    await updateDevice(editing, {
      friendly_name: String(form.get('friendly_name') || ''),
      group_name: String(form.get('group_name') || ''),
      notes: String(form.get('notes') || '')
    });
    setEditing(null);
  };

  const enableNotifications = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification('CriderVPN alerts enabled', { body: 'New and offline device events can now be surfaced.' });
    }
  };

  const latestAlert = events.find(event =>
    !event.acknowledged && (event.event_type === 'new_device' || event.event_type === 'offline')
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Network Clients</h1>
          <p className="mt-1 text-sm text-slate-400">
            Multi-source identity, activity and topology intelligence refreshed every 10 seconds.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={enableNotifications} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Enable alerts
          </button>
          <button onClick={scanNow} disabled={scanning} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning…' : 'Scan now'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-red-300">{error}</div>}
      {latestAlert && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-blue-800 bg-blue-950/30 p-4 text-blue-200">
          <div>
            <div className="font-semibold">{latestAlert.event_type === 'new_device' ? 'New device detected' : 'Important device status'}</div>
            <div className="text-sm">{latestAlert.message}</div>
          </div>
          <button
            onClick={async () => {
              await fetch(`/api/v1/devices/events/${latestAlert.id}/acknowledge`, { method: 'POST' });
              await load();
            }}
            className="rounded border border-blue-700 px-3 py-1 text-sm"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Discovered', devices.length, Network],
          ['Online', devices.filter(device => device.status === 'Online').length, Activity],
          ['Favorites', devices.filter(device => device.favorite).length, Star],
          ['Evidence sources', new Set(devices.flatMap(device => device.sources || [])).size, Search]
        ].map(([label, value, Icon]: any) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between text-sm text-slate-400">
              {label}<Icon className="h-4 w-4 text-blue-400" />
            </div>
            <div className="mt-2 text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      <div className="relative max-w-2xl">
        <Search className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search hostname, MAC, IP, vendor, OS or connection…"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-11 pr-4 text-white outline-none focus:border-blue-500"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {filtered.map(device => {
          const DeviceIcon = iconFor(device);
          const ConnectionIcon = connectionIcon(device.connection_type);
          const services = Array.isArray(device.metadata?.services) ? device.metadata.services : [];
          return (
            <article key={device.mac_address} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-4">
                  <div className="rounded-xl bg-blue-600/20 p-3 text-blue-400"><DeviceIcon className="h-7 w-7" /></div>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold">{displayName(device)}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                      <span>{device.device_type || 'Device'}</span>
                      {device.role && <span className="rounded bg-slate-800 px-2 py-0.5">{device.role}</span>}
                    </div>
                  </div>
                </div>
                <button
                  title={device.favorite ? 'Remove favorite' : 'Add favorite'}
                  onClick={() => updateDevice(device, { favorite: !device.favorite })}
                  className="rounded-lg p-2 text-amber-400 hover:bg-slate-800"
                >
                  {device.favorite ? <Heart className="h-5 w-5 fill-current" /> : <Star className="h-5 w-5" />}
                </button>
              </div>

              <div className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Detail label="Hostname" value={device.hostname || 'Not resolved'} />
                <Detail label="IP address" value={device.ip_address || 'Not available'} />
                <Detail label="MAC address" value={visibleMac(device.mac_address)} />
                <Detail label="Vendor" value={device.vendor || 'Not identified'} />
                <Detail label="Operating system" value={device.os || 'Not identified'} />
                <Detail label="Interface" value={device.interface_name || 'Not available'} />
                <Detail label="First seen" value={device.first_seen ? new Date(device.first_seen).toLocaleString() : 'Not available'} />
                <Detail label="Last seen" value={device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Not available'} />
                <Detail label="DNS queries" value={String(device.dns_queries || 0)} />
                <Detail label="Blocked queries" value={String(device.blocked_queries || 0)} />
                <Detail label="Upload" value={formatBytes(device.bytes_up)} />
                <Detail label="Download" value={formatBytes(device.bytes_down)} />
              </div>

              {device.metadata?.addresses?.length > 1 && (
                <div className="mt-4 rounded-lg bg-slate-950/60 p-3 text-xs text-slate-400">
                  Addresses: {device.metadata.addresses.join(', ')}
                </div>
              )}
              {services.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {services.map((service: string) => (
                    <span key={service} className="rounded-full border border-emerald-900 bg-emerald-950/30 px-2.5 py-1 text-xs text-emerald-300">
                      {service}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle[device.status] || statusStyle.Offline}`}>
                    {device.status === 'Online' ? '🟢' : device.status === 'Idle' ? '🟡' : '🔴'} {device.status}
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                    <ConnectionIcon className="h-3.5 w-3.5" /> {device.connection_type || 'Network'}
                  </span>
                  <span className="rounded-full bg-blue-950/50 px-2.5 py-1 text-xs text-blue-300">
                    {Math.round(device.confidence || 0)}% confidence
                  </span>
                </div>
                <button onClick={() => setEditing(device)} className="text-sm font-medium text-blue-400 hover:text-blue-300">
                  Rename & manage
                </button>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Evidence: {(device.sources || []).join(', ') || 'neighbor cache'}
              </div>
            </article>
          );
        })}
      </div>

      {!filtered.length && (
        <div className="rounded-xl border border-dashed border-slate-700 p-12 text-center text-slate-500">
          No clients match this search.
        </div>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Share2 className="h-5 w-5 text-blue-400" /> Automatic topology</h2>
        <p className="mt-1 text-sm text-slate-400">Relationships inferred from gateway, shared LAN, Tailscale and interface evidence.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {topology.edges.slice(0, 30).map((edge, index) => {
            const from = topology.nodes.find(node => node.id === edge.from);
            const to = topology.nodes.find(node => node.id === edge.to);
            return (
              <div key={`${edge.from}-${edge.to}-${index}`} className="rounded-lg bg-slate-950/60 p-3 text-sm">
                <span className="font-medium text-slate-200">{from?.label || 'Network'}</span>
                <span className="mx-2 text-blue-400">→</span>
                <span className="text-slate-300">{to?.label || 'Device'}</span>
                <span className="ml-2 text-xs text-slate-500">({edge.type})</span>
              </div>
            );
          })}
          {!topology.edges.length && <div className="text-sm text-slate-500">Topology will appear after discovery collects multiple devices.</div>}
        </div>
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <form onSubmit={saveName} className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div>
              <h2 className="text-xl font-semibold">Manage {displayName(editing)}</h2>
              <p className="text-sm text-slate-400">{editing.ip_address} · {visibleMac(editing.mac_address)}</p>
            </div>
            <Field name="friendly_name" label="Custom name" defaultValue={editing.friendly_name || editing.hostname || ''} />
            <Field name="group_name" label="Group" defaultValue={editing.group_name || ''} />
            <label className="block text-sm text-slate-300">
              Notes
              <textarea name="notes" defaultValue={editing.notes || ''} className="mt-1 min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 p-3" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-700 px-4 py-2">Cancel</button>
              <button className="rounded-lg bg-blue-600 px-4 py-2 font-medium">Save device</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-0.5 break-words text-slate-200">{value}</div></div>;
}

function Field({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return <label className="block text-sm text-slate-300">{label}<input name={name} defaultValue={defaultValue} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-3" /></label>;
}
