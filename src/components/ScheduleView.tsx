import type { Task } from '../api';

interface CalendarEvent {
  title: string;
  date: string;
  startHour: number;
  endHour: number;
}

interface FreeSlot {
  start: number;
  end: number;
}

interface ScheduleViewProps {
  events: CalendarEvent[];
  tasks: Task[];
  freeSlots: FreeSlot[];
  selectedDate: string;
  onDateChange: (date: string) => void;
}

function formatHour(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function ScheduleView({ events, tasks, freeSlots, selectedDate, onDateChange }: ScheduleViewProps) {
  const dayTasks = tasks.filter(t => t.dueDate === selectedDate && t.status !== 'done');
  const dayEvents = events.filter(e => e.date === selectedDate);

  return (
    <div style={{ padding: 24, flex: 1, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Schedule</h2>
        <input type="date" value={selectedDate} onChange={e => onDateChange(e.target.value)}
          style={{ fontSize: 14, padding: '4px 8px' }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, color: '#555', marginBottom: 8 }}>Calendar Events</h3>
        {dayEvents.length === 0 && <div style={{ color: '#888', fontSize: 13 }}>No events</div>}
        {dayEvents.map((e, i) => (
          <div key={i} style={{ padding: 8, background: '#e8f0fe', borderRadius: 6, marginBottom: 4 }}>
            <strong>{e.title}</strong> · {formatHour(e.startHour)} - {formatHour(e.endHour)}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, color: '#555', marginBottom: 8 }}>Free Slots</h3>
        {freeSlots.map((s, i) => (
          <div key={i} style={{ padding: 8, background: '#f0fff4', borderRadius: 6, marginBottom: 4, fontSize: 13 }}>
            {formatHour(s.start)} - {formatHour(s.end)} ({Math.round((s.end - s.start) * 60)} min available)
          </div>
        ))}
      </div>

      <div>
        <h3 style={{ fontSize: 14, color: '#555', marginBottom: 8 }}>Tasks Due</h3>
        {dayTasks.length === 0 && <div style={{ color: '#888', fontSize: 13 }}>No tasks due</div>}
        {dayTasks.map(t => (
          <div key={t.id} style={{ padding: 8, border: '1px solid #e0e0e0', borderRadius: 6, marginBottom: 4 }}>
            {t.title} · <span style={{ fontSize: 11, color: '#666' }}>{t.priority}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
