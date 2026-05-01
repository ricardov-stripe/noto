import { describe, it, expect } from 'vitest';
import { isTriaged, isUntriaged } from '../TriagedPredicate';

const base = {
  createdAt: '2026-05-01T10:00:00Z',
  updatedAt: '2026-05-01T10:00:00Z',
  status: 'todo' as const,
};

describe('isTriaged', () => {
  it('returns false when updatedAt equals createdAt', () => {
    expect(isTriaged(base)).toBe(false);
  });
  it('returns true when updatedAt is newer', () => {
    expect(isTriaged({ ...base, updatedAt: '2026-05-01T10:00:01Z' })).toBe(true);
  });
  it('returns true when updatedAt differs by any amount', () => {
    expect(isTriaged({ ...base, updatedAt: '2026-05-02T10:00:00Z' })).toBe(true);
  });
});

describe('isUntriaged', () => {
  it('returns true for fresh todo task', () => {
    expect(isUntriaged(base)).toBe(true);
  });
  it('returns false for done task even if fresh', () => {
    expect(isUntriaged({ ...base, status: 'done' })).toBe(false);
  });
  it('returns false for in_progress task even if fresh', () => {
    expect(isUntriaged({ ...base, status: 'in_progress' })).toBe(false);
  });
  it('returns false for touched todo task', () => {
    expect(isUntriaged({ ...base, updatedAt: '2026-05-01T10:00:01Z' })).toBe(false);
  });
});
