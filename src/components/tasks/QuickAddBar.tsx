import { useMemo, useState, type KeyboardEvent } from 'react';
import { parseQuickAdd, type NoteRef } from './parseQuickAdd';
import type { Task } from '../../api';

interface Props {
  notes: NoteRef[];
  onCreate: (data: { title: string; priority: Task['priority']; dueDate: string | null; sourceNoteId: number | null }) => Promise<Task | null>;
  onArrowDown?: () => void;
}

function fmtDue(due: string | null): string {
  if (!due) return '—';
  const d = new Date(due);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

export function QuickAddBar({ notes, onCreate, onArrowDown }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const parsed = useMemo(() => parseQuickAdd(value, notes), [value, notes]);

  const submit = async (literal: boolean) => {
    setError(null);
    const data = literal
      ? { title: value.trim(), priority: 'medium' as Task['priority'], dueDate: null as string | null, sourceNoteId: null as number | null }
      : parsed;
    if (!data || !data.title) return;
    const prevValue = value;
    setValue('');
    try {
      const result = await onCreate(data);
      if (!result) throw new Error('create returned null');
    } catch {
      setValue(prevValue);
      setError("Couldn't add task. Try again.");
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(true); return; }
    if (e.key === 'Enter') { e.preventDefault(); void submit(false); return; }
    if (e.key === 'Escape') { setValue(''); return; }
    if (e.key === 'ArrowDown' && onArrowDown) { e.preventDefault(); onArrowDown(); }
  };

  const showGhost = parsed !== null && value.trim().length > 0;

  return (
    <div className="quick-add">
      <input
        id="quick-add-input"
        className="quick-add-input"
        placeholder='+ Add task… (try "Send Q2 report Fri !high")'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        aria-label="Add task"
      />
      {showGhost && parsed && (
        <div className="quick-add-ghost" aria-live="polite">
          → "{parsed.title}"  ●{parsed.priority} · {fmtDue(parsed.dueDate)}{parsed.sourceNoteId != null ? ` · note ${parsed.sourceNoteId}` : ''}
        </div>
      )}
      {error && <div className="quick-add-error" role="alert">{error}</div>}
    </div>
  );
}
