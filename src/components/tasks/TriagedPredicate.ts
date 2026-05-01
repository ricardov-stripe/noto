import type { Task } from '../../api';

/**
 * A task is "triaged" when the user has explicitly interacted with it
 * (changed status, priority, title, due date, etc.). We use the presence
 * of an updatedAt newer than createdAt as the signal. Initial AI-extracted
 * tasks and fresh manual tasks have updatedAt === createdAt until touched.
 *
 * If this heuristic proves wrong in practice, escalate to an explicit
 * triagedAt column on the tasks table (follow-up, not blocking).
 */
export function isTriaged(task: Pick<Task, 'createdAt' | 'updatedAt'>): boolean {
  return task.updatedAt !== task.createdAt;
}

export function isUntriaged(
  task: Pick<Task, 'createdAt' | 'updatedAt' | 'status'>,
): boolean {
  return task.status === 'todo' && !isTriaged(task);
}
