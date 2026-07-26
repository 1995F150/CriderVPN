'use client';
import React, { useEffect, useState } from 'react';
import { Shield, Activity, Globe, Zap, Cpu, Server, Database, Clock, Terminal } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';

const ProgressBar = ({ label, value, max, unit }: { label: string, value: number, max: number, unit: string }) => {
  const percentage = Math.min(Math.round((value / max) * 100), 100);
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-200">{value.toFixed(1)} / {max.toFixed(1)} {unit}</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div 
          className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default function DashboardPage() {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/v1/system/telemetry');
        const data = await response.json();
        setTelemetry(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching telemetry:', error);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 2000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !telemetry) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
    </div>
  );

  const disk = telemetry.storage.disks[0] || { used: 0, size: 1, path: '/' };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-100">System Dashboard</h1>
        <p className="text-slate-400">Real-time infrastructure and security telemetry</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="CPU Load" value={`${telemetry.cpu.load.toFixed(1)}%`} icon={Cpu} status={telemetry.cpu.load > 80 ? 'red' : 'neutral'} />
        <StatCard title="Memory Usage" value={`${((telemetry.mem.active / telemetry.mem.total) * 100).toFixed(1)}%`} icon={Server} status={telemetry.mem.active / telemetry.mem.total > 0.9 ? 'red' : 'neutral'} />
        <StatCard title="Network Traffic" value={telemetry.net.rx_sec > 1024 * 1024 ? `${(telemetry.net.rx_sec / 1024 / 1024).toFixed(1)} MB/s` : `${(telemetry.net.rx_sec / 1024).toFixed(1)} KB/s`} icon={Activity} />
        <StatCard title="Uptime" value={`${Math.floor(telemetry.uptime / 3600)}h ${Math.floor((telemetry.uptime % 3600) / 60)}m`} icon={Clock} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-slate-100">System Information</h2>
            <div className="px-3 py-1 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20">Operational</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="flex justify-between py-2 border-b border-slate-700/50">
                <span className="text-slate-400">OS</span>
                <span className="text-slate-100 font-medium">{telemetry.os.distro} {telemetry.os.release}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-700/50">
                <span className="text-slate-400">Kernel</span>
                <span className="text-slate-100 font-medium">{telemetry.os.kernel}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-700/50">
                <span className="text-slate-400">Architecture</span>
                <span className="text-slate-100 font-medium">{telemetry.os.arch}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-700/50">
                <span className="text-slate-400">Hostname</span>
                <span className="text-slate-100 font-medium">{telemetry.os.hostname}</span>
              </div>
            </div>
            <div>
              <ProgressBar 
                label="Memory (Active)" 
                value={telemetry.mem.active / 1024 / 1024 / 1024} 
                max={telemetry.mem.total / 1024 / 1024 / 1024} 
                unit="GB" 
              />
              <ProgressBar 
                label="Disk Storage" 
                value={disk.used / 1024 / 1024 / 1024} 
                max={disk.size / 1024 / 1024 / 1024} 
                unit="GB" 
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
          <div className="flex items-center mb-6">
            <Terminal className="w-5 h-5 text-indigo-400 mr-2" />
            <h2 className="text-lg font-medium text-slate-100">Active Processes</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-400 text-left">
                <th className="pb-3 font-medium">Process</th>
                <th className="pb-3 font-medium text-right">PID</th>
                <th className="pb-3 font-medium text-right">CPU%</th>
                <th className="pb-3 font-medium text-right">MEM%</th>
                <th className="pb-3 font-medium text-right">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {telemetry.proc.list.slice(0, 10).map((proc: any) => (
                <tr key={proc.pid} className="text-sm">
                  <td className="py-3 text-slate-100 font-medium">{proc.name}</td>
                  <td className="py-3 text-slate-400 text-right">{proc.pid}</td>
                  <td className="py-3 text-right text-slate-100">{proc.cpu.toFixed(1)}%</td>
                  <td className="py-3 text-right text-slate-100">{proc.mem.toFixed(1)}%</td>
                  <td className="py-3 text-slate-400 text-right">{proc.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
