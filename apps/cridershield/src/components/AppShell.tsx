'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  ChartNoAxesCombined,
  FileText,
  ListFilter,
  LogOut,
  Monitor,
  Network,
  ServerCog,
  Shield
} from 'lucide-react';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: Activity },
  { href: '/dns', label: 'Pi-hole DNS', icon: Shield },
  { href: '/dns/logs', label: 'Query Logs', icon: FileText },
  { href: '/clients', label: 'Clients', icon: Monitor },
  { href: '/rules', label: 'Allow & Block', icon: ListFilter },
  { href: '/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
  { href: '/system', label: 'System', icon: ServerCog }
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === '/login' || pathname === '/setup') return children;

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 lg:flex">
      <aside className="border-b border-slate-800 bg-slate-900 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="rounded-xl bg-blue-600 p-2"><Network className="h-6 w-6" /></div>
          <div>
            <div className="font-bold">CriderVPN</div>
            <div className="text-xs text-slate-400">CriderShield Console</div>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <button onClick={logout} className="m-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white">
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
