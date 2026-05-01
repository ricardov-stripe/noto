import { describe, it, expect } from 'vitest';
import { applyView, type ViewState, dueBucket } from '../taskFilters';
import type { Task } from '../../../api';

const T = (overrides: Partial<Task>): Task => ({
  id: 0,
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  dueDate: null,
  sourceNoteId: 1,
  sourceText: '',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
  ...overrides,
});

const DEFAULT_VIEW: ViewState = {
  tab: 'today',
  search: '',
  status: ['todo', 'in_progress'],
  priority: [],
  due: [],
  noteIds: [],
  sort: 'due-asc',
  group: 'status',
  collapsed: {},
  selection: new Set(),
};

describe('taskFilters — smart sort', () => {
  // "Today" reference point used by the smart sort
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const yesterdayStr = new Date(today.getTime() - 86_400_000).toISOString().slice(0, 10);
  const tomorrowStr = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);

  const smartView = (): ViewState => ({ ...DEFAULT_VIEW, sort: 'smart', group: 'none' });

  it('orders overdue tasks first, oldest-overdue before less-overdue', () => {
    const older = `${yesterdayStr}T00:00:00.000Z`;
    const olderOlder = new Date(Date.parse(older) - 86_400_000).toISOString();
    const tasks = [
      T({ id: 1, dueDate: tomorrowStr, title: 'future' }),
      T({ id: 2, dueDate: older, title: 'yesterday' }),
      T({ id: 3, dueDate: olderOlder, title: 'dayBefore' }),
    ];
    const groups = applyView(tasks, smartView());
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual([3, 2, 1]);
  });

  it('orders today-scheduled by chronological time', () => {
    const tasks = [
      T({ id: 1, dueDate: `${todayStr}T15:30:00.000Z`, title: 'afternoon' }),
      T({ id: 2, dueDate: `${todayStr}T09:00:00.000Z`, title: 'morning' }),
      T({ id: 3, dueDate: `${todayStr}T12:00:00.000Z`, title: 'noon' }),
    ];
    const groups = applyView(tasks, smartView());
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual([2, 3, 1]);
  });

  it('orders today-due unscheduled by priority desc', () => {
    const tasks = [
      T({ id: 1, dueDate: todayStr, priority: 'low' }),
      T({ id: 2, dueDate: todayStr, priority: 'high' }),
      T({ id: 3, dueDate: todayStr, priority: 'medium' }),
    ];
    const groups = applyView(tasks, smartView());
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual([2, 3, 1]);
  });

  it('ranks overdue -> scheduled-today -> today-due -> later -> no-due', () => {
    const tasks = [
      T({ id: 1, dueDate: null, title: 'nodue' }),
      T({ id: 2, dueDate: tomorrowStr, title: 'later' }),
      T({ id: 3, dueDate: todayStr, title: 'today-due' }),
      T({ id: 4, dueDate: `${todayStr}T10:00:00.000Z`, title: 'today-sched' }),
      T({ id: 5, dueDate: yesterdayStr, title: 'overdue' }),
    ];
    const groups = applyView(tasks, smartView());
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual([5, 4, 3, 2, 1]);
  });
});

describe('taskFilters — NEW tab untriaged filter', () => {
  const newView = (): ViewState => ({ ...DEFAULT_VIEW, tab: 'new', status: ['todo'], sort: 'created-desc', group: 'none' });

  it('filters to tasks whose updatedAt equals createdAt (untriaged)', () => {
    const tasks = [
      T({ id: 1, createdAt: '2026-05-01T10:00:00Z', updatedAt: '2026-05-01T10:00:00Z' }),
      T({ id: 2, createdAt: '2026-05-01T10:00:00Z', updatedAt: '2026-05-01T10:00:01Z' }),
    ];
    const groups = applyView(tasks, newView());
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual([1]);
  });

  it('excludes done tasks even if untriaged (via isUntriaged status gate)', () => {
    const tasks = [
      T({ id: 1, status: 'done', createdAt: '2026-05-01T10:00:00Z', updatedAt: '2026-05-01T10:00:00Z' }),
      T({ id: 2, status: 'todo', createdAt: '2026-05-01T10:00:00Z', updatedAt: '2026-05-01T10:00:00Z' }),
    ];
    const groups = applyView(tasks, newView());
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual([2]);
  });

  it('excludes in_progress tasks even if untriaged', () => {
    const tasks = [
      T({ id: 1, status: 'in_progress', createdAt: '2026-05-01T10:00:00Z', updatedAt: '2026-05-01T10:00:00Z' }),
      T({ id: 2, status: 'todo', createdAt: '2026-05-01T10:00:00Z', updatedAt: '2026-05-01T10:00:00Z' }),
    ];
    const groups = applyView(tasks, newView());
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual([2]);
  });

  it('other tabs do not apply the untriaged filter', () => {
    const tasks = [
      T({ id: 1, createdAt: '2026-05-01T10:00:00Z', updatedAt: '2026-05-01T10:00:00Z' }),
      T({ id: 2, createdAt: '2026-05-01T10:00:00Z', updatedAt: '2026-05-01T10:00:01Z' }),
    ];
    const groups = applyView(tasks, { ...DEFAULT_VIEW, tab: 'all', status: ['todo', 'in_progress'], group: 'none' });
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id)).sort()).toEqual([1, 2]);
  });
});

