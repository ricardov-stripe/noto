import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScheduleView } from '../ScheduleView';

describe('ScheduleView', () => {
  const events = [
    { title: 'Standup', date: '2026-04-20', startHour: 9, endHour: 9.5 },
  ];
  const tasks = [
    { id: 1, title: 'Write report', description: '', priority: 'high' as const, status: 'todo' as const, dueDate: '2026-04-20', sourceNoteId: 1, sourceText: '', createdAt: '', updatedAt: '' },
  ];
  const freeSlots = [{ start: 10, end: 12 }, { start: 13, end: 17 }];

  it('renders calendar events', () => {
    render(<ScheduleView events={events} tasks={tasks} freeSlots={freeSlots} selectedDate="2026-04-20" onDateChange={() => {}} />);
    expect(screen.getByText('Standup')).toBeInTheDocument();
  });

  it('renders tasks with due dates', () => {
    render(<ScheduleView events={events} tasks={tasks} freeSlots={freeSlots} selectedDate="2026-04-20" onDateChange={() => {}} />);
    expect(screen.getByText(/Write report/)).toBeInTheDocument();
  });

  it('shows free slots', () => {
    render(<ScheduleView events={events} tasks={tasks} freeSlots={freeSlots} selectedDate="2026-04-20" onDateChange={() => {}} />);
    expect(screen.getByText(/10:00.*12:00/)).toBeInTheDocument();
  });
});
