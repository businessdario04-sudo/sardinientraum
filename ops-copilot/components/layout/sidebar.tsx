'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  AlertCircle,
  ClipboardList,
  Users,
  Bot,
  Settings,
  Building2,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/issues', label: 'Issues', icon: AlertCircle },
  { href: '/tasks', label: 'Tasks', icon: ClipboardList },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/ai-copilot', label: 'AI Co-Pilot', icon: Bot },
];

const BOTTOM_NAV = [
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-slate-900 text-slate-100">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-700/60 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none text-white">Ops Co-Pilot</p>
          <p className="text-[10px] text-slate-400 leading-none mt-0.5">Facility Management</p>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 space-y-0.5 p-3 pt-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {label === 'AI Co-Pilot' && (
                <span className="ml-auto rounded-full bg-blue-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">AI</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-slate-700/60 p-3 space-y-0.5">
        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
        <Link
          href="/login"
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </Link>
      </div>

      {/* User pill */}
      <div className="border-t border-slate-700/60 p-3">
        <div className="flex items-center gap-2.5 rounded-md bg-slate-800 px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
            AD
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-slate-100">Alex (Dispatcher)</p>
            <p className="truncate text-[10px] text-slate-400">dispatcher@meridian.io</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
