'use client';

import Link from 'next/link';
import { Plus, MapPin, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Topbar } from '@/components/layout/topbar';
import { useApp } from '@/lib/store';
import { PRIORITY_CONFIG, formatRelativeTime } from '@/lib/utils';
import type { IssueStatus } from '@/lib/types';

const STATUS_TABS: { value: IssueStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'completed', label: 'Completed' },
];

export default function IssuesPage() {
  const { state } = useApp();

  return (
    <div className="flex flex-col flex-1">
      <Topbar title="Issues" subtitle={`${state.issues.length} total issues`} />
      <main className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <Tabs defaultValue="all" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                {STATUS_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value}>
                    {t.label}
                    <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 text-[10px] font-medium text-slate-600">
                      {t.value === 'all'
                        ? state.issues.length
                        : state.issues.filter((i) => i.status === t.value).length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
              <Link href="/issues/new">
                <Button variant="primary" size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> New Issue
                </Button>
              </Link>
            </div>

            {STATUS_TABS.map((tab) => {
              const issues = tab.value === 'all'
                ? state.issues
                : state.issues.filter((i) => i.status === tab.value);

              return (
                <TabsContent key={tab.value} value={tab.value}>
                  {issues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <AlertCircle className="h-10 w-10 text-slate-200 mb-3" />
                      <p className="text-sm text-slate-400">No issues in this category</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {issues.map((issue) => {
                        const pCfg = PRIORITY_CONFIG[issue.priority];
                        return (
                          <Card key={issue.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start gap-4">
                                <div className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                                  issue.priority === 'critical' ? 'bg-red-500' :
                                  issue.priority === 'high' ? 'bg-orange-400' :
                                  issue.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-900">{issue.title}</p>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <Badge variant={issue.priority}>{pCfg.label}</Badge>
                                      <Badge variant={issue.status} className="capitalize">{issue.status.replace('_', ' ')}</Badge>
                                    </div>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">"{issue.source_message}"</p>
                                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
                                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{issue.location}</span>
                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatRelativeTime(issue.created_at)}</span>
                                    <span>Category: {issue.category}</span>
                                    {issue.ai_analysis && (
                                      <span className="flex items-center gap-1 text-blue-500">
                                        ✦ AI analyzed ({Math.round(issue.ai_analysis.confidence * 100)}% confidence)
                                      </span>
                                    )}
                                  </div>
                                  {issue.ai_analysis?.suggested_action && (
                                    <p className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1">
                                      <span className="font-medium">Suggestion:</span> {issue.ai_analysis.suggested_action}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </main>
    </div>
  );
}
