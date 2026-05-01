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
