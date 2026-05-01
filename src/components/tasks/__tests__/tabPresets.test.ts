import { describe, it, expect } from 'vitest';
import { preset } from '../tabPresets';

describe('tabPresets', () => {
  it('new: status=todo, sort=created-desc, no grouping', () => {
    const p = preset('new');
    expect(p.status).toEqual(['todo']);
    expect(p.sort).toBe('created-desc');
    expect(p.group).toBe('none');
  });

  it('today: open statuses, smart sort, no group', () => {
    const p = preset('today');
    expect(p.status).toEqual(['todo', 'in_progress']);
    expect(p.sort).toBe('smart');
    expect(p.group).toBe('none');
  });

  it('upcoming: open statuses, due-asc, group by due', () => {
    const p = preset('upcoming');
    expect(p.status).toEqual(['todo', 'in_progress']);
    expect(p.sort).toBe('due-asc');
    expect(p.group).toBe('due');
  });

  it('all: open statuses, due-asc, group by status', () => {
    const p = preset('all');
    expect(p.status).toEqual(['todo', 'in_progress']);
    expect(p.sort).toBe('due-asc');
    expect(p.group).toBe('status');
  });

  it('done: status=done, created-desc, group by week', () => {
    const p = preset('done');
    expect(p.status).toEqual(['done']);
    expect(p.sort).toBe('created-desc');
    expect(p.group).toBe('week');
  });

  it('preset returns a stable reference for the same tab', () => {
    // Sanity check: object shape stable across calls (no random fields).
    const a = preset('today');
    const b = preset('today');
    expect(a).toEqual(b);
  });
});
