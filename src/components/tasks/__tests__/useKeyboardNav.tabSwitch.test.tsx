/**
 * Covers only the g+<letter> two-stroke tab-switch shortcut added in
 * Task 2.6. The rest of useKeyboardNav is exercised via TasksView
 * integration at the app level.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { KeyboardEvent } from 'react';
import { useKeyboardNav, type NavOptions } from '../useKeyboardNav';

function makeOpts(overrides: Partial<NavOptions> = {}): NavOptions {
  return {
    tasks: [],
    groups: [],
    collapsed: {},
    selection: new Set<number>(),
    onUpdateStatus: vi.fn(),
    onUpdateTask: vi.fn(async () => undefined),
    onDeleteTask: vi.fn(async () => undefined),
    onCreateTask: vi.fn(async () => null),
    onNavigateToNote: vi.fn(),
    onSelect: vi.fn(),
    onClearSelection: vi.fn(),
    onToggleCollapsed: vi.fn(),
    onShowCheatsheet: vi.fn(),
    ...overrides,
  };
}

function makeEvent(key: string): KeyboardEvent {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    target: document.createElement('div'),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('useKeyboardNav — g+<letter> tab switch', () => {
  it('fires onTabSwitch("new") on g then n', () => {
    const onTabSwitch = vi.fn();
    const { result } = renderHook(() => useKeyboardNav(makeOpts({ onTabSwitch })));
    act(() => { result.current.handleKeyDown(makeEvent('g')); });
    act(() => { result.current.handleKeyDown(makeEvent('n')); });
    expect(onTabSwitch).toHaveBeenCalledWith('new');
  });

  it('fires onTabSwitch("today") on g then t', () => {
    const onTabSwitch = vi.fn();
    const { result } = renderHook(() => useKeyboardNav(makeOpts({ onTabSwitch })));
    act(() => { result.current.handleKeyDown(makeEvent('g')); });
    act(() => { result.current.handleKeyDown(makeEvent('t')); });
    expect(onTabSwitch).toHaveBeenCalledWith('today');
  });

  it('maps u/a/d to upcoming/all/done', () => {
    const onTabSwitch = vi.fn();
    const { result } = renderHook(() => useKeyboardNav(makeOpts({ onTabSwitch })));
    act(() => { result.current.handleKeyDown(makeEvent('g')); });
    act(() => { result.current.handleKeyDown(makeEvent('u')); });
    act(() => { result.current.handleKeyDown(makeEvent('g')); });
    act(() => { result.current.handleKeyDown(makeEvent('a')); });
    act(() => { result.current.handleKeyDown(makeEvent('g')); });
    act(() => { result.current.handleKeyDown(makeEvent('d')); });
    expect(onTabSwitch).toHaveBeenNthCalledWith(1, 'upcoming');
    expect(onTabSwitch).toHaveBeenNthCalledWith(2, 'all');
    expect(onTabSwitch).toHaveBeenNthCalledWith(3, 'done');
  });

  it('pressing just t (no g prime) does NOT switch tab', () => {
    const onTabSwitch = vi.fn();
    const { result } = renderHook(() => useKeyboardNav(makeOpts({ onTabSwitch })));
    act(() => { result.current.handleKeyDown(makeEvent('t')); });
    expect(onTabSwitch).not.toHaveBeenCalled();
  });

  it('g followed by non-tab letter clears the prime without firing', () => {
    const onTabSwitch = vi.fn();
    const { result } = renderHook(() => useKeyboardNav(makeOpts({ onTabSwitch })));
    act(() => { result.current.handleKeyDown(makeEvent('g')); });
    act(() => { result.current.handleKeyDown(makeEvent('q')); });
    expect(onTabSwitch).not.toHaveBeenCalled();
  });

  it('does nothing when onTabSwitch is not provided (no crash)', () => {
    const { result } = renderHook(() => useKeyboardNav(makeOpts({ onTabSwitch: undefined })));
    expect(() => {
      act(() => { result.current.handleKeyDown(makeEvent('g')); });
      act(() => { result.current.handleKeyDown(makeEvent('t')); });
    }).not.toThrow();
  });
});
