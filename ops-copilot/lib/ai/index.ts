import type { AIAnalysis } from '../types';

export interface AIProvider {
  analyzeIssue(message: string, orgContext: string): Promise<AIAnalysis>;
  queryCopilot(question: string, opsContext: string): Promise<string>;
}

export function getAIProvider(): AIProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    const { AnthropicProvider } = require('./anthropic-provider');
    return new AnthropicProvider();
  }
  const { MockProvider } = require('./mock-provider');
  return new MockProvider();
}
