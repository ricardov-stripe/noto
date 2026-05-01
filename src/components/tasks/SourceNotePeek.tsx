import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Note, Task } from '../../api';

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function excerptAround(content: string, needle: string): ReactNode {
  const normalized = normalizeWs(content) || content.slice(0, 5000);
  const n = normalizeWs(needle);
  if (!n) {
    const take = normalized.slice(0, 240);
    return (
      <>
        {take}
        {normalized.length > 240 ? '…' : ''}
      </>
    );
  }
  const idx = normalized.indexOf(n);
  if (idx < 0) {
    const take = normalized.slice(0, 240);
    return (
      <>
        {take}
        {normalized.length > 240 ? '…' : ''}
      </>
    );
  }
  const start = Math.max(0, idx - 80);
  const end = Math.min(normalized.length, idx + n.length + 80);
  const before = normalized.slice(start, idx);
  const mid = normalized.slice(idx, idx + n.length);
  const after = normalized.slice(idx + n.length, end);
  return (
    <>
      {start > 0 ? '…' : ''}
      {before}
      <span className="peek-highlight">{mid}</span>
      {after}
      {end < normalized.length ? '…' : ''}
    </>
  );
}

function pillLabel(title: string): string {
  return title.length > 16 ? `${title.slice(0, 16)}…` : title;
}

export interface SourceNotePeekProps {
  task: Task;
  notes: Note[];
  onNavigateToNote: (noteId: number) => void;
}

export function SourceNotePeek({ task, notes, onNavigateToNote }: SourceNotePeekProps) {
  const [peekOpen, setPeekOpen] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearShowTimer = useCallback(() => {
    if (showTimer.current !== undefined) {
      clearTimeout(showTimer.current);
      showTimer.current = undefined;
    }
  }, []);

  const scheduleShow = useCallback(() => {
    clearShowTimer();
    showTimer.current = setTimeout(() => setPeekOpen(true), 300);
  }, [clearShowTimer]);

  const hidePeek = useCallback(() => {
    clearShowTimer();
    setPeekOpen(false);
  }, [clearShowTimer]);

  useEffect(() => () => clearShowTimer(), [clearShowTimer]);

  if (task.sourceNoteId == null) {
    return <span className="source-pill manual">manual</span>;
  }

  const note = notes.find((n) => n.id === task.sourceNoteId);
  if (!note) {
    return <span className="source-pill source-pill-orphan">note deleted</span>;
  }

  const label = pillLabel(note.title);
  const openNote = () => onNavigateToNote(note.id);

  return (
    <div
      className="source-peek-wrap"
      onMouseEnter={scheduleShow}
      onMouseLeave={hidePeek}
    >
      <button
        type="button"
        className="source-pill"
        aria-label={`Open note: ${note.title}`}
        onClick={openNote}
        onFocus={() => {
          clearShowTimer();
          setPeekOpen(true);
        }}
        onBlur={hidePeek}
      >
        {label}
      </button>
      {peekOpen && (
        <div
          className="source-peek-panel"
          role="tooltip"
          onMouseEnter={clearShowTimer}
          onMouseLeave={hidePeek}
        >
          <div className="source-peek-title">{note.title}</div>
          <div className="source-peek-excerpt">{excerptAround(note.content, task.sourceText)}</div>
        </div>
      )}
    </div>
  );
}
