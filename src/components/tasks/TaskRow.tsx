import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { Task, Note } from '../../api';
import { IconCheck } from '../Icons';
import { Popover } from './Popover';
import { DuePopover } from './DuePopover';
import { SourceNotePeek } from './SourceNotePeek';

interface Props {
  task: Task;
  selected: boolean;
  focused: boolean;
  /** Shift/cmd/click selection on row chrome (see handler in TasksView). */
  onRowMouseDown?: (e: React.MouseEvent, taskId: number) => void;
  editTitleTrigger?: number | null;
  onConsumeTitleTrigger?: () => void;
  editDescTrigger?: number | null;
  onConsumeDescTrigger?: () => void;
  onUpdateStatus: (id: number, status: Task['status']) => void;
  onNavigateToNote: (noteId: number) => void;
  onUpdateTask: (
    id: number,
    patch: Partial<Pick<Task, 'title' | 'priority' | 'dueDate' | 'description'>>,
  ) => Promise<void>;
  notes: Note[];
  onCreateTask: (data: { title: string; priority: Task['priority']; dueDate: string | null; sourceNoteId: number | null }) => Promise<Task | null>;
  onDeleteTask: (id: number) => Promise<void>;
}

const NEXT: Record<Task['status'], Task['status']> = {
  todo: 'in_progress', in_progress: 'done', done: 'todo',
};
const STATUS_LABEL: Record<Task['status'], string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };

function startOfToday(): number { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }

