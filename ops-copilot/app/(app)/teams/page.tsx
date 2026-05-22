'use client';

import { Users, CheckCircle2, XCircle, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Topbar } from '@/components/layout/topbar';
import { useApp } from '@/lib/store';

export default function TeamsPage() {
  const { state } = useApp();

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Teams" subtitle={`${state.teams.length} teams, ${state.teams.flatMap((t) => t.members).length} total members`} />
      <main className="flex-1 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {state.teams.map((team) => {
            const available = team.members.filter((m) => m.available).length;
            const activeTasks = state.tasks.filter(
              (t) => t.assigned_team_id === team.id && t.status !== 'completed',
            );
            const criticalTasks = activeTasks.filter((t) => t.priority === 'critical');

            return (
              <Card key={team.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs font-bold"
                        style={{ backgroundColor: team.color }}
                      >
                        {team.name.charAt(0)}
                      </div>
                      <div>
                        <CardTitle className="text-sm">{team.name}</CardTitle>
                        <p className="text-[11px] text-slate-500 mt-0.5">{team.specialty}</p>
                      </div>
                    </div>
                    {criticalTasks.length > 0 && (
                      <Badge variant="critical">{criticalTasks.length} critical</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats row */}
                  <div className="flex gap-4 rounded-lg bg-slate-50 border border-slate-100 p-3">
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-900">{available}/{team.members.length}</p>
                      <p className="text-[10px] text-slate-500">Available</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-slate-900">{activeTasks.length}</p>
                      <p className="text-[10px] text-slate-500">Active tasks</p>
                    </div>
                    {activeTasks.length > 0 && (
                      <div className="text-center">
                        <p className="text-lg font-bold text-red-600">{criticalTasks.length}</p>
                        <p className="text-[10px] text-slate-500">Critical</p>
                      </div>
                    )}
                  </div>

                  {/* Members */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Users className="h-3 w-3" /> Members
                    </p>
                    <div className="space-y-1.5">
                      {team.members.map((member) => (
                        <div key={member.id} className="flex items-center gap-2.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 shrink-0">
                            {member.name.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-800 truncate">{member.name}</p>
                            <p className="text-[10px] text-slate-400">{member.role}</p>
                          </div>
                          {member.available ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Active tasks preview */}
                  {activeTasks.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <ClipboardList className="h-3 w-3" /> Active Tasks
                      </p>
                      <div className="space-y-1">
                        {activeTasks.slice(0, 3).map((task) => (
                          <div key={task.id} className="flex items-center gap-2">
                            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              task.priority === 'critical' ? 'bg-red-500' :
                              task.priority === 'high' ? 'bg-orange-400' :
                              task.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                            }`} />
                            <p className="text-xs text-slate-600 truncate">{task.title}</p>
                            <Badge variant={task.status} className="ml-auto shrink-0 text-[9px]">
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        ))}
                        {activeTasks.length > 3 && (
                          <p className="text-[10px] text-slate-400 pl-3.5">+{activeTasks.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
