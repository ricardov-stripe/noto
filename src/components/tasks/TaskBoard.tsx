import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, Note } from '../../api';
import { partitionForBoard, type BoardColumnKey, type BoardPartition } from './boardPartition';
import { TaskColumn } from './TaskColumn';
import { TaskCard } from './TaskCard';

export interface TaskBoardProps {
  /** Tasks to render. The board partitions them itself; do not pre-partition. */
  tasks: Task[];
  notes: Note[];
  /** Optional pre-computed partition. If omitted the board computes from `tasks`. */
  partition?: BoardPartition;
  /**
   * Called when a card is dropped onto a column other than its own.
   * The board owns the optimistic move; the parent owns the API call.
   */
  onColumnDrop: (taskId: number, target: BoardColumnKey) => void;
  /**
   * Called when a card is dropped onto a Today rail slot. ISO start time of
   * the slot. End time is currently unused but accepted for parity with the
   * existing TodayStrip onSlotDrop signature.
   */
  onSlotDrop: (slotStartIso: string, slotEndIso: string, taskId: number) => void;
  /** Optional column-level "+ add" handlers per column. */
  onColumnAdd?: Partial<Record<BoardColumnKey, () => void>>;
  /** Optional Today rail rendered to the right of the columns. */
  rail?: ReactNode;

  /* Card-level callbacks. Identical contract to TaskRow. */
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
}

const COLUMN_DEFS: ReadonlyArray<{
  key: BoardColumnKey;
  label: string;
  accent: 'accent' | 'warning' | 'success' | 'soft';
  acceptsDrop: boolean;
}> = [
  // NEW is exit-only because isUntriaged is a one-way predicate (you can't
  // un-touch a task). Disabling its drop target prevents the visual lie.
  { key: 'new', label: 'New', accent: 'accent', acceptsDrop: false },
  { key: 'upcoming', label: 'Upcoming', accent: 'soft', acceptsDrop: true },
  { key: 'done', label: 'Done', accent: 'success', acceptsDrop: true },
];

export function TaskBoard({
  tasks,
  notes,
  partition,
  onColumnDrop,
  onSlotDrop,
  onColumnAdd,
  rail,
  onUpdateStatus,
  onUpdateTask,
  onDeleteTask,
  onCreateTask,
  onNavigateToNote,
}: TaskBoardProps) {
  const part = useMemo(() => partition ?? partitionForBoard(tasks), [partition, tasks]);

  // Quick id → task lookup for the DragOverlay render.
  const tasksById = useMemo(() => {
    const m = new Map<number, Task>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    // 4px activation distance prevents click-to-drag-stutter on cards. Below
    // this threshold the click bubbles to popover triggers normally.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const taskId = parseCardId(e.active.id);
    if (taskId != null) setActiveId(taskId);
  }, []);

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActiveId(null);
      const action = resolveDrop(e.active.id, e.over?.id ?? null, part);
      if (!action) return;
      if (action.type === 'slot') {
        // TodayStrip encodes start|end into the slot id for parity with its
        // native-DnD path; we forward both to handleSlotDrop unchanged.
        onSlotDrop(action.start, action.end, action.taskId);
      } else {
        onColumnDrop(action.taskId, action.target);
      }
    },
    [onColumnDrop, onSlotDrop, part],
  );

  const handleDragCancel = useCallback(() => setActiveId(null), []);

  const activeTask = activeId != null ? tasksById.get(activeId) ?? null : null;

  return (
    <div className="task-board-layout">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="task-board" role="region" aria-label="Task board">
          {COLUMN_DEFS.map((col) => {
            const cards = part[col.key];
            return (
              <TaskColumn
                key={col.key}
                columnKey={col.key}
                label={col.label}
                count={cards.length}
                accent={col.accent}
                acceptsDrop={col.acceptsDrop}
                onAdd={onColumnAdd?.[col.key]}
              >
                <SortableContext
                  items={cards.map((c) => `card:${c.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {cards.map((task) => (
                    <SortableTaskCard
                      key={task.id}
                      task={task}
                      notes={notes}
                      onUpdateStatus={onUpdateStatus}
                      onUpdateTask={onUpdateTask}
                      onDeleteTask={onDeleteTask}
                      onCreateTask={onCreateTask}
                      onNavigateToNote={onNavigateToNote}
                    />
                  ))}
                </SortableContext>
              </TaskColumn>
            );
          })}
        </div>

        {rail && <div className="task-board-rail">{rail}</div>}

        <DragOverlay dropAnimation={null}>
          {activeTask && (
            <TaskCard
              task={activeTask}
              notes={notes}
              isDragging
              onUpdateStatus={onUpdateStatus}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onCreateTask={onCreateTask}
              onNavigateToNote={onNavigateToNote}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/**
 * Pure drop dispatcher. Extracted so we can unit-test the column/slot/card
 * routing without spinning up a full DndContext + jsdom drag simulation.
 *
 * Returns the action to take, or null for a no-op.
 */
export type DropAction =
  | { type: 'column'; taskId: number; target: BoardColumnKey }
  | { type: 'slot'; taskId: number; start: string; end: string }
  | null;

export function resolveDrop(
  activeId: string | number,
  overId: string | number | null | undefined,
  partition: BoardPartition,
): DropAction {
  if (overId == null) return null;
  const taskId = parseCardId(activeId);
  if (taskId == null) return null;
  const overStr = String(overId);

  if (overStr.startsWith('slot:')) {
    const payload = overStr.slice(5);
    const [start, end = ''] = payload.split('|');
    if (!start) return null;
    return { type: 'slot', taskId, start, end };
  }

  if (overStr.startsWith('col:')) {
    const target = overStr.slice(4) as BoardColumnKey;
    if (target !== 'new' && target !== 'upcoming' && target !== 'done') return null;
    const sourceColumn = findColumn(partition, taskId);
    if (sourceColumn === target) return null;
    return { type: 'column', taskId, target };
  }

  if (overStr.startsWith('card:')) {
    const otherId = parseCardId(overStr);
    if (otherId == null) return null;
    const target = findColumn(partition, otherId);
    if (!target) return null;
    const sourceColumn = findColumn(partition, taskId);
    if (sourceColumn === target) return null;
    return { type: 'column', taskId, target };
  }

  return null;
}

function parseCardId(id: string | number): number | null {
  const s = String(id);
  if (s.startsWith('card:')) {
    const n = Number(s.slice(5));
    return Number.isNaN(n) ? null : n;
  }
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function findColumn(part: BoardPartition, taskId: number): BoardColumnKey | null {
  if (part.new.some((t) => t.id === taskId)) return 'new';
  if (part.upcoming.some((t) => t.id === taskId)) return 'upcoming';
  if (part.done.some((t) => t.id === taskId)) return 'done';
  return null;
}

interface SortableTaskCardProps {
  task: Task;
  notes: Note[];
  onUpdateStatus: TaskBoardProps['onUpdateStatus'];
  onUpdateTask: TaskBoardProps['onUpdateTask'];
  onDeleteTask: TaskBoardProps['onDeleteTask'];
  onCreateTask: TaskBoardProps['onCreateTask'];
  onNavigateToNote: TaskBoardProps['onNavigateToNote'];
}

function SortableTaskCard(props: SortableTaskCardProps) {
  const { task, ...rest } = props;
  const sortableId = `card:${task.id}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <TaskCard
      task={task}
      setNodeRef={setNodeRef}
      style={style}
      isDragging={isDragging}
      dragHandleProps={{ ...attributes, ...listeners }}
      {...rest}
    />
  );
}
