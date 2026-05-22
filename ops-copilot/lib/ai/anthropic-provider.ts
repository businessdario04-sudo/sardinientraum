import type { AIProvider } from './index';
import type { AIAnalysis } from '../types';

export class AnthropicProvider implements AIProvider {
  async analyzeIssue(message: string, orgContext: string): Promise<AIAnalysis> {
    const response = await fetch('/api/analyze-issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, orgContext }),
    });
    if (!response.ok) throw new Error('AI analysis failed');
    return response.json();
  }

  async queryCopilot(question: string, opsContext: string): Promise<string> {
    const response = await fetch('/api/ai-copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, opsContext }),
    });
    if (!response.ok) throw new Error('Copilot query failed');
    const data = await response.json();
    return data.answer;
  }
}
