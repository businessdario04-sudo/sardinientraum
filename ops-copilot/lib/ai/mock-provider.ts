import type { AIProvider } from './index';
import type { AIAnalysis, Priority } from '../types';

function detectCategory(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.match(/ac|air.?condition|hvac|heat|ventil|cool/)) return 'HVAC';
  if (lower.match(/water|leak|pipe|plumb|flood|sink|drain/)) return 'Plumbing';
  if (lower.match(/light|electric|power|outlet|circuit|flicke/)) return 'Electrical';
  if (lower.match(/elevator|lift|escalat/)) return 'Elevator';
  if (lower.match(/clean|dirt|trash|waste|sweep/)) return 'Cleaning';
  if (lower.match(/security|access|key|lock|door|alarm/)) return 'Security';
  if (lower.match(/network|wifi|internet|computer|server|screen/)) return 'IT Support';
  if (lower.match(/window|door|wall|floor|ceiling|roof|crack/)) return 'Maintenance';
  if (lower.match(/fire|smoke|gas|chemical|hazard|emergency/)) return 'Safety';
  return 'Maintenance';
}

function detectPriority(msg: string): Priority {
  const lower = msg.toLowerCase();
  if (lower.match(/fire|smoke|gas leak|emergency|immediate|safety|critical|danger|medical/)) return 'critical';
  if (lower.match(/event|presentation|meeting|client|ceo|urgent|asap|hour|min|soon/)) return 'high';
  if (lower.match(/today|this morning|afternoon|broken|not working|out of order/)) return 'medium';
  return 'low';
}

function detectTeam(category: string): string {
  const map: Record<string, string> = {
    HVAC: 'HVAC',
    Plumbing: 'Maintenance',
    Electrical: 'Electrical',
    Elevator: 'Maintenance / External Contractor',
    Cleaning: 'Cleaning',
    Security: 'Security',
    'IT Support': 'IT Support',
    Maintenance: 'Maintenance',
    Safety: 'Security + Maintenance',
  };
  return map[category] ?? 'Maintenance';
}

function extractLocation(msg: string): string {
  const lower = msg.toLowerCase();
  const floorMatch = lower.match(/floor\s*(\d+|b\d*)/);
  const roomMatch = lower.match(/room\s*(\d+[a-z]?)/);
  const lobbyMatch = lower.match(/lobby|reception|entrance/);
  const parkingMatch = lower.match(/parking|garage/);

  const parts: string[] = [];
  if (floorMatch) parts.push(`Floor ${floorMatch[1].toUpperCase()}`);
  if (roomMatch) parts.push(`Room ${roomMatch[1]}`);
  if (lobbyMatch) parts.push('Lobby');
  if (parkingMatch) parts.push('Parking');

  return parts.length > 0 ? parts.join(' / ') : 'To be confirmed';
}

function extractDeadline(msg: string): string | undefined {
  const lower = msg.toLowerCase();
  const minuteMatch = lower.match(/(\d+)\s*min/);
  const hourMatch = lower.match(/(\d+)\s*hour/);
  if (minuteMatch) return `${minuteMatch[1]} minutes`;
  if (hourMatch) return `${hourMatch[1]} hour(s)`;
  if (lower.match(/today/)) return 'End of today';
  return undefined;
}

function generateSuggestion(category: string, priority: Priority, deadline?: string): string {
  const urgencyPrefix = deadline ? `Respond within ${deadline}.` : '';
  const suggestions: Record<string, string> = {
    HVAC: 'Dispatch HVAC technician. Check thermostat and AC unit. Prepare portable fans as fallback.',
    Plumbing: 'Shut off water supply to affected area immediately. Send maintenance with tools. Place wet floor signs.',
    Electrical: 'Check circuit breaker first. Dispatch electrician. If fault persists, consider power isolation.',
    Elevator: 'Lock out elevator for safety. Display out-of-service signage. Contact elevator contractor.',
    Cleaning: 'Deploy cleaning team with appropriate equipment. Mark affected area if hazardous.',
    Security: 'Notify security chief. Review CCTV. Assess and escalate if needed.',
    'IT Support': 'Dispatch IT support. Check network switch and connections. Restart equipment if safe.',
    Maintenance: 'Assess damage in person. Arrange appropriate tools and parts. Schedule repair.',
    Safety: 'ALERT: Follow emergency protocol. Evacuate if necessary. Contact emergency services.',
  };
  const base = suggestions[category] ?? 'Assess situation. Assign appropriate team. Document findings.';
  return urgencyPrefix ? `${urgencyPrefix} ${base}` : base;
}

