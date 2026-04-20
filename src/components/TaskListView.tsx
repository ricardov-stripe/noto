import type { Task } from '../api';
import { IconCheck } from './Icons';

interface TaskListViewProps {
  tasks: Task[];
  onUpdateStatus: (id: number, status: Task['status']) => void;
  onNavigateToNote: (noteId: number) => void;
}

const STATUS_LABELS: Record<Task['status'], string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};
const STATUS_ORDER: Task['status'][] = ['todo', 'in_progress', 'done'];
const PRIORITY_CLASS: Record<Task['priority'], 'high' | 'med' | 'low'> = {
  high: 'high',
  medium: 'med',
  low: 'low',
};

/**
 * Tasks view: three groups (To Do / In Progress / Done), each row a single
 * line with checkbox, title, optional due-date, and a quiet link back to
 * the source note. Clicking the checkbox cycles status forward (todo →
 * in_progress → done → todo).
 */
export function TaskListView({ tasks, onUpdateStatus, onNavigateToNote }: TaskListViewProps) {
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    items: tasks.filter((t) => t.status === status),
  }));

  return (
    <section className="view" aria-label="Tasks">
      <div className="view-head">
        <h1 className="view-title">Tasks</h1>
        <div className="view-meta">
          {tasks.filter((t) => t.status !== 'done').length} OPEN · {tasks.filter((t) => t.status === 'done').length} DONE
        </div>
      </div>

      <div className="view-body">
        {tasks.length === 0 && (
          <div className="empty-section">
            No tasks yet. Write a note with action items and they'll show up here.
          </div>
        )}
        {grouped.map((group) => (
          <div className="task-group" key={group.status}>
            <div className="group-label">
              <span>{group.label}</span>
              <span className="group-count">{group.items.length}</span>
            </div>
            {group.items.length === 0 && (
              <div className="empty-section" style={{ padding: '4px 0', fontSize: 11 }}>
                Empty
              </div>
            )}
            {group.items.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onUpdateStatus={onUpdateStatus}
                onNavigateToNote={onNavigateToNote}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

interface TaskRowProps {
  task: Task;
  onUpdateStatus: (id: number, status: Task['status']) => void;
  onNavigateToNote: (noteId: number) => void;
}

function TaskRow({ task, onUpdateStatus, onNavigateToNote }: TaskRowProps) {
  const isOverdue =
    task.status !== 'done' &&
    task.dueDate != null &&
    new Date(task.dueDate).getTime() < startOfToday();

  const cycle = () => {
    const next: Record<Task['status'], Task['status']> = {
      todo: 'in_progress',
      in_progress: 'done',
      done: 'todo',
    };
    onUpdateStatus(task.id, next[task.status]);
  };

  return (
    <div className={`task-row${task.status === 'done' ? ' done' : ''}${isOverdue ? ' overdue' : ''}`}>
      <button
        type="button"
        className="task-checkbox"
        title={`Mark ${STATUS_LABELS[task.status]} → ${STATUS_LABELS[nextStatus(task.status)]}`}
        aria-label="Cycle status"
        onClick={cycle}
      >
        {task.status === 'done' && <IconCheck />}
      </button>

      <div className="task-title">
        {task.title}
        {task.sourceText && <span className="source">"{task.sourceText}"</span>}
      </div>

      <div style={{ display: 'flex', gap: 'var(--s-sm)', alignItems: 'center' }}>
        <span className={`priority-pill ${PRIORITY_CLASS[task.priority]}`}>
          {task.priority}
        </span>
        {task.dueDate && <span className="task-due">{formatDueDate(task.dueDate)}</span>}
      </div>

      <button
        type="button"
        className="task-source-link"
        onClick={() => onNavigateToNote(task.sourceNoteId)}
      >
        View note
      </button>
    </div>
  );
}

function nextStatus(s: Task['status']): Task['status'] {
  return s === 'todo' ? 'in_progress' : s === 'in_progress' ? 'done' : 'todo';
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDueDate(due: string): string {
  const d = new Date(due);
  if (isNaN(d.getTime())) return due;
  const today = startOfToday();
  const diffDays = Math.floor((d.getTime() - today) / 86_400_000);
  if (diffDays < 0) return `OVERDUE · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}`;
  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'TOMORROW';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}
