import type { ReactNode } from 'react';
import type { Note, Task } from '../../api';

export interface NewTabBodyProps {
  tasks: Task[];
  notes: Note[];
  onTriageAllToToday: () => void;
  onDismissAllToLater: () => void;
  children: ReactNode;
}

/**
 * Structural wrapper for the NEW tab body.
 *
 * - Shows the "N UNTRIAGED ... last extracted X min ago from <note>" meta line.
 * - Renders the list content (passed as children so TasksView keeps the same
 *   TaskRow wiring we use everywhere else).
 * - Shows two bulk-triage CTAs in the footer.
 * - Shows an "Inbox zero." empty state when there are no untriaged tasks.
 */
export function NewTabBody({
  tasks,
  notes,
  onTriageAllToToday,
  onDismissAllToLater,
  children,
}: NewTabBodyProps) {
  if (tasks.length === 0) {
    return (
      <div className="new-tab__empty" role="status" aria-label="Inbox zero">
        <div className="new-tab__empty-hero">Inbox zero.</div>
        <div className="new-tab__empty-sub">Nice.</div>
      </div>
    );
  }

  const extractedMeta = findMostRecentExtractedMeta(tasks, notes);

  return (
    <section className="new-tab" aria-label="Untriaged tasks">
      <header className="new-tab__meta">
        <span className="new-tab__count">
          {tasks.length} UNTRIAGED
        </span>
        {extractedMeta && (
          <span className="new-tab__extracted">
            last extracted {extractedMeta.relative} FROM{' '}
            <span className="new-tab__extracted-note">{extractedMeta.noteTitle}</span>
          </span>
        )}
      </header>
      <div className="new-tab__list">{children}</div>
      <footer className="new-tab__actions">
        <button
          type="button"
          className="new-tab__action"
          onClick={onTriageAllToToday}
        >
          Triage all <span aria-hidden="true">→</span> Today
        </button>
        <button
          type="button"
          className="new-tab__action"
          onClick={onDismissAllToLater}
        >
          Dismiss all <span aria-hidden="true">→</span> Later
        </button>
      </footer>
    </section>
  );
}

function findMostRecentExtractedMeta(
  tasks: Task[],
  notes: Note[],
): { relative: string; noteTitle: string } | null {
  const withNote = tasks.filter((t) => t.sourceNoteId != null);
  if (withNote.length === 0) return null;
  const newest = withNote.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
  const note = notes.find((n) => n.id === newest.sourceNoteId);
  return {
    relative: relativeTime(newest.createdAt),
    noteTitle: note?.title?.trim() || 'untitled note',
  };
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.round(diffMs / 60_000);
  if (m < 1) return 'JUST NOW';
  if (m < 60) return `${m} MIN AGO`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}H AGO`;
  const d = Math.round(h / 24);
  return `${d}D AGO`;
}
