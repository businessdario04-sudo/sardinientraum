'use client';

import { useApp } from '@/lib/store';
import { TaskCard } from './task-card';
import type { TaskStatus } from '@/lib/types';

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'open', label: 'Open', color: 'bg-slate-200' },
  { status: 'assigned', label: 'Assigned', color: 'bg-blue-200' },
  { status: 'in_progress', label: 'In Progress', color: 'bg-indigo-200' },
  { status: 'waiting', label: 'Waiting', color: 'bg-amber-200' },
  { status: 'completed', label: 'Completed', color: 'bg-green-200' },
];

interface TaskBoardProps {
  filter?: string;
  teamFilter?: string;
  priorityFilter?: string;
}

export function TaskBoard({ filter, teamFilter, priorityFilter }: TaskBoardProps) {
  const { state } = useApp();

  const filtered = state.tasks.filter((t) => {
    if (filter && !t.title.toLowerCase().includes(filter.toLowerCase()) &&
        !t.category.toLowerCase().includes(filter.toLowerCase()) &&
        !t.location.toLowerCase().includes(filter.toLowerCase())) return false;
    if (teamFilter && teamFilter !== 'all' && t.assigned_team_id !== teamFilter) return false;
    if (priorityFilter && priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {COLUMNS.map(({ status, label, color }) => {
        const col = filtered.filter((t) => t.status === status)
          .sort((a, b) => {
            const order = { critical: 0, high: 1, medium: 2, low: 3 };
            return order[a.priority] - order[b.priority];
          });

        return (
          <div key={status} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${color}`} />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</span>
              <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                {col.length}
              </span>
            </div>
            <div className="space-y-3">
              {col.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-slate-200 py-8 text-center">
                  <p className="text-xs text-slate-400">No tasks</p>
                </div>
              ) : (
                col.map((t) => <TaskCard key={t.id} task={t} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
