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

describe('useTasksViewState — tab field', () => {
  it('default tab is "today"', () => {
    const { result } = renderHook(() => useTasksViewState());
    expect(result.current.view.tab).toBe('today');
  });

  it('encodeView outputs #tasks/<tab> for non-today tabs', () => {
    expect(encodeView({ ...DEFAULT_VIEW, tab: 'new' })).toBe('#tasks/new');
    expect(encodeView({ ...DEFAULT_VIEW, tab: 'upcoming' })).toBe('#tasks/upcoming');
  });

  it('encodeView omits tab segment when tab is today (default)', () => {
    expect(encodeView({ ...DEFAULT_VIEW, tab: 'today' })).toBe('#tasks');
  });

  it('encodeView combines tab segment with query params', () => {
    const hash = encodeView({ ...DEFAULT_VIEW, tab: 'new', priority: ['high'] });
    expect(hash).toBe('#tasks/new?prio=high');
  });

  it('decodeView parses tab segment', () => {
    expect(decodeView('#tasks/upcoming').tab).toBe('upcoming');
    expect(decodeView('#tasks/done?sort=created-desc').tab).toBe('done');
  });

  it('decodeView falls back to today for unknown tab', () => {
    expect(decodeView('#tasks/bogus').tab).toBe('today');
  });

  it('decodeView returns tab today when path is plain #tasks', () => {
    expect(decodeView('#tasks').tab).toBeUndefined();
    expect(decodeView('#tasks?prio=high').tab).toBeUndefined();
  });

  it('setTab mutates tab field via set patch', () => {
    const { result } = renderHook(() => useTasksViewState());
    act(() => { result.current.setTab('new'); });
    expect(result.current.view.tab).toBe('new');
  });

  it('setTab applies preset (status/sort/group) for the new tab', () => {
    const { result } = renderHook(() => useTasksViewState());
    act(() => { result.current.setTab('done'); });
    expect(result.current.view.status).toEqual(['done']);
    expect(result.current.view.sort).toBe('created-desc');
    expect(result.current.view.group).toBe('week');
  });

  it('setTab preserves search and priority refinements', () => {
    const { result } = renderHook(() => useTasksViewState());
    act(() => {
      result.current.setSearch('hello');
      result.current.setPriority(['high']);
    });
    act(() => { result.current.setTab('upcoming'); });
    expect(result.current.view.search).toBe('hello');
    expect(result.current.view.priority).toEqual(['high']);
    // But the preset still took over status/sort/group:
    expect(result.current.view.sort).toBe('due-asc');
    expect(result.current.view.group).toBe('due');
  });

  it('setTab clears selection', () => {
    const { result } = renderHook(() => useTasksViewState());
    act(() => { result.current.select([1, 2, 3]); });
    expect(result.current.view.selection.size).toBe(3);
    act(() => { result.current.setTab('all'); });
    expect(result.current.view.selection.size).toBe(0);
  });

  it('cold load at #tasks/done applies done preset automatically', () => {
    window.location.hash = '#tasks/done';
    const { result } = renderHook(() => useTasksViewState());
    expect(result.current.view.tab).toBe('done');
    expect(result.current.view.status).toEqual(['done']);
    expect(result.current.view.group).toBe('week');
  });

  it('cold load with explicit sort in URL overrides preset sort', () => {
    window.location.hash = '#tasks/upcoming?sort=prio-desc';
    const { result } = renderHook(() => useTasksViewState());
    expect(result.current.view.tab).toBe('upcoming');
    expect(result.current.view.sort).toBe('prio-desc');
  });

  it('VALID_SORT now includes smart; decodeView accepts it', () => {
    expect(decodeView('#tasks?sort=smart').sort).toBe('smart');
  });

  it('VALID_GROUP now includes week; decodeView accepts it', () => {
    expect(decodeView('#tasks?group=week').group).toBe('week');
  });
});
