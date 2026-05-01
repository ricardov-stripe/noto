import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTasksViewState, encodeView, decodeView, DEFAULT_VIEW } from '../useTasksViewState';

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  window.localStorage.clear();
});

describe('useTasksViewState', () => {
  it('starts with defaults when no URL hash and no localStorage', () => {
    const { result } = renderHook(() => useTasksViewState());
    expect(result.current.view.status).toEqual(['todo', 'in_progress']);
    expect(result.current.view.sort).toBe('due-asc');
    expect(result.current.view.group).toBe('status');
  });

  it('hydrates from URL hash', () => {
    window.location.hash = encodeView({ ...DEFAULT_VIEW, search: 'foo', priority: ['high'] });
    const { result } = renderHook(() => useTasksViewState());
    expect(result.current.view.search).toBe('foo');
    expect(result.current.view.priority).toEqual(['high']);
  });

  it('hydrates from localStorage when no URL hash', () => {
    localStorage.setItem('noto:tasks:view-state', JSON.stringify({ ...DEFAULT_VIEW, sort: 'title-asc' }));
    const { result } = renderHook(() => useTasksViewState());
    expect(result.current.view.sort).toBe('title-asc');
  });

  it('URL beats localStorage', () => {
    localStorage.setItem('noto:tasks:view-state', JSON.stringify({ ...DEFAULT_VIEW, sort: 'title-asc' }));
    window.location.hash = encodeView({ ...DEFAULT_VIEW, sort: 'created-desc' });
    const { result } = renderHook(() => useTasksViewState());
    expect(result.current.view.sort).toBe('created-desc');
  });

  it('encode/decode round-trip preserves all fields', () => {
    const v = {
      ...DEFAULT_VIEW,
      search: 'q', status: ['done'] as const, priority: ['high', 'low'] as const,
      due: ['overdue', 'today'] as const, noteIds: [1, null],
      sort: 'prio-desc' as const, group: 'due' as const,
    };
    expect(decodeView(encodeView(v as any))).toMatchObject({
      search: 'q', status: ['done'], priority: ['high', 'low'],
      due: ['overdue', 'today'], noteIds: [1, null], sort: 'prio-desc', group: 'due',
    });
  });

  it('invalid URL params silently fall back to defaults', () => {
    window.location.hash = '#tasks?sort=BOGUS&priority=garbage';
    const { result } = renderHook(() => useTasksViewState());
    expect(result.current.view.sort).toBe('due-asc');
    expect(result.current.view.priority).toEqual([]);
  });

  it('mutating view writes to localStorage', () => {
    const { result } = renderHook(() => useTasksViewState());
    act(() => { result.current.setSort('title-asc'); });
    expect(JSON.parse(localStorage.getItem('noto:tasks:view-state') || '{}').sort).toBe('title-asc');
  });
});
