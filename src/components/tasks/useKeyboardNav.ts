import { useCallback, useState, type KeyboardEvent } from 'react';
import type { Task } from '../../api';
import type { Group } from './taskFilters';

export type FocusTarget =
  | { kind: 'row'; id: number }
  | { kind: 'group'; key: string }
  | null;

function startOfTodayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIso(d: Date): string {
  return d.toISOString();
}

function dueTodayIso(): string {
  return toIso(startOfTodayDate());
}

function dueTomorrowIso(): string {
  const d = startOfTodayDate();
  d.setDate(d.getDate() + 1);
  return toIso(d);
}

function thisWeekendIso(): string {
  const d = startOfTodayDate();
  const day = d.getDay();
  if (day === 6) {
    d.setDate(d.getDate() + 1);
    return toIso(d);
  }
  let untilSat = (6 - day + 7) % 7;
  if (untilSat === 0) untilSat = 7;
  d.setDate(d.getDate() + untilSat);
  return toIso(d);
}

function nextWeekIso(): string {
  const d = startOfTodayDate();
  d.setDate(d.getDate() + 7);
  return toIso(d);
}

export function visibleRowIds(groups: Group[], collapsed: Record<string, boolean>): number[] {
  const ids: number[] = [];
  for (const g of groups) {
    if (collapsed[g.key]) continue;
    for (const t of g.tasks) ids.push(t.id);
  }
  return ids;
}

function actionTargets(selection: Set<number>, focusedRowId: number | null): number[] {
  if (selection.size > 0) return [...selection];
  if (focusedRowId != null) return [focusedRowId];
  return [];
}

const NEXT: Record<Task['status'], Task['status']> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

export interface NavOptions {
  tasks: Task[];
  groups: Group[];
  collapsed: Record<string, boolean>;
  selection: Set<number>;
  onUpdateStatus: (id: number, status: Task['status']) => void;
  onUpdateTask: (
    id: number,
    patch: Partial<Pick<Task, 'title' | 'priority' | 'dueDate' | 'description'>>,
  ) => Promise<void>;
  onDeleteTask: (id: number) => Promise<void>;
  onCreateTask: (data: {
    title: string;
    priority: Task['priority'];
    dueDate: string | null;
    sourceNoteId: number | null;
  }) => Promise<Task | null>;
  onNavigateToNote: (noteId: number) => void;
  onSelect: (ids: number[], mode: 'replace' | 'add' | 'toggle') => void;
  onClearSelection: () => void;
  onToggleCollapsed: (key: string) => void;
  onShowCheatsheet: () => void;
  onStartEditTitle?: (id: number) => void;
  onStartEditDesc?: (id: number) => void;
}

