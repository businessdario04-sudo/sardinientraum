import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { question, opsContext } = await req.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Question required' }, { status: 400 });
    }

    if (process.env.ANTHROPIC_API_KEY) {
      return queryWithAnthropic(question, opsContext ?? '');
    }

    return queryWithMock(question, opsContext ?? '');
  } catch (err) {
    console.error('ai-copilot error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function queryWithAnthropic(question: string, opsContext: string): Promise<NextResponse> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are an AI operations co-pilot for a facility management team.
You have read-only visibility into current tasks, teams, and issues.
Give concise, actionable answers. Use markdown formatting.
Always remind the user that you are providing suggestions — all decisions are theirs.
Never autonomously assign or complete tasks. Only advise.

Current operations context:
${opsContext}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    messages: [{ role: 'user', content: question }],
    system: systemPrompt,
  });

  const answer = response.content[0].type === 'text' ? response.content[0].text : 'No response.';
  return NextResponse.json({ answer });
}

async function queryWithMock(question: string, opsContext: string): Promise<NextResponse> {
  const { MockProvider } = await import('@/lib/ai/mock-provider');
  const provider = new MockProvider();
  const answer = await provider.queryCopilot(question, opsContext);
  return NextResponse.json({ answer });
}
