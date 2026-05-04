import { describe, it, expect } from 'vitest';
import { partitionForBoard } from '../boardPartition';
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

describe('partitionForBoard — column assignment', () => {
  it('puts untriaged todo tasks in NEW', () => {
    const t = T({ id: 1, status: 'todo', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z' });
    const p = partitionForBoard([t]);
    expect(p.new.map((x) => x.id)).toEqual([1]);
    expect(p.upcoming).toEqual([]);
    expect(p.done).toEqual([]);
  });

  it('puts triaged todo tasks in UPCOMING', () => {
    const t = T({ id: 1, status: 'todo', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-02T00:00:00Z' });
    const p = partitionForBoard([t]);
    expect(p.upcoming.map((x) => x.id)).toEqual([1]);
    expect(p.new).toEqual([]);
  });

  it('puts in_progress in UPCOMING regardless of triage state', () => {
    const a = T({ id: 1, status: 'in_progress', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z' });
    const b = T({ id: 2, status: 'in_progress', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-05T00:00:00Z' });
    const p = partitionForBoard([a, b]);
    expect(p.upcoming.map((x) => x.id).sort()).toEqual([1, 2]);
    expect(p.new).toEqual([]);
  });

  it('puts done tasks in DONE regardless of triage state', () => {
    const a = T({ id: 1, status: 'done', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z' });
    const b = T({ id: 2, status: 'done', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-05T00:00:00Z' });
    const p = partitionForBoard([a, b]);
    expect(p.done.map((x) => x.id).sort()).toEqual([1, 2]);
    expect(p.new).toEqual([]);
    expect(p.upcoming).toEqual([]);
  });

  it('handles all three columns at once', () => {
    const tasks = [
      T({ id: 1, status: 'todo', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z' }), // NEW
      T({ id: 2, status: 'todo', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-02T00:00:00Z' }), // UPCOMING
      T({ id: 3, status: 'done', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-03T00:00:00Z' }), // DONE
    ];
    const p = partitionForBoard(tasks);
    expect(p.new.map((x) => x.id)).toEqual([1]);
    expect(p.upcoming.map((x) => x.id)).toEqual([2]);
    expect(p.done.map((x) => x.id)).toEqual([3]);
  });

  it('returns empty partition for empty input', () => {
    expect(partitionForBoard([])).toEqual({ new: [], upcoming: [], done: [] });
  });
});

describe('partitionForBoard — sort within columns', () => {
  it('NEW: sorts by createdAt descending (newest first)', () => {
    const tasks = [
      T({ id: 1, createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z' }),
      T({ id: 2, createdAt: '2026-04-03T00:00:00Z', updatedAt: '2026-04-03T00:00:00Z' }),
      T({ id: 3, createdAt: '2026-04-02T00:00:00Z', updatedAt: '2026-04-02T00:00:00Z' }),
    ];
    const p = partitionForBoard(tasks);
    expect(p.new.map((x) => x.id)).toEqual([2, 3, 1]);
  });

  it('DONE: sorts by updatedAt descending (most recently completed first)', () => {
    const tasks = [
      T({ id: 1, status: 'done', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z' }),
      T({ id: 2, status: 'done', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-05T00:00:00Z' }),
      T({ id: 3, status: 'done', createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-03T00:00:00Z' }),
    ];
    const p = partitionForBoard(tasks);
    expect(p.done.map((x) => x.id)).toEqual([2, 3, 1]);
  });

  it('UPCOMING: smart-sorts overdue before today before later before no-date', () => {
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const yesterdayStr = new Date(today.getTime() - 86_400_000).toISOString().slice(0, 10);
    const tomorrowStr = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);
    const triagedAt = '2026-04-02T00:00:00Z';

    const tasks = [
      T({ id: 1, dueDate: null, createdAt: '2026-04-01T00:00:00Z', updatedAt: triagedAt }),
      T({ id: 2, dueDate: tomorrowStr, createdAt: '2026-04-01T00:00:00Z', updatedAt: triagedAt }),
      T({ id: 3, dueDate: yesterdayStr, createdAt: '2026-04-01T00:00:00Z', updatedAt: triagedAt }),
      T({ id: 4, dueDate: todayStr, createdAt: '2026-04-01T00:00:00Z', updatedAt: triagedAt }),
    ];
    const p = partitionForBoard(tasks);
    expect(p.upcoming.map((x) => x.id)).toEqual([3, 4, 2, 1]);
  });
});

describe('partitionForBoard — purity', () => {
  it('does not mutate input array', () => {
    const tasks = [
      T({ id: 1, status: 'done' }),
      T({ id: 2, status: 'todo', updatedAt: '2026-04-02T00:00:00Z' }),
      T({ id: 3, status: 'todo' }),
    ];
    const before = tasks.map((t) => t.id);
    partitionForBoard(tasks);
    const after = tasks.map((t) => t.id);
    expect(after).toEqual(before);
  });

  it('returns same partition for the same input (referentially stable per call)', () => {
    const tasks = [T({ id: 1, status: 'todo' })];
    const a = partitionForBoard(tasks);
    const b = partitionForBoard(tasks);
    expect(a.new.map((x) => x.id)).toEqual(b.new.map((x) => x.id));
  });
});
