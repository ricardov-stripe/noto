import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { Task, Note } from '../../api';
import { IconCheck } from '../Icons';
import { Popover } from './Popover';
import { DuePopover } from './DuePopover';
import { SourceNotePeek } from './SourceNotePeek';

/**
 * Card-shaped sibling of `TaskRow` for the Kanban board view. Same callback
 * contract as TaskRow so TasksView can wire either layout to the same
 * handlers without branching. Visual differences only:
 *   - Priority becomes a colored top-bar instead of an inline dot.
 *   - Title sits on its own line (multi-line allowed via wrap).
 *   - Due chip + source-note peek live on a meta row beneath the title.
 *   - Overflow menu is in the corner; checkbox slides in on hover.
 *
 * Drag handle wiring (useSortable) lives at the call site so this component
 * stays usable in tests without a DndContext.
 */

interface Props {
  task: Task;
  selected?: boolean;
  focused?: boolean;
  /** Optional drag-handle props from useSortable (attributes + listeners). */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  /** Optional ref-callback so a parent (useSortable.setNodeRef) can claim it. */
  setNodeRef?: (el: HTMLElement | null) => void;
  /** Inline style for drag transform. */
  style?: React.CSSProperties;
  /** True while this card is being dragged (lifted state). */
  isDragging?: boolean;

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
  notes: Note[];
}

const NEXT: Record<Task['status'], Task['status']> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};
const STATUS_LABEL: Record<Task['status'], string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const TaskCard = memo(function TaskCard({
  task,
  selected = false,
  focused = false,
  dragHandleProps,
  setNodeRef,
  style,
  isDragging = false,
  onUpdateStatus,
  onUpdateTask,
  onDeleteTask,
  onCreateTask,
  onNavigateToNote,
  notes,
}: Props) {
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const cardRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dueChipRef = useRef<HTMLButtonElement>(null);
  const descAreaRef = useRef<HTMLTextAreaElement>(null);
  const descSaveLock = useRef(false);

  const overdue =
    task.status !== 'done' &&
    task.dueDate != null &&
    new Date(task.dueDate).getTime() < startOfToday();

  const setRefs = useCallback(
    (el: HTMLElement | null) => {
      cardRef.current = el;
      setNodeRef?.(el);
    },
    [setNodeRef],
  );

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
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
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
      '- [' +
      (task.status === 'done' ? 'x' : ' ') +
      '] ' +
      task.title +
      (task.dueDate ? ' (due ' + task.dueDate.slice(0, 10) + ')' : '') +
      (task.sourceNoteId != null ? ' — from note ' + task.sourceNoteId : '');
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

  const cls = [
    'task-card',
    `task-card--prio-${task.priority}`,
    task.status === 'done' && 'task-card--done',
    overdue && 'task-card--overdue',
    selected && 'task-card--selected',
    focused && 'task-card--focused',
    isDragging && 'task-card--dragging',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      ref={setRefs}
      data-task-id={task.id}
      className={cls}
      role="article"
      aria-label={task.title}
      aria-selected={selected}
      style={style}
    >
      {/* Priority bar across the top of the card. The drag handle covers the
          card body but EXCLUDES interactive children (button, input, popover
          triggers handle their own pointerDown to stop propagation). */}
      <div className="task-card__pri" aria-hidden />

      <button
        type="button"
        className="task-card__check"
        title={`Mark ${STATUS_LABEL[task.status]} → ${STATUS_LABEL[NEXT[task.status]]}`}
        aria-label="Cycle status"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onUpdateStatus(task.id, NEXT[task.status]);
        }}
      >
        {task.status === 'done' && <IconCheck />}
      </button>

      <div className="task-card__body" {...(dragHandleProps ?? {})}>
        {editingTitle !== null ? (
          <input
            ref={inputRef}
            type="text"
            className="task-card__title task-card__title--input"
            value={editingTitle}
            aria-label="Edit task title"
            onPointerDown={(e) => e.stopPropagation()}
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
            className="task-card__title"
            tabIndex={-1}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              beginTitleEdit();
            }}
          >
            {task.title || <span className="task-card__title-empty">Untitled</span>}
          </div>
        )}

        <div className="task-card__meta">
          <Popover
            align="left"
            trigger={(open, toggle) => (
              <button
                type="button"
                className="prio-trigger task-card__prio-chip"
                aria-label="Set priority"
                aria-expanded={open}
                aria-haspopup="menu"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle();
                }}
              >
                <span className={`prio-dot prio-${task.priority}`} aria-hidden />
                <span className="task-card__prio-label">{task.priority}</span>
              </button>
            )}
          >
            {(close) => (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="popover-item"
                  onClick={() => {
                    void onUpdateTask(task.id, { priority: 'high' });
                    close();
                  }}
                >
                  High
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="popover-item"
                  onClick={() => {
                    void onUpdateTask(task.id, { priority: 'medium' });
                    close();
                  }}
                >
                  Medium
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="popover-item"
                  onClick={() => {
                    void onUpdateTask(task.id, { priority: 'low' });
                    close();
                  }}
                >
                  Low
                </button>
              </>
            )}
          </Popover>

          <DuePopover
            taskId={task.id}
            dueDate={task.dueDate}
            onUpdateTask={onUpdateTask}
            dueTriggerRef={dueChipRef}
          />

          <SourceNotePeek
            task={task}
            notes={notes}
            onNavigateToNote={onNavigateToNote}
          />

          <span className="task-card__spacer" aria-hidden />

          <Popover
            align="right"
            trigger={(open, toggle) => (
              <button
                type="button"
                className="row-overflow task-card__overflow"
                aria-label="Card actions"
                aria-expanded={open}
                aria-haspopup="menu"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle();
                }}
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
                  onClick={() => {
                    beginTitleEdit();
                    close();
                  }}
                >
                  Edit title
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="popover-item"
                  onClick={() => {
                    openDescEditor();
                    close();
                  }}
                >
                  Edit description
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="popover-item"
                  onClick={() => {
                    duplicateTask();
                    close();
                  }}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="popover-item"
                  onClick={() => {
                    copyMarkdown();
                    close();
                  }}
                >
                  Copy as markdown
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="popover-item"
                  onClick={() => {
                    deleteTask();
                    close();
                  }}
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
            className="task-card__desc-input"
            aria-label="Task description"
            value={descDraft}
            onPointerDown={(e) => e.stopPropagation()}
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
    </article>
  );
});
