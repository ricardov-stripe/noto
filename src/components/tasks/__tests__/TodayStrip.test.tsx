import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { TodayStrip } from '../TodayStrip';
import type { Task } from '../../../api';
import type { CalendarEvent } from '../../../lib/calendar';
import type { FreeSlot } from '../../../lib/timeSlots';

const T = (overrides: Partial<Task>): Task => ({
  id: 1,
  title: 'Task',
  description: '',
  priority: 'medium',
  status: 'todo',
  dueDate: null,
  sourceNoteId: null,
  sourceText: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('TodayStrip', () => {
  const dayStart = new Date(2026, 4, 1, 8, 0, 0, 0).toISOString();
  const dayEnd = new Date(2026, 4, 1, 20, 0, 0, 0).toISOString();

  it('renders one label cell per hour in the visible window', () => {
    render(
      <TodayStrip
        now={new Date(2026, 4, 1, 12, 0, 0, 0)}
        events={[]}
        scheduledTasks={[]}
        freeSlots={[]}
        dayStart={dayStart}
        dayEnd={dayEnd}
      />,
    );
    const cells = document.querySelectorAll('.today-strip__label-cell');
    expect(cells.length).toBe(12);
  });

  it('renders N .today-strip__event nodes', () => {
    const events: CalendarEvent[] = [
      { id: 'a', title: 'A', start: new Date(2026, 4, 1, 9, 0, 0).toISOString(), end: new Date(2026, 4, 1, 10, 0, 0).toISOString() },
      { id: 'b', title: 'B', start: new Date(2026, 4, 1, 11, 0, 0).toISOString(), end: new Date(2026, 4, 1, 11, 30, 0).toISOString() },
    ];
    render(
      <TodayStrip
        now={new Date(2026, 4, 1, 10, 0, 0, 0)}
        events={events}
        scheduledTasks={[]}
        freeSlots={[]}
        dayStart={dayStart}
        dayEnd={dayEnd}
      />,
    );
    expect(document.querySelectorAll('.today-strip__event').length).toBe(2);
    expect(document.querySelector('.today-strip__block-title')?.textContent).toBe('A');
  });

  it('renders scheduled-task blocks', () => {
    const start = new Date(2026, 4, 1, 15, 0, 0, 0).toISOString();
    render(
      <TodayStrip
        now={new Date(2026, 4, 1, 16, 0, 0, 0)}
        events={[]}
        scheduledTasks={[T({ id: 7, title: 'Deep work', dueDate: start })]}
        freeSlots={[]}
        dayStart={dayStart}
        dayEnd={dayEnd}
      />,
    );
    expect(document.querySelectorAll('.today-strip__task-block').length).toBe(1);
    expect(screen.getByText('TASK')).toBeInTheDocument();
    expect(screen.getByText('Deep work')).toBeInTheDocument();
  });

  it('renders free slots with .today-strip__slot', () => {
    const slots: FreeSlot[] = [
      {
        start: new Date(2026, 4, 1, 12, 0, 0, 0).toISOString(),
        end: new Date(2026, 4, 1, 12, 45, 0, 0).toISOString(),
        durationMin: 45,
      },
    ];
    render(
      <TodayStrip
        now={new Date(2026, 4, 1, 10, 0, 0, 0)}
        events={[]}
        scheduledTasks={[]}
        freeSlots={slots}
        dayStart={dayStart}
        dayEnd={dayEnd}
      />,
    );
    const nodes = document.querySelectorAll('.today-strip__slot');
    expect(nodes.length).toBe(1);
    expect(nodes[0]).toHaveAttribute('data-slot-start', slots[0]!.start);
    expect(nodes[0]).toHaveAttribute('data-drop-type', 'free-slot');
  });

  it('shows NOW line when now is inside the window', () => {
    const { container } = render(
      <TodayStrip
        now={new Date(2026, 4, 1, 14, 32, 0, 0)}
        events={[]}
        scheduledTasks={[]}
        freeSlots={[]}
        dayStart={dayStart}
        dayEnd={dayEnd}
      />,
    );
    expect(container.querySelector('.today-strip__now')).not.toBeNull();
  });

  it('hides NOW line when now is before dayStart', () => {
    const { container } = render(
      <TodayStrip
        now={new Date(2026, 4, 1, 6, 0, 0, 0)}
        events={[]}
        scheduledTasks={[]}
        freeSlots={[]}
        dayStart={dayStart}
        dayEnd={dayEnd}
      />,
    );
    expect(container.querySelector('.today-strip__now')).toBeNull();
  });

  describe('dndKitMode', () => {
    const slots: FreeSlot[] = [
      {
        start: new Date(2026, 4, 1, 11, 0, 0, 0).toISOString(),
        end: new Date(2026, 4, 1, 12, 0, 0, 0).toISOString(),
        durationMin: 60,
      },
    ];

    it('renders slots with the dnd-kit data attribute when enabled', () => {
      render(
        <DndContext>
          <TodayStrip
            now={new Date(2026, 4, 1, 10, 0, 0, 0)}
            events={[]}
            scheduledTasks={[]}
            freeSlots={slots}
            dayStart={dayStart}
            dayEnd={dayEnd}
            dndKitMode
          />
        </DndContext>,
      );
      const node = document.querySelector('.today-strip__slot');
      expect(node).not.toBeNull();
      expect(node).toHaveAttribute('data-dnd-kit', 'true');
    });

    it('does not set the dnd-kit attribute when disabled (default)', () => {
      render(
        <TodayStrip
          now={new Date(2026, 4, 1, 10, 0, 0, 0)}
          events={[]}
          scheduledTasks={[]}
          freeSlots={slots}
          dayStart={dayStart}
          dayEnd={dayEnd}
        />,
      );
      const node = document.querySelector('.today-strip__slot');
      expect(node).not.toBeNull();
      expect(node).not.toHaveAttribute('data-dnd-kit');
    });

    it('preserves slot start/end attributes in dnd-kit mode', () => {
      render(
        <DndContext>
          <TodayStrip
            now={new Date(2026, 4, 1, 10, 0, 0, 0)}
            events={[]}
            scheduledTasks={[]}
            freeSlots={slots}
            dayStart={dayStart}
            dayEnd={dayEnd}
            dndKitMode
          />
        </DndContext>,
      );
      const node = document.querySelector('.today-strip__slot');
      expect(node).toHaveAttribute('data-slot-start', slots[0]!.start);
      expect(node).toHaveAttribute('data-slot-end', slots[0]!.end);
    });
  });

  it('clamps event starting before dayStart to top 0%', () => {
    const events: CalendarEvent[] = [
      {
        id: 'early',
        title: 'Early',
        start: new Date(2026, 4, 1, 6, 0, 0, 0).toISOString(),
        end: new Date(2026, 4, 1, 10, 0, 0, 0).toISOString(),
      },
    ];
    render(
      <TodayStrip
        now={new Date(2026, 4, 1, 9, 0, 0, 0)}
        events={events}
        scheduledTasks={[]}
        freeSlots={[]}
        dayStart={dayStart}
        dayEnd={dayEnd}
      />,
    );
    const el = document.querySelector('.today-strip__event') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.style.top).toBe('0%');
    expect(Number.parseFloat(el.style.height)).toBeGreaterThan(0);
  });
});