async function simulateDelay(ms = 1200): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class MockProvider implements AIProvider {
  async analyzeIssue(message: string, _orgContext: string): Promise<AIAnalysis> {
    await simulateDelay();

    const category = detectCategory(message);
    const priority = detectPriority(message);
    const location = extractLocation(message);
    const deadline = extractDeadline(message);
    const requiredTeam = detectTeam(category);
    const suggestedAction = generateSuggestion(category, priority, deadline);

    const words = message.split(' ');
    const titleWords = words.slice(0, 8).join(' ');
    const title = titleWords.charAt(0).toUpperCase() + titleWords.slice(1);

    const missing: string[] = [];
    if (location === 'To be confirmed') missing.push('Exact location / room number');
    if (!message.match(/\d/)) missing.push('Scope / affected area size');
    if (priority === 'high' || priority === 'critical') missing.push('Exact number of people affected');

    return {
      title: `${category} issue – ${location}`,
      category,
      location,
      urgency: priority === 'critical' ? 'Immediate response required' :
               priority === 'high' ? 'Respond within the hour' :
               priority === 'medium' ? 'Respond today' : 'Schedule for next available slot',
      priority,
      deadline,
      required_team: requiredTeam,
      suggested_action: suggestedAction,
      summary: `${category} incident reported at ${location}. Priority: ${priority.toUpperCase()}. ${deadline ? `Time constraint: ${deadline}.` : ''}`,
      missing_info: missing,
      confidence: 0.78 + Math.random() * 0.15,
    };
  }

  async queryCopilot(question: string, opsContext: string): Promise<string> {
    await simulateDelay(1800);

    const lower = question.toLowerCase();

    if (lower.match(/critical|urgent|immediate/)) {
      return `**Critical items right now:**\n\n` +
        `1. **Lighting fault – Floor 4 Executive Suite** (CRITICAL) — CEO presentation in 90 min. No team assigned yet. Action required immediately.\n\n` +
        `2. **AC failure – Floor 3 Meeting Rooms** (HIGH) — Event in ~30 min. HVAC team dispatched; confirm they are on-site.\n\n` +
        `**Recommendation:** Assign electrical team to Floor 4 now. This is your most time-sensitive open item.`;
    }

    if (lower.match(/overdue|late|missed|past deadline/)) {
      return `**Overdue tasks:**\n\n` +
        `No tasks are currently past their hard deadline. However:\n\n` +
        `- **Elevator B repair** has been in "Waiting" status for 4 hours — follow up with the elevator contractor.\n` +
        `- **Window latch – Annex A** was reported yesterday and is still unassigned.\n\n` +
        `Both should be addressed today.`;
    }

    if (lower.match(/team|workload|busy|most work/)) {
      return `**Team workload overview:**\n\n` +
        `| Team | Open | In Progress | Waiting |\n` +
        `|------|------|-------------|--------|\n` +
        `| Maintenance | 3 | 1 | 1 |\n` +
        `| HVAC | 2 | 0 | 0 |\n` +
        `| Electrical | 1 | 0 | 0 |\n` +
        `| Cleaning | 0 | 0 | 0 |\n\n` +
        `**Maintenance** has the highest load. Consider reassigning the window latch task (Annex A) to a maintenance tech who is currently free (Elena Kowalski is available).`;
    }

    if (lower.match(/next|handle|priorit|should i/)) {
      return `**Recommended next action:**\n\n` +
        `**Assign the Floor 4 electrical fault** — this is a CRITICAL task with no team assigned and a 90-minute deadline (CEO presentation).\n\n` +
        `After that:\n` +
        `1. Confirm HVAC is on-site for Floor 3 AC (event in ~30 min)\n` +
        `2. Follow up on Elevator B contractor ETA\n` +
        `3. Assign Annex A window latch to available maintenance tech\n\n` +
        `The rest of today's workload is manageable if you address these three items.`;
    }

    if (lower.match(/summar|today|overview|status/)) {
      return `**Today's operations summary:**\n\n` +
        `**Active:** 6 open tasks, 2 in progress\n` +
        `**Critical:** 1 (Floor 4 Electrical — unassigned)\n` +
        `**High:** 3 (AC Floor 3, Water Leak Floor 2, Elevator B)\n\n` +
        `**Completed today:** Lobby deep cleaning ✓\n\n` +
        `**Team availability:** HVAC (2 available), Maintenance (2 available, 1 busy), Electrical (1 available), Cleaning (3 available), Security (2 available)\n\n` +
        `**Key risk:** The Floor 4 electrical issue is unassigned and time-sensitive.`;
    }

    if (lower.match(/unassigned|no team|without team/)) {
      return `**Tasks without an assigned team:**\n\n` +
        `1. **Lighting fault – Floor 4** (CRITICAL) — Needs Electrical team\n` +
        `2. **Window latch – Annex A** (MEDIUM) — Needs Maintenance\n\n` +
        `Both can be resolved quickly: Klaus Weber (Electrical) and Elena Kowalski (Maintenance) are currently available.`;
    }

    return `I analyzed your operations context. Here's what I found:\n\n` +
      `You currently have **6 active tasks** across 4 teams. The most pressing item is the **Floor 4 electrical fault** (Critical, unassigned) before the CEO presentation.\n\n` +
      `Feel free to ask more specific questions like:\n` +
      `- *"What is critical right now?"*\n` +
      `- *"Which team has the most work?"*\n` +
      `- *"What should I handle next?"*\n` +
      `- *"Show tasks without assigned team"*`;
  }
}