export function useKeyboardNav(opts: NavOptions): {
  focus: FocusTarget;
  focusedId: number | null;
  focusedGroupKey: string | null;
  setFocusedId: (id: number | null) => void;
  handleKeyDown: (e: KeyboardEvent) => void;
} {
  const [focus, setFocus] = useState<FocusTarget>(null);

  const focusedRowId = focus?.kind === 'row' ? focus.id : null;
  const focusedGroupKey = focus?.kind === 'group' ? focus.key : null;

  const setFocusedId = useCallback((id: number | null) => {
    setFocus(id == null ? null : { kind: 'row', id });
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const raw = e.target as unknown;
      const t = raw instanceof HTMLElement ? raw : null;
      if (t?.matches?.('input, textarea, [contenteditable]')) return;

      const rows = visibleRowIds(opts.groups, opts.collapsed);
      const taskById = (id: number) => opts.tasks.find((x) => x.id === id);

      const moveRow = (delta: number) => {
        if (rows.length === 0) return;
        if (focusedRowId == null) {
          setFocus({ kind: 'row', id: rows[delta > 0 ? 0 : rows.length - 1] });
          return;
        }
        const i = rows.indexOf(focusedRowId);
        if (i < 0) {
          setFocus({ kind: 'row', id: rows[delta > 0 ? 0 : rows.length - 1] });
          return;
        }
        const ni = i + delta;
        if (ni < 0 || ni >= rows.length) return;
        setFocus({ kind: 'row', id: rows[ni] });
      };

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (rows.length) opts.onSelect(rows, 'replace');
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        opts.onShowCheatsheet();
        return;
      }

      if (e.key === 'Escape') {
        if (opts.selection.size > 0) {
          e.preventDefault();
          opts.onClearSelection();
        }
        return;
      }

      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        document.getElementById('tasks-search')?.focus();
        return;
      }

      if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        document.getElementById('quick-add-input')?.focus();
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') moveRow(1);
      else if (e.key === 'k' || e.key === 'ArrowUp') moveRow(-1);
      else if (e.key === 'Home' && rows.length) setFocus({ kind: 'row', id: rows[0] });
      else if (e.key === 'End' && rows.length) setFocus({ kind: 'row', id: rows[rows.length - 1] });
      else if (e.key === 'J') {
        const keys = opts.groups.map((g) => g.key);
        const cur = focusedGroupKey ?? opts.groups[0]?.key;
        const idx = cur ? keys.indexOf(cur) : -1;
        const next = idx >= 0 ? keys[Math.min(keys.length - 1, idx + 1)] : keys[0];
        if (next) setFocus({ kind: 'group', key: next });
      } else if (e.key === 'K') {
        const keys = opts.groups.map((g) => g.key);
        const cur = focusedGroupKey ?? opts.groups[opts.groups.length - 1]?.key;
        const idx = cur ? keys.indexOf(cur) : keys.length;
        const prev = idx > 0 ? keys[idx - 1] : keys[0];
        if (prev) setFocus({ kind: 'group', key: prev });
      }

      const rowFocusId = focusedRowId;

      if (e.key === 'x' && rowFocusId != null) {
        e.preventDefault();
        opts.onSelect([rowFocusId], 'toggle');
        return;
      }

      if (e.key === ' ' && !e.shiftKey) {
        if (focusedGroupKey != null) {
          e.preventDefault();
          opts.onToggleCollapsed(focusedGroupKey);
          return;
        }
        if (rowFocusId != null) {
          const targets = actionTargets(opts.selection, rowFocusId);
          if (targets.length > 0) {
            e.preventDefault();
            for (const id of targets) {
              const task = taskById(id);
              if (task) opts.onUpdateStatus(id, NEXT[task.status]);
            }
          }
        }
        return;
      }

      if ((e.key === 'Backspace' || e.key === 'Delete') && rowFocusId != null) {
        const targets = actionTargets(opts.selection, rowFocusId);
        if (targets.length > 0) {
          e.preventDefault();
          for (const id of targets) void opts.onDeleteTask(id);
        }
        return;
      }

      const digitPriority = (() => {
        if (e.key === '1') return 'high' as const;
        if (e.key === '2') return 'medium' as const;
        if (e.key === '3') return 'low' as const;
        if (e.key === '0') return 'medium' as const;
        return null;
      })();
      if (digitPriority && rowFocusId != null) {
        const targets = actionTargets(opts.selection, rowFocusId);
        if (targets.length > 0) {
          e.preventDefault();
          for (const id of targets) void opts.onUpdateTask(id, { priority: digitPriority });
        }
        return;
      }

      if (rowFocusId != null) {
        const targets = actionTargets(opts.selection, rowFocusId);

        const applyDue = (iso: string | null) => {
          if (targets.length === 0) return;
          e.preventDefault();
          for (const id of targets) void opts.onUpdateTask(id, { dueDate: iso });
        };
        if (e.key === 't' && !e.metaKey && !e.ctrlKey) applyDue(dueTodayIso());
        else if (e.key === 'T') applyDue(dueTomorrowIso());
        else if (e.key === 'w') applyDue(thisWeekendIso());
        else if (e.key === 'n') applyDue(nextWeekIso());
        else if (e.key === 'r') applyDue(null);
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && rowFocusId != null) {
        const task = taskById(rowFocusId);
        if (task) {
          e.preventDefault();
          void opts.onCreateTask({
            title: task.title,
            priority: task.priority,
            dueDate: task.dueDate,
            sourceNoteId: task.sourceNoteId,
          });
        }
        return;
      }

      if (e.key === 'o' && rowFocusId != null) {
        const task = taskById(rowFocusId);
        if (task?.sourceNoteId != null) {
          e.preventDefault();
          opts.onNavigateToNote(task.sourceNoteId);
        }
        return;
      }

      if (e.key === 'Enter' && rowFocusId != null) {
        e.preventDefault();
        opts.onStartEditTitle?.(rowFocusId);
        return;
      }

      if (e.key === 'e' && rowFocusId != null) {
        e.preventDefault();
        opts.onStartEditDesc?.(rowFocusId);
        return;
      }
    },
    [focus, focusedRowId, focusedGroupKey, opts],
  );

  return {
    focus,
    focusedId: focusedRowId,
    focusedGroupKey,
    setFocusedId,
    handleKeyDown,
  };
}
