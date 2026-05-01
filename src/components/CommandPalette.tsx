import { useEffect, useMemo, useRef, useState } from 'react';
import type { Note, Task } from '../api';
import type { View } from './Sidebar';

interface CommandPaletteProps {
  open: boolean;
  notes: Note[];
  tasks: Task[];
  onClose: () => void;
  onOpenNote: (id: number) => void;
  onSelectView: (view: View) => void;
  onCreateNote: () => void;
}

type Result =
  | { kind: 'note'; id: number; title: string; snippet: string }
  | { kind: 'task'; id: number; title: string; status: Task['status']; sourceNoteId: number | null }
  | { kind: 'view'; view: View; label: string }
  | { kind: 'action'; id: 'new-note'; label: string; hint: string };

const MAX_RESULTS = 12;

/**
 * Universal search palette (⌘K). Filters notes by title/content and tasks
 * by title; also surfaces view shortcuts and the "New note" action.
 *
 * Keyboard model:
 *   ⌘K        toggle (handled in App)
 *   ↑ / ↓     move highlight
 *   Enter     activate highlighted
 *   Esc       close
 *
 * No fuzzy matching library — substring + case-insensitive is the right
 * starting point for ~hundreds of notes; switch to fuse.js if it gets slow.
 */
export function CommandPalette({
  open,
  notes,
  tasks,
  onClose,
  onOpenNote,
  onSelectView,
  onCreateNote,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Reset query/highlight every time the palette opens; focus the input.
  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(0);
      // Defer focus until after the modal mounts.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();

    const viewShortcuts: Result[] = [
      { kind: 'view', view: 'notes', label: 'Go to Notes' },
      { kind: 'view', view: 'tasks', label: 'Go to Tasks' },
      { kind: 'view', view: 'schedule', label: 'Go to Schedule' },
    ];
    const actions: Result[] = [
      { kind: 'action', id: 'new-note', label: 'New note', hint: '⌘N' },
    ];

    if (!q) {
      const recent = [...notes]
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
        .slice(0, 6)
        .map<Result>((n) => ({
          kind: 'note',
          id: n.id,
          title: n.title || 'Untitled',
          snippet: stripHtml(n.content).slice(0, 80),
        }));
      return [...actions, ...viewShortcuts, ...recent].slice(0, MAX_RESULTS);
    }

    const noteHits: Result[] = notes
      .filter((n) => {
        const hay = `${n.title} ${stripHtml(n.content)}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8)
      .map((n) => ({
        kind: 'note',
        id: n.id,
        title: n.title || 'Untitled',
        snippet: snippetAround(stripHtml(n.content), q, 80),
      }));

    const taskHits: Result[] = tasks
      .filter((t) => t.title.toLowerCase().includes(q))
      .slice(0, 6)
      .map((t) => ({
        kind: 'task',
        id: t.id,
        title: t.title,
        status: t.status,
        sourceNoteId: t.sourceNoteId,
      }));

    const viewHits = viewShortcuts.filter((v) => v.kind === 'view' && v.label.toLowerCase().includes(q));
    const actionHits = actions.filter((a) => a.kind === 'action' && a.label.toLowerCase().includes(q));

    return [...noteHits, ...taskHits, ...viewHits, ...actionHits].slice(0, MAX_RESULTS);
  }, [query, notes, tasks]);

  // Keep highlight inside the result range when results change.
  useEffect(() => {
    setHighlight((h) => (results.length === 0 ? 0 : Math.min(h, results.length - 1)));
  }, [results.length]);

  // Scroll highlighted into view as user arrows. Guard for jsdom where
  // scrollIntoView is not implemented.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-idx="${highlight}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlight]);

  const activate = (r: Result) => {
    onClose();
    if (r.kind === 'note') onOpenNote(r.id);
    else if (r.kind === 'task') {
      onSelectView('tasks');
    } else if (r.kind === 'view') onSelectView(r.view);
    else if (r.kind === 'action' && r.id === 'new-note') onCreateNote();
  };

  if (!open) return null;

  return (
    <div
      className="palette-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          type="text"
          placeholder="Search notes, tasks, or jump to…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight((h) => (results.length === 0 ? 0 : (h + 1) % results.length));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => (results.length === 0 ? 0 : (h - 1 + results.length) % results.length));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const picked = results[highlight];
              if (picked) activate(picked);
            }
          }}
        />

        <div className="palette-list" ref={listRef} role="listbox">
          {results.length === 0 && (
            <div className="palette-empty">No matches.</div>
          )}
          {results.map((r, i) => (
            <ResultRow
              key={resultKey(r, i)}
              r={r}
              active={i === highlight}
              idx={i}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => activate(r)}
            />
          ))}
        </div>

        <div className="palette-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

interface ResultRowProps {
  r: Result;
  active: boolean;
  idx: number;
  onClick: () => void;
  onMouseEnter: () => void;
}

function ResultRow({ r, active, idx, onClick, onMouseEnter }: ResultRowProps) {
  return (
    <button
      type="button"
      data-idx={idx}
      className={`palette-row ${r.kind}${active ? ' active' : ''}`}
      role="option"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <span className="kind-tag">{kindTag(r)}</span>
      <span className="row-body">
        <span className="row-title">{rowTitle(r)}</span>
        {rowDetail(r) && <span className="row-detail">{rowDetail(r)}</span>}
      </span>
      {rowHint(r) && <span className="row-hint">{rowHint(r)}</span>}
    </button>
  );
}

function kindTag(r: Result): string {
  if (r.kind === 'note') return 'NOTE';
  if (r.kind === 'task') return 'TASK';
  if (r.kind === 'view') return 'GO';
  return 'DO';
}

function rowTitle(r: Result): string {
  if (r.kind === 'note') return r.title;
  if (r.kind === 'task') return r.title;
  if (r.kind === 'view') return r.label;
  return r.label;
}

function rowDetail(r: Result): string | null {
  if (r.kind === 'note') return r.snippet || null;
  if (r.kind === 'task') return r.status === 'done' ? 'Done' : r.status === 'in_progress' ? 'In progress' : 'To do';
  return null;
}

function rowHint(r: Result): string | null {
  if (r.kind === 'action') return r.hint;
  return null;
}

function resultKey(r: Result, i: number): string {
  if (r.kind === 'note') return `note-${r.id}`;
  if (r.kind === 'task') return `task-${r.id}`;
  if (r.kind === 'view') return `view-${r.view}`;
  return `${r.kind}-${i}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function snippetAround(text: string, query: string, len: number): string {
  if (!text) return '';
  const i = text.toLowerCase().indexOf(query);
  if (i < 0) return text.slice(0, len);
  const start = Math.max(0, i - 20);
  const end = Math.min(text.length, start + len);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}
