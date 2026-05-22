'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AIAnalysisPanel } from './ai-analysis-panel';
import { useApp } from '@/lib/store';
import { CATEGORIES } from '@/lib/mock-data';
import type { AIAnalysis, Priority } from '@/lib/types';

export function IssueForm() {
  const router = useRouter();
  const { addIssue, addTask, logActivity } = useApp();

  const [message, setMessage] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualPriority, setManualPriority] = useState<Priority>('medium');
  const [manualLocation, setManualLocation] = useState('');

  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  async function handleAnalyze() {
    if (!message.trim()) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    setAnalysis(null);
    try {
      const res = await fetch('/api/analyze-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error('Analysis request failed');
      const data: AIAnalysis = await res.json();
      setAnalysis(data);
    } catch (err) {
      setAnalyzeError('AI analysis unavailable. You can create the issue manually below.');
    } finally {
      setAnalyzing(false);
    }
  }

  function handleAcceptAnalysis() {
    if (!analysis) return;
    setAccepting(true);

    const issue = addIssue({
      title: analysis.title,
      source_message: message,
      category: analysis.category,
      location: analysis.location,
      priority: analysis.priority,
      status: 'open',
      ai_analysis: analysis,
    });

    addTask({
      issue_id: issue.id,
      title: analysis.title,
      description: analysis.summary,
      category: analysis.category,
      location: analysis.location,
      priority: analysis.priority,
      status: 'open',
      deadline: analysis.deadline
        ? new Date(Date.now() + parseDurationToMs(analysis.deadline)).toISOString()
        : undefined,
      ai_summary: analysis.summary,
      ai_suggested_action: analysis.suggested_action,
      source_message: message,
    });

    logActivity({
      entity_type: 'issue',
      entity_id: issue.id,
      action: 'ai_analysis_accepted',
      details: `AI analysis accepted. Task created. Priority: ${analysis.priority}`,
      created_at: new Date().toISOString(),
    });

    setAccepting(false);
    router.push('/tasks');
  }

  function handleManualCreate() {
    if (!manualTitle.trim()) return;
    const issue = addIssue({
      title: manualTitle,
      source_message: message,
      category: manualCategory || 'Other',
      location: manualLocation || 'To be confirmed',
      priority: manualPriority,
      status: 'open',
    });
    addTask({
      issue_id: issue.id,
      title: manualTitle,
      description: message,
      category: manualCategory || 'Other',
      location: manualLocation || 'To be confirmed',
      priority: manualPriority,
      status: 'open',
      ai_summary: '',
      ai_suggested_action: '',
      source_message: message,
    });
    router.push('/tasks');
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left: Input */}
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Incoming Message / Issue</h2>
          <p className="text-xs text-slate-500 mb-3">Paste or type the message received from a tenant, staff member, or monitoring system.</p>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={'AC is not working on floor 3, meeting rooms are getting too hot and there is an event in 45 minutes.'}
            className="min-h-[140px] text-sm"
          />
        </div>

        <Button
          variant="primary"
          className="w-full gap-2"
          onClick={handleAnalyze}
          disabled={!message.trim() || analyzing}
        >
          {analyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          {analyzing ? 'Analyzing…' : 'Analyze with AI'}
        </Button>

        {/* Manual fallback */}
        <div className="rounded-lg border border-slate-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Manual Override</p>
          <div>
            <Label className="mb-1.5 block">Title</Label>
            <Input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="Issue title…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Category</Label>
              <Select value={manualCategory} onValueChange={setManualCategory}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Priority</Label>
              <Select value={manualPriority} onValueChange={(v) => setManualPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['critical', 'high', 'medium', 'low'] as Priority[]).map((p) => (
                    <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Location</Label>
            <Input value={manualLocation} onChange={(e) => setManualLocation(e.target.value)} placeholder="Floor 3 – Meeting Rooms…" />
          </div>
          <Button variant="outline" className="w-full" onClick={handleManualCreate} disabled={!manualTitle.trim()}>
            Create Manually
          </Button>
        </div>
      </div>

      {/* Right: AI Analysis */}
      <div>
        {(analysis || analyzing || analyzeError) ? (
          <AIAnalysisPanel
            analysis={analysis}
            loading={analyzing}
            error={analyzeError}
            onAccept={handleAcceptAnalysis}
            onRetry={handleAnalyze}
            accepting={accepting}
          />
        ) : (
          <div className="h-full rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-8 text-center">
            <Wand2 className="h-8 w-8 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-400">AI Analysis</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
              Type or paste an issue message, then click "Analyze with AI" to extract structured data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function parseDurationToMs(deadline: string): number {
  const minMatch = deadline.match(/(\d+)\s*min/);
  const hourMatch = deadline.match(/(\d+)\s*hour/);
  if (minMatch) return parseInt(minMatch[1]) * 60 * 1000;
  if (hourMatch) return parseInt(hourMatch[1]) * 3600 * 1000;
  return 4 * 3600 * 1000;
}
