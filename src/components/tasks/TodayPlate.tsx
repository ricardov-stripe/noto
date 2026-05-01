import { useMemo, type ReactNode } from 'react';
import type { Task } from '../../api';
import { localDateYmd } from '../../lib/dateHelpers';

export type TodayPlateSection = 'overdue' | 'scheduled' | 'today';

export { localDateYmd };

function hasTimeComponent(dueDate: string): boolean {
  return dueDate.length > 10;
}

function priorityRank(p: Task['priority']): number {
  switch (p) {
    case 'high':
      return 0;
    case 'medium':
      return 1;
    case 'low':
      return 2;
    default:
      return 3;
  }
}

export function partitionPlateSections(tasks: Task[], todayStr: string) {
  const overdue: Task[] = [];
  const scheduled: Task[] = [];
  const today: Task[] = [];

  for (const t of tasks) {
    if (t.status === 'done' || t.dueDate == null) continue;
    const d = t.dueDate.slice(0, 10);
    if (d < todayStr) overdue.push(t);
    else if (d === todayStr && hasTimeComponent(t.dueDate)) scheduled.push(t);
    else if (d === todayStr) today.push(t);
  }

  overdue.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  scheduled.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  today.sort(
    (a, b) =>
      priorityRank(a.priority) - priorityRank(b.priority) ||
      a.title.localeCompare(b.title),
  );

  return { overdue, scheduled, today };
}

export interface TodayPlateProps {
  tasks: Task[];
  now: Date;
  children: (section: TodayPlateSection, sectionTasks: Task[]) => ReactNode;
}

const SECTION_META: { section: TodayPlateSection; title: string }[] = [
  { section: 'overdue', title: 'OVERDUE' },
  { section: 'scheduled', title: 'SCHEDULED' },
  { section: 'today', title: 'TODAY' },
];

export function TodayPlate({ tasks, now, children }: TodayPlateProps) {
  const todayStr = localDateYmd(now);
  const { overdue, scheduled, today } = useMemo(
    () => partitionPlateSections(tasks, todayStr),
    [tasks, todayStr],
  );

  const plateHasAnyTask = overdue.length + scheduled.length + today.length > 0;

  const bySection: Record<TodayPlateSection, Task[]> = {
    overdue,
    scheduled,
    today,
  };

  const allEmpty = !plateHasAnyTask;

  if (allEmpty) {
    return (
      <div className="today-plate">
        <div className="today-plate__empty" role="status">
          <div className="today-plate__empty-hero">Nothing queued for today.</div>
          <p className="today-plate__empty-sub">
            Drag a task onto the strip, or press <kbd>g</kbd> <kbd>u</kbd> to plan
            tomorrow.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="today-plate">
      {SECTION_META.map(({ section, title }) => {
        const list = bySection[section];
        if (list.length === 0) return null;
        return (
          <section key={section} className="today-plate__section">
            <div className="today-plate__section-header" aria-label={`${title} section`}>
              {title} · {list.length}
            </div>
            <div className="today-plate__rows">{children(section, list)}</div>
          </section>
        );
      })}
    </div>
  );
}
