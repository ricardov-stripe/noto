import type { Task } from '../../api';
import { isUntriaged } from './TriagedPredicate';
import { smartCompare } from './taskFilters';

export type BoardColumnKey = 'new' | 'upcoming' | 'done';

export interface BoardPartition {
  new: Task[];
  upcoming: Task[];
  done: Task[];
}

/**
 * Splits tasks into the three Kanban board columns:
 *   - NEW: untriaged (status=todo AND updatedAt===createdAt). One-way exit lane —
 *     once you touch a task it leaves NEW forever, so this column never accepts
 *     drops back in.
 *   - UPCOMING: triaged + open (status in {todo, in_progress}, but not in NEW).
 *     Includes tasks with no due date as well as scheduled ones.
 *   - DONE: status=done.
 *
 * Sort strategies differ by column:
 *   - NEW: createdAt desc (newest in inbox first — what the AI just extracted).
 *   - UPCOMING: smartCompare (overdue → today → scheduled today → later → no date).
 *   - DONE: updatedAt desc (most recently completed first).
 *
 * Pure function. Stable. No allocations beyond the three result arrays.
 */
export function partitionForBoard(tasks: Task[]): BoardPartition {
  const newCol: Task[] = [];
  const upcoming: Task[] = [];
  const done: Task[] = [];

  for (const t of tasks) {
    if (t.status === 'done') {
      done.push(t);
    } else if (isUntriaged(t)) {
      newCol.push(t);
    } else {
      upcoming.push(t);
    }
  }

  newCol.sort((a, b) => compareCreatedDesc(a, b));
  upcoming.sort(smartCompare);
  done.sort((a, b) => compareUpdatedDesc(a, b));

  return { new: newCol, upcoming, done };
}

function compareCreatedDesc(a: Task, b: Task): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function compareUpdatedDesc(a: Task, b: Task): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}
