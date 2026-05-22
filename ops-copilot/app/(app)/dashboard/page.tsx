'use client';

import Link from 'next/link';
import {
  AlertCircle, ClipboardList, Clock, Users, TrendingUp, ArrowRight,
  AlertTriangle, CheckCircle2, Circle, Loader, Timer,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Topbar } from '@/components/layout/topbar';
import { useApp } from '@/lib/store';
import { PRIORITY_CONFIG, STATUS_CONFIG, formatRelativeTime, isOverdue, cn } from '@/lib/utils';

export default function DashboardPage() {
  const { state } = useApp();

  const active = state.tasks.filter((t) => t.status !== 'completed');
  const critical = active.filter((t) => t.priority === 'critical');
  const overdue = active.filter((t) => t.deadline && isOverdue(t.deadline));
  const unassigned = active.filter((t) => !t.assigned_team_id);
  const completedToday = state.tasks.filter((t) => {
    if (t.status !== 'completed') return false;
    const updated = new Date(t.updated_at);
    const today = new Date();
    return updated.toDateString() === today.toDateString();
  });

  const stats = [
    {
      label: 'Active Issues',
      value: state.issues.filter((i) => i.status !== 'completed').length,
      icon: AlertCircle,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      href: '/issues',
    },
    {
      label: 'Critical Tasks',
      value: critical.length,
      icon: AlertTriangle,
      color: critical.length > 0 ? 'text-red-600' : 'text-slate-400',
      bg: critical.length > 0 ? 'bg-red-50' : 'bg-slate-50',
      href: '/tasks',
      urgent: critical.length > 0,
    },
    {
      label: 'Overdue Tasks',
      value: overdue.length,
      icon: Clock,
      color: overdue.length > 0 ? 'text-orange-600' : 'text-slate-400',
      bg: overdue.length > 0 ? 'bg-orange-50' : 'bg-slate-50',
      href: '/tasks',
      urgent: overdue.length > 0,
    },
    {
      label: 'Unassigned',
      value: unassigned.length,
      icon: Users,
      color: unassigned.length > 0 ? 'text-amber-600' : 'text-slate-400',
      bg: unassigned.length > 0 ? 'bg-amber-50' : 'bg-slate-50',
      href: '/tasks',
    },
    {
      label: 'Active Tasks',
      value: active.length,
      icon: ClipboardList,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      href: '/tasks',
    },
    {
      label: 'Done Today',
      value: completedToday.length,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
      href: '/tasks',
    },
  ];

  const statusIcon: Record<string, React.ReactNode> = {
    open: <Circle className="h-3 w-3 text-slate-400" />,
    assigned: <Timer className="h-3 w-3 text-blue-500" />,
    in_progress: <Loader className="h-3 w-3 text-indigo-500" />,
    waiting: <Clock className="h-3 w-3 text-amber-500" />,
    completed: <CheckCircle2 className="h-3 w-3 text-green-500" />,
  };

  const priorityTasks = active
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, 6);

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Dashboard" subtitle="Meridian Properties Group — Today's overview" />
      <main className="flex-1 p-6 space-y-6">

        {/* Critical alert banner */}
        {critical.length > 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <p className="text-sm font-medium text-red-800">
              {critical.length} critical task{critical.length > 1 ? 's' : ''} require immediate attention
            </p>
            <Link href="/tasks" className="ml-auto text-xs font-semibold text-red-700 underline">
              View tasks →
            </Link>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {stats.map((s) => (
            <Link key={s.label} href={s.href}>
              <Card className={cn('hover:shadow-md transition-shadow cursor-pointer', s.urgent && 'ring-1 ring-red-300')}>
                <CardContent className="p-4">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.bg} mb-3`}>
                    <s.icon className={`h-4.5 w-4.5 ${s.color}`} />
                  </div>
                  <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Priority task feed */}
          <div className="xl:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Priority Tasks</CardTitle>
                  <Link href="/tasks">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs text-slate-500">
                      View all <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {priorityTasks.length === 0 ? (
                    <div className="py-10 text-center">
                      <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">All caught up! No active tasks.</p>
                    </div>
                  ) : (
                    priorityTasks.map((task) => {
                      const pCfg = PRIORITY_CONFIG[task.priority];
                      const sCfg = STATUS_CONFIG[task.status];
                      const od = task.deadline ? isOverdue(task.deadline) : false;
                      return (
                        <div key={task.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-slate-50 transition-colors">
                          <div className={cn('h-2 w-2 rounded-full shrink-0', {
                            'bg-red-500': task.priority === 'critical',
                            'bg-orange-400': task.priority === 'high',
                            'bg-yellow-400': task.priority === 'medium',
                            'bg-green-400': task.priority === 'low',
                          })} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 truncate">{task.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500">{task.category}</span>
                              <span className="text-slate-300">·</span>
                              <span className="text-xs text-slate-500">{task.location}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {od && <span className="text-xs font-medium text-red-600">OVERDUE</span>}
                            {task.assigned_team_name && (
                              <span className="text-xs text-slate-400">{task.assigned_team_name}</span>
                            )}
                            <Badge variant={task.priority} className="text-[10px]">{pCfg.label}</Badge>
                            <div className="flex items-center gap-1">
                              {statusIcon[task.status]}
                              <span className={`text-xs ${sCfg.color}`}>{sCfg.label}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Team availability */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Teams</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {state.teams.map((team) => {
                    const avail = team.members.filter((m) => m.available).length;
                    const total = team.members.length;
                    const teamTasks = active.filter((t) => t.assigned_team_id === team.id).length;
                    return (
                      <div key={team.id} className="flex items-center gap-3 px-5 py-2.5">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: team.color }}
                        />
                        <span className="text-sm text-slate-700 flex-1">{team.name}</span>
                        <span className="text-xs text-slate-400">{avail}/{total} avail.</span>
                        {teamTasks > 0 && (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {teamTasks}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Recent activity */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {state.activity.slice(0, 5).map((log) => (
                    <div key={log.id} className="px-5 py-2.5">
                      <p className="text-xs text-slate-700 leading-snug">{log.details}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400">{log.created_by_name}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-[10px] text-slate-400">{formatRelativeTime(log.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
