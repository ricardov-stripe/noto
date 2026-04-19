import Anthropic from '@anthropic-ai/sdk';

export interface ExtractedTask {
  title: string;
  priority: 'high' | 'medium' | 'low';
  suggestedDueDate: string | null;
  sourceText: string;
  reasoning: string;
}

export function buildExtractionPrompt(noteContent: string, noteTitle: string, existingTaskTitles: string[]): string {
  const today = new Date().toISOString().split('T')[0];
  const existingList = existingTaskTitles.length > 0
    ? `\nAlready extracted tasks (do NOT re-extract these):\n${existingTaskTitles.map(t => `- ${t}`).join('\n')}`
    : '';

  return `You are a task extraction assistant. Extract actionable tasks from the following note.

Today's date: ${today}
Note title: "${noteTitle}"
${existingList}

Rules:
- Only extract concrete, actionable items (not observations, ideas, or references)
- Each task must have: title, priority (high/medium/low), suggestedDueDate (YYYY-MM-DD or null), sourceText (the exact text that triggered this), reasoning (why this is a task)
- If a deadline is mentioned, calculate the date relative to today
- Do NOT extract tasks that match existing task titles above

Respond with ONLY valid JSON in this format:
{"tasks": [{"title": "...", "priority": "...", "suggestedDueDate": "...", "sourceText": "...", "reasoning": "..."}]}

Note content:
${noteContent}`;
}

export function parseExtractionResponse(raw: string): ExtractedTask[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.tasks)) return [];
    return parsed.tasks.filter((t: Record<string, unknown>) =>
      typeof t.title === 'string' && t.title.length > 0 &&
      typeof t.priority === 'string' &&
      typeof t.sourceText === 'string' &&
      typeof t.reasoning === 'string'
    ) as ExtractedTask[];
  } catch {
    return [];
  }
}

export async function extractTasks(
  apiKey: string,
  noteContent: string,
  noteTitle: string,
  existingTaskTitles: string[]
): Promise<ExtractedTask[]> {
  const client = new Anthropic({ apiKey });
  const prompt = buildExtractionPrompt(noteContent, noteTitle, existingTaskTitles);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return parseExtractionResponse(text);
}
