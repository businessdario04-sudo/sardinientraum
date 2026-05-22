'use client';

import { useState } from 'react';
import { MapPin, Clock, Users, ChevronDown, ChevronUp, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/lib/store';
import { PRIORITY_CONFIG, STATUS_CONFIG, formatRelativeTime, isOverdue, isUrgentSoon, cn } from '@/lib/utils';
import type { Task, TaskStatus } from '@/lib/types';

interface TaskCardProps {
  task: Task;
}

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'completed', label: 'Completed' },
];

export function TaskCard({ task }: TaskCardProps) {
  const { state, updateTask, logActivity } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [assignTeam, setAssignTeam] = useState(task.assigned_team_id ?? '');
  const [assignMember, setAssignMember] = useState(task.assigned_member_id ?? '');

  const pCfg = PRIORITY_CONFIG[task.priority];
  const sCfg = STATUS_CONFIG[task.status];
  const overdue = task.deadline ? isOverdue(task.deadline) && task.status !== 'completed' : false;
  const urgent = task.deadline ? isUrgentSoon(task.deadline, 90) && task.status !== 'completed' : false;

  const selectedTeam = state.teams.find((t) => t.id === assignTeam);
  const availableMembers = selectedTeam?.members ?? [];

  function handleStatusChange(status: string) {
    updateTask(task.id, { status: status as TaskStatus });
    logActivity({
      entity_type: 'task',
      entity_id: task.id,
      action: 'status_changed',
      details: `Status: ${task.status} → ${status}`,
      created_at: new Date().toISOString(),
    });
  }

  function handleAssign() {
    const team = state.teams.find((t) => t.id === assignTeam);
    const member = team?.members.find((m) => m.id === assignMember);
    updateTask(task.id, {
      assigned_team_id: assignTeam || undefined,
      assigned_team_name: team?.name,
      assigned_member_id: assignMember || undefined,
      assigned_member_name: member?.name,
      status: task.status === 'open' ? 'assigned' : task.status,
    });
    logActivity({
      entity_type: 'task',
      entity_id: task.id,
      action: 'assigned',
      details: `Assigned to ${member?.name ?? team?.name ?? 'team'}`,
      created_at: new Date().toISOString(),
    });
    setExpanded(false);
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md',
        task.priority === 'critical' && 'border-red-300',
        task.priority === 'high' && 'border-orange-200',
        task.status === 'completed' && 'opacity-60',
        overdue && 'ring-1 ring-red-400',
      )}
    >
      {/* Priority stripe */}
      <div className={cn('h-1 w-full rounded-t-lg', {
        'bg-red-500': task.priority === 'critical',
        'bg-orange-400': task.priority === 'high',
        'bg-yellow-400': task.priority === 'medium',
        'bg-green-400': task.priority === 'low',
      })} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 leading-tight truncate">{task.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{task.category}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 flex-wrap justify-end">
            <Badge variant={task.priority}>{pCfg.label}</Badge>
            <Badge variant={task.status}>{sCfg.label}</Badge>
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-2.5 flex flex-wrap gap-3 text-xs text-slate-500">
          {task.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {task.location}
            </span>
          )}
          {task.deadline && (
            <span className={cn('flex items-center gap-1', overdue && 'text-red-600 font-medium', urgent && !overdue && 'text-orange-600')}>
              <Clock className="h-3 w-3" />
              {overdue ? 'OVERDUE' : isUrgentSoon(task.deadline, 60) ? `Due soon` : formatRelativeTime(task.deadline)}
            </span>
          )}
          {task.assigned_team_name && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {task.assigned_member_name ?? task.assigned_team_name}
            </span>
          )}
        </div>

        {/* Alert banners */}
        {overdue && (
          <div className="mt-2 flex items-center gap-1.5 rounded bg-red-50 border border-red-200 px-2 py-1">
            <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
            <span className="text-xs font-medium text-red-700">Task is overdue</span>
          </div>
        )}

        {/* AI summary */}
        {task.ai_summary && (
          <p className="mt-2.5 text-xs text-slate-600 leading-relaxed line-clamp-2">{task.ai_summary}</p>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Collapse' : 'Details & Assignment'}
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            {/* AI suggestion */}
            {task.ai_suggested_action && (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-700">AI Suggested Action</span>
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">{task.ai_suggested_action}</p>
              </div>
            )}

            {/* Source message */}
            {task.source_message && (
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Original Message</p>
                <p className="text-xs text-slate-600 italic">"{task.source_message}"</p>
              </div>
            )}

            {/* Assignment */}
            {task.status !== 'completed' && (
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Assign</p>
                <Select value={assignTeam} onValueChange={(v) => { setAssignTeam(v); setAssignMember(''); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select team…" />
                  </SelectTrigger>
                  <SelectContent>
                    {state.teams.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableMembers.length > 0 && (
                  <Select value={assignMember} onValueChange={setAssignMember}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select member (optional)…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMembers.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">
                          {m.name} {m.available ? '' : '(unavailable)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {assignTeam && (
                  <Button size="sm" variant="primary" className="w-full h-7 text-xs" onClick={handleAssign}>
                    <CheckCircle2 className="h-3 w-3" />
                    Confirm Assignment
                  </Button>
                )}
              </div>
            )}

            {/* Status change */}
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Update Status</p>
              <Select value={task.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
