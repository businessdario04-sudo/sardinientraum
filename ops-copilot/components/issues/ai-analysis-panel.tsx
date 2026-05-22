'use client';

import { Sparkles, MapPin, Clock, Users, AlertTriangle, HelpCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PRIORITY_CONFIG } from '@/lib/utils';
import type { AIAnalysis } from '@/lib/types';

interface AIAnalysisPanelProps {
  analysis: AIAnalysis | null;
  loading: boolean;
  error: string | null;
  onAccept: () => void;
  onRetry: () => void;
  accepting: boolean;
}

export function AIAnalysisPanel({ analysis, loading, error, onAccept, onRetry, accepting }: AIAnalysisPanelProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Analyzing issue…</p>
            <p className="text-xs text-blue-600 mt-0.5">AI is extracting structured data from your message</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">Analysis failed</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
            <Button size="sm" variant="outline" className="mt-2 h-7 text-xs gap-1.5" onClick={onRetry}>
              <RefreshCw className="h-3 w-3" /> Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const pCfg = PRIORITY_CONFIG[analysis.priority];

  return (
    <div className="rounded-lg border border-blue-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5">
        <Sparkles className="h-4 w-4 text-blue-200" />
        <span className="text-sm font-semibold text-white">AI Analysis</span>
        <span className="ml-auto text-xs text-blue-200">
          Confidence: {Math.round(analysis.confidence * 100)}%
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Title */}
        <div>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Generated Title</p>
          <p className="text-sm font-semibold text-slate-900">{analysis.title}</p>
        </div>

        <Separator />

        {/* Grid of extracted fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Category</p>
            <Badge variant="secondary">{analysis.category}</Badge>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Priority</p>
            <Badge variant={analysis.priority}>{pCfg.label}</Badge>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Location</p>
            <div className="flex items-center gap-1 text-sm text-slate-700">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              {analysis.location}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Required Team</p>
            <div className="flex items-center gap-1 text-sm text-slate-700">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              {analysis.required_team}
            </div>
          </div>
          {analysis.deadline && (
            <div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Deadline</p>
              <div className="flex items-center gap-1 text-sm text-orange-700 font-medium">
                <Clock className="h-3.5 w-3.5" />
                {analysis.deadline}
              </div>
            </div>
          )}
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Urgency</p>
            <p className="text-sm text-slate-700">{analysis.urgency}</p>
          </div>
        </div>

        <Separator />

        {/* AI Summary */}
        <div>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">Summary</p>
          <p className="text-sm text-slate-700 leading-relaxed">{analysis.summary}</p>
        </div>

        {/* Suggested action */}
        <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
          <p className="text-[10px] font-medium text-blue-500 uppercase tracking-wide mb-1.5">Suggested Action</p>
          <p className="text-sm text-blue-900 leading-relaxed">{analysis.suggested_action}</p>
        </div>

        {/* Missing info */}
        {analysis.missing_info.length > 0 && (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
              <p className="text-xs font-semibold text-amber-700">Missing Information</p>
            </div>
            <ul className="space-y-1">
              {analysis.missing_info.map((item, i) => (
                <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                  <span className="mt-1 h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Disclaimer + Accept */}
        <div className="pt-1">
          <p className="text-[10px] text-slate-400 mb-3">
            This is an AI suggestion. Review all fields before creating the task. You remain responsible for all dispatch decisions.
          </p>
          <Button
            variant="primary"
            className="w-full gap-2"
            onClick={onAccept}
            disabled={accepting}
          >
            {accepting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {accepting ? 'Creating task…' : 'Accept & Create Task'}
          </Button>
        </div>
      </div>
    </div>
  );
}
