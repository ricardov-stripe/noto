import { type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { BoardColumnKey } from './boardPartition';

interface Props {
  columnKey: BoardColumnKey;
  label: string;
  count: number;
  /** Disabled drop targets (e.g. NEW is exit-only because isUntriaged is one-way). */
  acceptsDrop?: boolean;
  /** Optional accent dot color for the header chip. */
  accent?: 'accent' | 'warning' | 'success' | 'soft';
  /** Click handler for the column-level "+ add" button. Optional. */
  onAdd?: () => void;
  /** Children are the list of TaskCard elements. */
  children: ReactNode;
}

/**
 * One Kanban column. Provides a useDroppable target with id `col:${columnKey}`
 * so even an empty column accepts cross-column drops. The TaskCard children
 * are wrapped in a SortableContext at the call site (TaskBoard) so that
 * within-column ordering still works as a drop target source.
 *
 * The column header shows a colored dot (accent prop), label, count, and an
 * optional `+` button. The column body is the droppable surface and shows a
 * "Drop here" hint when empty AND the user is currently dragging something.
 */
export function TaskColumn({
  columnKey,
  label,
  count,
  acceptsDrop = true,
  accent = 'soft',
  onAdd,
  children,
}: Props) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `col:${columnKey}`,
    disabled: !acceptsDrop,
  });

  const isDragging = active != null;
  const isEmpty = count === 0;

  const cls = [
    'task-column',
    `task-column--${columnKey}`,
    isOver && 'task-column--over',
    !acceptsDrop && 'task-column--disabled',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={cls} aria-label={`${label} column`}>
      <header className="task-column__head">
        <span className="task-column__label">
          <span className={`task-column__dot task-column__dot--${accent}`} aria-hidden />
          {label}
          <span className="task-column__count">{count}</span>
        </span>
        {onAdd && (
          <button
            type="button"
            className="task-column__add-btn"
            aria-label={`Add a task to ${label}`}
            onClick={onAdd}
          >
            +
          </button>
        )}
      </header>

      <div ref={setNodeRef} className="task-column__body" data-column={columnKey}>
        {children}
        {isEmpty && (
          <div
            className={
              isDragging && acceptsDrop
                ? 'task-column__drop-hint task-column__drop-hint--active'
                : 'task-column__drop-hint'
            }
            aria-hidden={!isDragging}
          >
            {isDragging && acceptsDrop
              ? 'Drop here'
              : !acceptsDrop
                ? null
                : 'Empty'}
          </div>
        )}
      </div>
    </section>
  );
}
