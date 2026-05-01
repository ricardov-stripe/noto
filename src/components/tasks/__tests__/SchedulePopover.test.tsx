import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SchedulePopover } from '../SchedulePopover';
import type { FreeSlot } from '../../../lib/timeSlots';

const slots: FreeSlot[] = [
  { start: '2026-05-01T12:00:00.000Z', end: '2026-05-01T13:30:00.000Z', durationMin: 90 },
  { start: '2026-05-01T14:00:00.000Z', end: '2026-05-01T15:00:00.000Z', durationMin: 60 },
  { start: '2026-05-01T16:00:00.000Z', end: '2026-05-01T17:30:00.000Z', durationMin: 90 },
];

describe('SchedulePopover', () => {
  it('renders the task title', () => {
    render(
      <SchedulePopover
        taskTitle="Send Q2 report"
        freeSlots={slots}
        onSchedule={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Send Q2 report')).toBeInTheDocument();
  });

  it('shows every free slot as an option', () => {
    render(
      <SchedulePopover taskTitle="t" freeSlots={slots} onSchedule={() => {}} onClose={() => {}} />,
    );
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('fires onSchedule with the clicked slot start', () => {
    const onSchedule = vi.fn();
    render(
      <SchedulePopover taskTitle="t" freeSlots={slots} onSchedule={onSchedule} onClose={() => {}} />,
    );
    fireEvent.click(screen.getAllByRole('option')[1]);
    expect(onSchedule).toHaveBeenCalledWith(slots[1].start);
  });

  it('fires onClose on backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(
      <SchedulePopover taskTitle="t" freeSlots={slots} onSchedule={() => {}} onClose={onClose} />,
    );
    const backdrop = container.querySelector('.schedule-popover__backdrop')!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fires onClose on Escape', () => {
    const onClose = vi.fn();
    render(
      <SchedulePopover taskTitle="t" freeSlots={slots} onSchedule={() => {}} onClose={onClose} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when there are no slots', () => {
    render(
      <SchedulePopover taskTitle="t" freeSlots={[]} onSchedule={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText(/No open slots/i)).toBeInTheDocument();
  });

  it('Enter schedules the currently highlighted slot', () => {
    const onSchedule = vi.fn();
    render(
      <SchedulePopover taskTitle="t" freeSlots={slots} onSchedule={onSchedule} onClose={() => {}} />,
    );
    fireEvent.keyDown(window, { key: 'ArrowDown' }); // move to index 1
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSchedule).toHaveBeenCalledWith(slots[1].start);
  });
});
