import { Bot, Info } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { CopilotChat } from '@/components/ai-copilot/chat';

export default function AICopilotPage() {
  return (
    <div className="flex flex-col flex-1">
      <Topbar title="AI Co-Pilot" subtitle="Ask questions about your current operations" />
      <main className="flex-1 p-6 flex flex-col">
        {/* Info banner */}
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-blue-800">Human-in-the-loop assistant</p>
            <p className="text-xs text-blue-700 mt-0.5">
              The AI has read access to your current tasks, teams, and issues. It provides analysis and suggestions only.
              All task assignments and status changes must be confirmed by you in the Task Board.
            </p>
          </div>
        </div>
        <CopilotChat />
      </main>
    </div>
  );
}
