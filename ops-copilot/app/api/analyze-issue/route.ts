import { NextRequest, NextResponse } from 'next/server';
import type { AIAnalysis } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { message, orgContext } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      return analyzeWithAnthropic(message, orgContext ?? '');
    }

    return analyzeWithMock(message);
  } catch (err) {
    console.error('analyze-issue error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function analyzeWithAnthropic(message: string, orgContext: string): Promise<NextResponse> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are an AI assistant for a facility management operations team.
Your job is to analyze incoming issue reports and extract structured information.
Always respond with valid JSON only, no markdown, no explanation.
${orgContext ? `\nOrganization context:\n${orgContext}` : ''}`;

  const userPrompt = `Analyze this facility issue report and return a JSON object with these exact fields:
{
  "title": "concise issue title",
  "category": "one of: HVAC, Plumbing, Electrical, Elevator, Cleaning, Security, IT Support, Maintenance, Safety, Other",
  "location": "extracted location or 'To be confirmed'",
  "urgency": "text description of urgency",
  "priority": "one of: critical, high, medium, low",
  "deadline": "time constraint as string or null",
  "required_team": "team name needed",
  "suggested_action": "clear action to take",
  "summary": "2-sentence summary",
  "missing_info": ["array", "of", "missing", "details"],
  "confidence": 0.0 to 1.0
}

Issue report: "${message}"`;

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const data: AIAnalysis = JSON.parse(text);
  return NextResponse.json(data);
}

async function analyzeWithMock(message: string): Promise<NextResponse> {
  const { MockProvider } = await import('@/lib/ai/mock-provider');
  const provider = new MockProvider();
  const analysis = await provider.analyzeIssue(message, '');
  return NextResponse.json(analysis);
}
