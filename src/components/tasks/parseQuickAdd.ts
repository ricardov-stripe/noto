import type { Task } from '../../api';

export interface ParsedQuickAdd {
  title: string;
  priority: Task['priority'];
  dueDate: string | null;
  sourceNoteId: number | null;
}

export interface NoteRef { id: number; title: string; }

const PRIORITY_TOKENS: Record<string, Task['priority']> = {
  '!high': 'high', '!h': 'high',
  '!med': 'medium', '!medium': 'medium', '!m': 'medium',
  '!low': 'low', '!l': 'low',
};

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function startOfToday(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function iso(d: Date): string { return d.toISOString(); }

function parseDateToken(tok: string, base: Date): string | null {
  const t = tok.toLowerCase();
  if (t === 'today') return iso(new Date(base));
  if (t === 'tomorrow' || t === 'tmrw') { const d = new Date(base); d.setDate(d.getDate() + 1); return iso(d); }
  if (t === 'next' || t === 'this') return null; // handled by multi-token below

  const wd = WEEKDAYS.indexOf(t.slice(0, 3));
  if (wd >= 0) {
    const d = new Date(base);
    const today = d.getDay();
    let delta = (wd - today + 7) % 7;
    if (delta === 0) delta = 7;
    d.setDate(d.getDate() + delta);
    return iso(d);
  }

  const slash = /^(\d{1,2})\/(\d{1,2})$/.exec(tok);
  if (slash) {
    const m = Number(slash[1]); const day = Number(slash[2]);
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      const d = new Date(base.getFullYear(), m - 1, day);
      if (d.getTime() < base.getTime()) d.setFullYear(d.getFullYear() + 1);
      return iso(d);
    }
  }

  return null;
}

function parseMultiTokenDate(tokens: string[], i: number, base: Date): { dueDate: string; consumed: number } | null {
  const t0 = tokens[i].toLowerCase();
  // "next mon", "next week"
  if (t0 === 'next') {
    const t1 = tokens[i + 1]?.toLowerCase();
    if (t1 === 'week') { const d = new Date(base); d.setDate(d.getDate() + 7); return { dueDate: iso(d), consumed: 2 }; }
    const wd = t1 ? WEEKDAYS.indexOf(t1.slice(0, 3)) : -1;
    if (wd >= 0) {
      const d = new Date(base); const delta = ((wd - d.getDay() + 7) % 7) || 7;
      d.setDate(d.getDate() + delta + 7);
      return { dueDate: iso(d), consumed: 2 };
    }
  }
  // "MMM d" e.g. "dec 3"
  const m = MONTHS.indexOf(t0.slice(0, 3));
  const dayN = Number(tokens[i + 1]);
  if (m >= 0 && Number.isFinite(dayN) && dayN >= 1 && dayN <= 31) {
    const d = new Date(base.getFullYear(), m, dayN);
    if (d.getTime() < base.getTime()) d.setFullYear(d.getFullYear() + 1);
    return { dueDate: iso(d), consumed: 2 };
  }
  return null;
}

export function parseQuickAdd(input: string, notes: NoteRef[]): ParsedQuickAdd | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);
  const titleParts: string[] = [];
  let priority: Task['priority'] = 'medium';
  let dueDate: string | null = null;
  let sourceNoteId: number | null = null;
  const base = startOfToday();
  const slugMap = new Map(notes.map((n) => [slugify(n.title), n.id]));

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const lower = tok.toLowerCase();

    if (PRIORITY_TOKENS[lower]) { priority = PRIORITY_TOKENS[lower]; continue; }

    const multi = parseMultiTokenDate(tokens, i, base);
    if (multi) { dueDate = multi.dueDate; i += multi.consumed - 1; continue; }

    const single = parseDateToken(tok, base);
    if (single) { dueDate = single; continue; }

    if (tok.startsWith('#')) {
      const id = slugMap.get(slugify(tok.slice(1)));
      if (id != null) { sourceNoteId = id; continue; }
      // unknown slug — keep in title so user notices
    }

    titleParts.push(tok);
  }

  const title = titleParts.join(' ').trim();
  if (!title) return null;
  return { title, priority, dueDate, sourceNoteId };
}
