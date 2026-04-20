import type { Task, CalendarEvent, FreeSlot } from '../api';

interface ScheduleViewProps {
  events: CalendarEvent[];
  tasks: Task[];
  freeSlots: FreeSlot[];
  selectedDate: string;
  onDateChange: (date: string) => void;
}

const PRIORITY_CLASS: Record<Task['priority'], 'high' | 'med' | 'low'> = {
  high: 'high',
  medium: 'med',
  low: 'low',
};

/**
 * Schedule view — three vertically stacked sections for the chosen day:
 *   1. Calendar events (from local calendar via icalBuddy)
 *   2. Free slots (within 9-17 work window)
 *   3. Tasks due that day (excluding done)
 */
export function ScheduleView({
  events,
  tasks,
  freeSlots,
  selectedDate,
  onDateChange,
}: ScheduleViewProps) {
  const dayTasks = tasks.filter((t) => t.dueDate === selectedDate && t.status !== 'done');
  const dayEvents = events.filter((e) => e.date === selectedDate);

  return (
    <section className="view" aria-label="Schedule">
      <div className="view-head">
        <h1 className="view-title">Schedule</h1>
        <input
          type="date"
          className="date-picker"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>

      <div className="view-body">
        <div className="schedule-section">
          <div className="section-label">Calendar events</div>
          {dayEvents.length === 0 && <div className="empty-section">Nothing on the calendar.</div>}
          {dayEvents.map((e, i) => (
            <div className="event-row" key={i}>
              <strong>{e.title}</strong>
              <span className="when">{formatHour(e.startHour)} – {formatHour(e.endHour)}</span>
            </div>
          ))}
        </div>

        <div className="schedule-section">
          <div className="section-label">Free slots</div>
          {freeSlots.length === 0 && <div className="empty-section">No free time in the work window.</div>}
          {freeSlots.map((s, i) => (
            <div className="slot-row" key={i}>
              <span className="when">{formatHour(s.start)} – {formatHour(s.end)}</span>
              <span className="duration">{Math.round((s.end - s.start) * 60)} min</span>
            </div>
          ))}
        </div>

        <div className="schedule-section">
          <div className="section-label">Tasks due</div>
          {dayTasks.length === 0 && <div className="empty-section">No tasks due today.</div>}
          {dayTasks.map((t) => (
            <div className="due-row" key={t.id}>
              <span>{t.title}</span>
              <span className={`priority-pill ${PRIORITY_CLASS[t.priority]}`}>{t.priority}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatHour(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}
