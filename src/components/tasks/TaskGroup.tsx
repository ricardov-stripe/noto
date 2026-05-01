import type { Group } from './taskFilters';
import type { Task, Note } from '../../api';
import { TaskRow } from './TaskRow';

interface Props {
  group: Group;
  collapsed: boolean;
  selection: Set<number>;
  focusedId: number | null;
  focusedGroupKey: string | null;
  onRowMouseDown?: (e: React.MouseEvent, taskId: number) => void;
  editTitleTrigger: number | null;
  onConsumeTitleTrigger: () => void;
  editDescTrigger: number | null;
  onConsumeDescTrigger: () => void;
  onToggleCollapsed: (key: string) => void;
  onUpdateStatus: (id: number, status: Task['status']) => void;
  onNavigateToNote: (noteId: number) => void;
  onUpdateTask: (
    id: number,
    patch: Partial<Pick<Task, 'title' | 'priority' | 'dueDate' | 'description'>>,
  ) => Promise<void>;
  onCreateTask: (data: { title: string; priority: Task['priority']; dueDate: string | null; sourceNoteId: number | null }) => Promise<Task | null>;
  onDeleteTask: (id: number) => Promise<void>;
  notes: Note[];
}

export function TaskGroup({
  group,
  collapsed,
  selection,
  focusedId,
  focusedGroupKey,
  onRowMouseDown,
  editTitleTrigger,
  onConsumeTitleTrigger,
  editDescTrigger,
  onConsumeDescTrigger,
  onToggleCollapsed,
  onUpdateStatus,
  onNavigateToNote,
  onUpdateTask,
  onCreateTask,
  onDeleteTask,
  notes,
}: Props) {
  return (
    <div className="task-group">
      <button
        type="button"
        className={`group-label${focusedGroupKey === group.key ? ' focused' : ''}`}
        aria-expanded={!collapsed}
        onClick={() => onToggleCollapsed(group.key)}
      >
        <span className={`group-caret${collapsed ? ' collapsed' : ''}`}>▾</span>
        <span>{group.label.toUpperCase()}</span>
        <span className="group-count">· {group.tasks.length}</span>
      </button>
      {!collapsed && group.tasks.length === 0 && <div className="empty-section group-empty">Empty</div>}
      {!collapsed && group.tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          selected={selection.has(t.id)}
          focused={focusedId === t.id}
          onRowMouseDown={onRowMouseDown}
          editTitleTrigger={editTitleTrigger}
          onConsumeTitleTrigger={onConsumeTitleTrigger}
          editDescTrigger={editDescTrigger}
          onConsumeDescTrigger={onConsumeDescTrigger}
          onUpdateStatus={onUpdateStatus}
          onNavigateToNote={onNavigateToNote}
          onUpdateTask={onUpdateTask}
          onCreateTask={onCreateTask}
          onDeleteTask={onDeleteTask}
          notes={notes}
        />
      ))}
    </div>
  );
}
