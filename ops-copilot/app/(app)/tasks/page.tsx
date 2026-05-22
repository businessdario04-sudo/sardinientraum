'use client';

import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Topbar } from '@/components/layout/topbar';
import { TaskBoard } from '@/components/tasks/task-board';
import { useApp } from '@/lib/store';

export default function TasksPage() {
  const { state } = useApp();
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const active = state.tasks.filter((t) => t.status !== 'completed').length;

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Task Board" subtitle={`${active} active tasks`} />
      <main className="flex-1 p-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <Filter className="h-3 w-3 mr-1.5 text-slate-400" />
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All teams</SelectItem>
              {state.teams.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All priorities</SelectItem>
              <SelectItem value="critical" className="text-xs">Critical</SelectItem>
              <SelectItem value="high" className="text-xs">High</SelectItem>
              <SelectItem value="medium" className="text-xs">Medium</SelectItem>
              <SelectItem value="low" className="text-xs">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TaskBoard filter={search} teamFilter={teamFilter} priorityFilter={priorityFilter} />
      </main>
    </div>
  );
}
