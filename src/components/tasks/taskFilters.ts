import type { Task } from '../../api';

export type StatusKey = Task['status'];
export type PriorityKey = Task['priority'];
export type DueBucket = 'overdue' | 'today' | 'this-week' | 'later' | 'none';
export type GroupKey = 'status' | 'due' | 'priority' | 'note' | 'week' | 'none';
export type SortKey =
  | 'due-asc' | 'due-desc'
  | 'prio-asc' | 'prio-desc'
  | 'created-asc' | 'created-desc'
  | 'title-asc'
  | 'smart';

export type Tab = 'new' | 'today' | 'upcoming' | 'all' | 'done';

export interface ViewState {
  tab: Tab;
  search: string;
  status: StatusKey[];
  priority: PriorityKey[];
  due: DueBucket[];
  noteIds: (number | null)[];
  sort: SortKey;
  group: GroupKey;
  collapsed: Record<string, boolean>;
  selection: Set<number>;
}

export interface Group {
  key: string;
  label: string;
  tasks: Task[];
}

const STATUS_ORDER: StatusKey[] = ['todo', 'in_progress', 'done'];
const STATUS_LABEL: Record<StatusKey, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const PRIO_RANK: Record<PriorityKey, number> = { high: 0, medium: 1, low: 2 };
const PRIO_ORDER: PriorityKey[] = ['high', 'medium', 'low'];
const DUE_ORDER: DueBucket[] = ['overdue', 'today', 'this-week', 'later', 'none'];
const DUE_LABEL: Record<DueBucket, string> = {
  overdue: 'Overdue', today: 'Today', 'this-week': 'This week', later: 'Later', none: 'No date',
};

function startOfToday(): number {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
}

export function dueBucket(dueDate: string | null): DueBucket {
  if (!dueDate) return 'none';
  const t = new Date(dueDate).getTime();
  if (isNaN(t)) return 'none';
  const today = startOfToday();
  const diff = t - today;
  if (diff < 0) return 'overdue';
  if (diff < 86_400_000) return 'today';
  if (diff < 7 * 86_400_000) return 'this-week';
  return 'later';
}

function passesFilters(t: Task, v: ViewState): boolean {
  if (v.status.length > 0 && !v.status.includes(t.status)) return false;
  if (v.priority.length > 0 && !v.priority.includes(t.priority)) return false;
  if (v.due.length > 0 && !v.due.includes(dueBucket(t.dueDate))) return false;
  if (v.noteIds.length > 0 && !v.noteIds.includes(t.sourceNoteId)) return false;
  if (v.search.trim().length > 0) {
    const q = v.search.toLowerCase();
    if (!t.title.toLowerCase().includes(q) && !t.sourceText.toLowerCase().includes(q)) return false;
  }
  return true;
}

function compare(a: Task, b: Task, sort: SortKey): number {
  switch (sort) {
    case 'due-asc':
    case 'due-desc': {
      const aT = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bT = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const cmp = aT - bT;
      return sort === 'due-asc' ? cmp : -cmp;
    }
    case 'prio-asc':
    case 'prio-desc': {
      const cmp = PRIO_RANK[a.priority] - PRIO_RANK[b.priority];
      return sort === 'prio-asc' ? cmp : -cmp;
    }
    case 'created-asc':
    case 'created-desc': {
      const cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === 'created-asc' ? cmp : -cmp;
    }
    case 'title-asc':
      return a.title.localeCompare(b.title);
    case 'smart':
      return smartCompare(a, b);
  }
}

/**
 * Smart sort for the Today view:
 *   rank 0: overdue (older-overdue first)
 *   rank 1: scheduled today (with time, chronological)
 *   rank 2: today-due without time (priority desc, then title)
 *   rank 3: later (date only)
 *   rank 4: no due date
 */
function smartRank(t: Task): number {
  if (!t.dueDate) return 4;
  const todayStr = new Date(startOfToday()).toISOString().slice(0, 10);
  const dayPart = t.dueDate.slice(0, 10);
  if (dayPart < todayStr) return 0;
  if (dayPart === todayStr && hasTime(t.dueDate)) return 1;
  if (dayPart === todayStr) return 2;
  return 3;
}

function hasTime(dueDate: string): boolean {
  return dueDate.length > 10;
}

function smartCompare(a: Task, b: Task): number {
  const ra = smartRank(a);
  const rb = smartRank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 0 || ra === 1) {
    // overdue: oldest-overdue first; scheduled: chronological
    return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
  }
  if (ra === 2) {
    // today-due, no time: priority desc (high=0), then title
    const cmp = PRIO_RANK[a.priority] - PRIO_RANK[b.priority];
    if (cmp !== 0) return cmp;
    return a.title.localeCompare(b.title);
  }
  if (ra === 3) {
    return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
  }
  // ra === 4, no due
  return a.title.localeCompare(b.title);
}

function isoWeekKey(iso: string): string {
  // Returns "YYYY-Www" where ww is ISO-8601 week number.
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'unknown';
  // Copy the date, adjust to Thursday of the same ISO week
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = copy.getUTCDay() || 7; // Sun = 0 → treat as 7
  copy.setUTCDate(copy.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((copy.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function groupKeyFor(t: Task, group: GroupKey): { key: string; label: string; order: number } {
  switch (group) {
    case 'status':
      return { key: t.status, label: STATUS_LABEL[t.status], order: STATUS_ORDER.indexOf(t.status) };
    case 'due': {
      const b = dueBucket(t.dueDate);
      return { key: b, label: DUE_LABEL[b], order: DUE_ORDER.indexOf(b) };
    }
    case 'priority':
      return { key: t.priority, label: t.priority[0].toUpperCase() + t.priority.slice(1), order: PRIO_ORDER.indexOf(t.priority) };
    case 'note':
      return t.sourceNoteId == null
        ? { key: 'manual', label: 'Manual', order: Number.POSITIVE_INFINITY }
        : { key: `note:${t.sourceNoteId}`, label: `Note ${t.sourceNoteId}`, order: t.sourceNoteId };
    case 'week': {
      const base = t.updatedAt ?? t.createdAt;
      const wk = isoWeekKey(base);
      // Order descending (newer week first) via negative numeric hash
      const orderNum = -parseInt(wk.replace(/[^0-9]/g, ''), 10);
      return { key: wk, label: wk, order: orderNum };
    }
    case 'none':
      return { key: 'all', label: 'All', order: 0 };
  }
}

export function applyView(tasks: Task[], view: ViewState): Group[] {
  const filtered = tasks.filter((t) => passesFilters(t, view));
  const sorted = [...filtered].sort((a, b) => compare(a, b, view.sort));
  const groups = new Map<string, { label: string; order: number; tasks: Task[] }>();
  for (const t of sorted) {
    const { key, label, order } = groupKeyFor(t, view.group);
    if (!groups.has(key)) groups.set(key, { label, order, tasks: [] });
    groups.get(key)!.tasks.push(t);
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, g]) => ({ key, label: g.label, tasks: g.tasks }));
}