describe('taskFilters — week grouping', () => {
  const weekView = (): ViewState => ({
    ...DEFAULT_VIEW,
    status: ['done'],
    group: 'week',
    sort: 'created-desc',
  });

  it('groups done tasks by ISO week of updatedAt', () => {
    const tasks = [
      T({ id: 1, status: 'done', updatedAt: '2026-05-01T10:00:00Z', createdAt: '2026-05-01T10:00:00Z' }),
      T({ id: 2, status: 'done', updatedAt: '2026-05-02T10:00:00Z', createdAt: '2026-05-02T10:00:00Z' }),
      T({ id: 3, status: 'done', updatedAt: '2026-04-20T10:00:00Z', createdAt: '2026-04-20T10:00:00Z' }),
    ];
    const groups = applyView(tasks, weekView());
    expect(groups.length).toBeGreaterThanOrEqual(2);
    // Newer weeks come first (descending order because created-desc within, and ISO week sorts correctly)
    const firstGroupIds = groups[0].tasks.map((t) => t.id);
    expect(firstGroupIds).toContain(1);
    expect(firstGroupIds).toContain(2);
    // id 3 is in a different, older week
    const hasThreeSeparate = groups.some((g) => g.tasks.some((t) => t.id === 3) && !g.tasks.some((t) => t.id === 1));
    expect(hasThreeSeparate).toBe(true);
  });
});

describe('taskFilters', () => {
  it('default view: open statuses only', () => {
    const tasks = [T({ id: 1, status: 'todo' }), T({ id: 2, status: 'done' })];
    const groups = applyView(tasks, DEFAULT_VIEW);
    const ids = groups.flatMap((g) => g.tasks.map((t) => t.id));
    expect(ids).toEqual([1]);
  });

  it('search matches title case-insensitively', () => {
    const tasks = [T({ id: 1, title: 'Send Q2 report' }), T({ id: 2, title: 'unrelated' })];
    const groups = applyView(tasks, { ...DEFAULT_VIEW, search: 'q2' });
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual([1]);
  });

  it('priority filter narrows', () => {
    const tasks = [T({ id: 1, priority: 'high' }), T({ id: 2, priority: 'low' })];
    const groups = applyView(tasks, { ...DEFAULT_VIEW, priority: ['high'] });
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual([1]);
  });

  it('due bucket: overdue includes past, today is today, none is null', () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86_400_000).toISOString();
    const tomorrow = new Date(today.getTime() + 86_400_000).toISOString();
    expect(dueBucket(yesterday)).toBe('overdue');
    expect(dueBucket(today.toISOString())).toBe('today');
    expect(dueBucket(tomorrow)).toBe('this-week');
    expect(dueBucket(null)).toBe('none');
  });

  it('group by status produces ordered groups Todo / In Progress / Done', () => {
    const tasks = [T({ id: 1, status: 'done' }), T({ id: 2, status: 'todo' }), T({ id: 3, status: 'in_progress' })];
    const groups = applyView(tasks, { ...DEFAULT_VIEW, status: ['todo', 'in_progress', 'done'] });
    expect(groups.map((g) => g.key)).toEqual(['todo', 'in_progress', 'done']);
  });

  it('sort due-asc: nulls last, overdue earliest first', () => {
    const tasks = [
      T({ id: 1, dueDate: null }),
      T({ id: 2, dueDate: '2026-05-15T00:00:00Z' }),
      T({ id: 3, dueDate: '2026-05-01T00:00:00Z' }),
    ];
    const groups = applyView(tasks, { ...DEFAULT_VIEW, group: 'none' });
    expect(groups[0].tasks.map((t) => t.id)).toEqual([3, 2, 1]);
  });

  it('group by note: tasks without sourceNoteId collect under "manual"', () => {
    const tasks = [T({ id: 1, sourceNoteId: null }), T({ id: 2, sourceNoteId: 5 })];
    const groups = applyView(tasks, { ...DEFAULT_VIEW, group: 'note' });
    expect(groups.find((g) => g.key === 'manual')?.tasks.map((t) => t.id)).toEqual([1]);
  });

  it('noteIds filter with null included matches manual tasks only', () => {
    const tasks = [T({ id: 1, sourceNoteId: null }), T({ id: 2, sourceNoteId: 5 })];
    const groups = applyView(tasks, { ...DEFAULT_VIEW, noteIds: [null] });
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual([1]);
  });
});