export const TaskRow = memo(function TaskRow({
  task,
  selected,
  focused,
  onRowMouseDown,
  editTitleTrigger,
  onConsumeTitleTrigger,
  editDescTrigger,
  onConsumeDescTrigger,
  onUpdateStatus,
  onNavigateToNote,
  onUpdateTask,
  notes,
  onCreateTask,
  onDeleteTask,
}: Props) {
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const rowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dueChipRef = useRef<HTMLButtonElement>(null);
  const descAreaRef = useRef<HTMLTextAreaElement>(null);
  const descSaveLock = useRef(false);

  const overdue = task.status !== 'done' && task.dueDate && new Date(task.dueDate).getTime() < startOfToday();

  const beginTitleEdit = useCallback(() => {
    setEditingTitle(task.title);
  }, [task.title]);

  useEffect(() => {
    if (editingTitle === null) return;
    const input = inputRef.current;
    if (input) {
      input.focus();
      input.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    if (editingTitle === null) return;
    const onDocDown = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        const trimmed = (inputRef.current?.value ?? editingTitle).trim();
        setEditingTitle(null);
        if (trimmed === '' || trimmed === task.title) return;
        void onUpdateTask(task.id, { title: trimmed });
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [editingTitle, onUpdateTask, task.id, task.title]);

  useEffect(() => {
    if (!descExpanded) return;
    descAreaRef.current?.focus();
  }, [descExpanded]);

  const openDescEditor = useCallback(() => {
    setDescDraft(task.description);
    setDescExpanded(true);
  }, [task.description]);

  useEffect(() => {
    if (editTitleTrigger !== task.id) return;
    beginTitleEdit();
    onConsumeTitleTrigger?.();
  }, [editTitleTrigger, task.id, beginTitleEdit, onConsumeTitleTrigger]);

  useEffect(() => {
    if (editDescTrigger !== task.id) return;
    openDescEditor();
    onConsumeDescTrigger?.();
  }, [editDescTrigger, task.id, openDescEditor, onConsumeDescTrigger]);

  const saveDescription = useCallback(() => {
    if (descSaveLock.current) return;
    descSaveLock.current = true;
    if (descDraft !== task.description) {
      void onUpdateTask(task.id, { description: descDraft });
    }
    setDescExpanded(false);
    window.setTimeout(() => {
      descSaveLock.current = false;
    }, 0);
  }, [descDraft, onUpdateTask, task.description, task.id]);

  const cancelDescription = useCallback(() => {
    setDescDraft(task.description);
    setDescExpanded(false);
  }, [task.description]);

  const copyMarkdown = useCallback(() => {
    const line =
      '- [' + (task.status === 'done' ? 'x' : ' ') + '] ' + task.title
      + (task.dueDate ? ' (due ' + task.dueDate.slice(0, 10) + ')' : '')
      + (task.sourceNoteId != null ? ' — from note ' + task.sourceNoteId : '');
    void navigator.clipboard.writeText(line);
  }, [task]);

  const duplicateTask = useCallback(() => {
    void onCreateTask({
      title: task.title,
      priority: task.priority,
      dueDate: task.dueDate,
      sourceNoteId: task.sourceNoteId,
    });
  }, [onCreateTask, task]);

  const deleteTask = useCallback(() => {
    void onDeleteTask(task.id);
  }, [onDeleteTask, task.id]);

  return (
    <div
      className="task-row-block"
      role="listitem"
      aria-selected={selected}
    >
      <div
        ref={rowRef}
        data-task-id={task.id}
        className={`task-row${task.status === 'done' ? ' done' : ''}${overdue ? ' overdue' : ''}${selected ? ' selected' : ''}${focused ? ' focused' : ''}`}
        onMouseDown={(e) => onRowMouseDown?.(e, task.id)}
      >
      <button
        type="button"
        className="task-checkbox"
        title={`Mark ${STATUS_LABEL[task.status]} → ${STATUS_LABEL[NEXT[task.status]]}`}
        aria-label="Cycle status"
        onClick={() => onUpdateStatus(task.id, NEXT[task.status])}
      >
        {task.status === 'done' && <IconCheck />}
      </button>

      <Popover
        align="left"
        trigger={(open, toggle) => (
          <button
            type="button"
            className="prio-trigger"
            aria-label="Set priority"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={(e) => { e.stopPropagation(); toggle(); }}
          >
            <span className={`prio-dot prio-${task.priority}`} aria-hidden />
          </button>
        )}
      >
        {(close) => (
          <>
            <button
              type="button"
              role="menuitem"
              className="popover-item"
              onClick={() => { void onUpdateTask(task.id, { priority: 'high' }); close(); }}
            >
              High
            </button>
            <button
              type="button"
              role="menuitem"
              className="popover-item"
              onClick={() => { void onUpdateTask(task.id, { priority: 'medium' }); close(); }}
            >
              Medium
            </button>
            <button
              type="button"
              role="menuitem"
              className="popover-item"
              onClick={() => { void onUpdateTask(task.id, { priority: 'low' }); close(); }}
            >
              Low
            </button>
            <button
              type="button"
              role="menuitem"
              className="popover-item"
              onClick={() => { void onUpdateTask(task.id, { priority: 'medium' }); close(); }}
            >
              —
            </button>
          </>
        )}
      </Popover>

      {editingTitle !== null ? (
        <input
          ref={inputRef}
          type="text"
          className="task-title task-title-input"
          value={editingTitle}
          aria-label="Edit task title"
          onChange={(e) => setEditingTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const trimmed = editingTitle.trim();
              setEditingTitle(null);
              if (trimmed === '' || trimmed === task.title) return;
              void onUpdateTask(task.id, { title: trimmed });
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setEditingTitle(null);
            } else if (e.key === 'Tab') {
              e.preventDefault();
              const trimmed = editingTitle.trim();
              setEditingTitle(null);
              if (trimmed !== '' && trimmed !== task.title) {
                void onUpdateTask(task.id, { title: trimmed });
              }
              queueMicrotask(() => dueChipRef.current?.focus());
            }
          }}
        />
      ) : (
        <div
          className="task-title"
          tabIndex={-1}
          onDoubleClick={(e) => {
            e.preventDefault();
            beginTitleEdit();
          }}
        >
          {task.title}
        </div>
      )}

      <DuePopover taskId={task.id} dueDate={task.dueDate} onUpdateTask={onUpdateTask} dueTriggerRef={dueChipRef} />

      <SourceNotePeek task={task} notes={notes} onNavigateToNote={onNavigateToNote} />

      <Popover
        align="right"
        trigger={(open, toggle) => (
          <button
            type="button"
            className="row-overflow"
            aria-label="Row actions"
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={(e) => { e.stopPropagation(); toggle(); }}
          >
            ⋯
          </button>
        )}
      >
        {(close) => (
          <>
            <button
              type="button"
              role="menuitem"
              className="popover-item"
              onClick={() => { openDescEditor(); close(); }}
            >
              Edit description
            </button>
            <button
              type="button"
              role="menuitem"
              className="popover-item"
              onClick={() => { duplicateTask(); close(); }}
            >
              Duplicate
            </button>
            <button
              type="button"
              role="menuitem"
              className="popover-item"
              onClick={() => { copyMarkdown(); close(); }}
            >
              Copy as markdown
            </button>
            <button
              type="button"
              role="menuitem"
              className="popover-item"
              onClick={() => { deleteTask(); close(); }}
            >
              Delete
            </button>
          </>
        )}
      </Popover>

    </div>

      {descExpanded && (
        <textarea
          ref={descAreaRef}
          className="task-desc-input"
          aria-label="Task description"
          value={descDraft}
          onChange={(e) => setDescDraft(e.target.value)}
          onBlur={saveDescription}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelDescription();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              saveDescription();
            }
          }}
        />
      )}
    </div>
  );
});
