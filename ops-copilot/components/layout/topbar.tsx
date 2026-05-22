'use client';

import Link from 'next/link';
import { Bell, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/lib/store';
import { formatDateTime } from '@/lib/utils';

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const { state } = useApp();
  const criticalCount = state.tasks.filter((t) => t.priority === 'critical' && t.status !== 'completed').length;
  const now = formatDateTime(new Date().toISOString());

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <h1 className="text-sm font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400 hidden sm:block">{now}</span>

        {criticalCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-red-700">{criticalCount} critical</span>
          </div>
        )}

        <div className="relative">
          <Bell className="h-4 w-4 text-slate-400" />
          {criticalCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {criticalCount}
            </span>
          )}
        </div>

        <Link href="/issues/new">
          <Button size="sm" variant="primary" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Issue
          </Button>
        </Link>
      </div>
    </header>
  );
}
