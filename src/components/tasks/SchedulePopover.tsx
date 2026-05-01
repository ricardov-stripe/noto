import { useEffect, useRef, useState } from 'react';
import type { FreeSlot } from '../../lib/timeSlots';

export interface SchedulePopoverProps {
  taskTitle: string;
  freeSlots: FreeSlot[];
  onSchedule: (slotStart: string) => void;
  onClose: () => void;
}

function formatSlot(slot: FreeSlot): string {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const opt: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${start.toLocaleTimeString(undefined, opt)} – ${end.toLocaleTimeString(undefined, opt)}  ·  ${slot.durationMin} min`;
}

/**
 * Modal popover triggered by the `s` key on a focused row. Shows the
 * computed free slots for today and lets the user pick one with
 * arrow-keys + Enter or a click. Anchored to the center of the viewport
 * like the cheatsheet; closes on ESC or outside click.
 */
export function SchedulePopover({
  taskTitle,
  freeSlots,
  onSchedule,
  onClose,
}: SchedulePopoverProps) {
  const [index, setIndex] = useState(0);
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstButton.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => Math.min(freeSlots.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (freeSlots[index]) onSchedule(freeSlots[index].start);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [freeSlots, index, onClose, onSchedule]);

  return (
    <div
      className="schedule-popover__backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="schedule-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-popover-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="schedule-popover__header">
          <span className="schedule-popover__eyebrow">SCHEDULE</span>
          <h3 id="schedule-popover-title" className="schedule-popover__title">
            {taskTitle}
          </h3>
        </header>
        {freeSlots.length === 0 ? (
          <div className="schedule-popover__empty">
            No open slots left today. Try tomorrow.
          </div>
        ) : (
          <ul className="schedule-popover__list" role="listbox" aria-label="Free time slots">
            {freeSlots.map((slot, i) => (
              <li key={slot.start}>
                <button
                  ref={i === 0 ? firstButton : undefined}
                  type="button"
                  className={`schedule-popover__slot${i === index ? ' schedule-popover__slot--active' : ''}`}
                  role="option"
                  aria-selected={i === index}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => onSchedule(slot.start)}
                >
                  {formatSlot(slot)}
                </button>
              </li>
            ))}
          </ul>
        )}
        <footer className="schedule-popover__footer">
          <span className="schedule-popover__hint">↑ ↓ Enter</span>
          <button
            type="button"
            className="schedule-popover__close"
            onClick={onClose}
          >
            Esc
          </button>
        </footer>
      </div>
    </div>
  );
}
