import { useState, type Ref } from 'react';
import { Popover } from './Popover';

function startOfTodayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIso(d: Date): string {
  return d.toISOString();
}

function formatDueChip(due: string | null): string {
  if (!due) return '';
  const d = new Date(due);
  if (isNaN(d.getTime())) return due;
  const today = startOfTodayDate().getTime();
  const diff = Math.floor((d.getTime() - today) / 86_400_000);
  if (diff < 0) return `OVERDUE · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}`;
  if (diff === 0) return 'TODAY';
  if (diff === 1) return 'TOMORROW';
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function dueTodayIso(): string {
  return toIso(startOfTodayDate());
}

function dueTomorrowIso(): string {
  const d = startOfTodayDate();
  d.setDate(d.getDate() + 1);
  return toIso(d);
}

/** Next Saturday, or Sunday if today is Saturday. */
function thisWeekendIso(): string {
  const d = startOfTodayDate();
  const day = d.getDay();
  if (day === 6) {
    d.setDate(d.getDate() + 1);
    return toIso(d);
  }
  let untilSat = (6 - day + 7) % 7;
  if (untilSat === 0) untilSat = 7;
  d.setDate(d.getDate() + untilSat);
  return toIso(d);
}

function nextWeekIso(): string {
  const d = startOfTodayDate();
  d.setDate(d.getDate() + 7);
  return toIso(d);
}

function dateInputToIso(ymd: string): string {
  const [y, m, day] = ymd.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, day || 1, 12, 0, 0, 0);
  return d.toISOString();
}

interface MenuBodyProps {
  taskId: number;
  onUpdateTask: (id: number, patch: { dueDate?: string | null }) => Promise<void>;
  close: () => void;
}

function DueMenuBody({ taskId, onUpdateTask, close }: MenuBodyProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const apply = async (iso: string | null) => {
    await onUpdateTask(taskId, { dueDate: iso });
    close();
  };

  if (pickerOpen) {
    return (
      <div className="due-popover-picker">
        <input
          type="date"
          className="due-date-input"
          aria-label="Pick due date"
          autoFocus
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            void apply(dateInputToIso(v));
            setPickerOpen(false);
          }}
        />
        <button type="button" className="popover-item" onClick={() => setPickerOpen(false)}>
          Back
        </button>
      </div>
    );
  }

  return (
    <>
      <button type="button" role="menuitem" className="popover-item" onClick={() => void apply(dueTodayIso())}>
        Today
      </button>
      <button type="button" role="menuitem" className="popover-item" onClick={() => void apply(dueTomorrowIso())}>
        Tomorrow
      </button>
      <button type="button" role="menuitem" className="popover-item" onClick={() => void apply(thisWeekendIso())}>
        This weekend
      </button>
      <button type="button" role="menuitem" className="popover-item" onClick={() => void apply(nextWeekIso())}>
        Next week
      </button>
      <button type="button" role="menuitem" className="popover-item" onClick={() => setPickerOpen(true)}>
        Pick a date…
      </button>
      <button type="button" role="menuitem" className="popover-item" onClick={() => void apply(null)}>
        No date
      </button>
    </>
  );
}

export interface DuePopoverProps {
  taskId: number;
  dueDate: string | null;
  onUpdateTask: (
    id: number,
    patch: Partial<{ dueDate: string | null }>,
  ) => Promise<void>;
  dueTriggerRef?: Ref<HTMLButtonElement>;
}

export function DuePopover({ taskId, dueDate, onUpdateTask, dueTriggerRef }: DuePopoverProps) {
  const label = dueDate ? formatDueChip(dueDate) : '+ due';
  return (
    <Popover
      align="right"
      trigger={(open, toggle) => (
        <button
          ref={dueTriggerRef}
          type="button"
          className={`task-due${dueDate ? '' : ' task-due-placeholder'}`}
          aria-label="Set due date"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
        >
          {label}
        </button>
      )}
    >
      {(close) => <DueMenuBody taskId={taskId} onUpdateTask={onUpdateTask} close={close} />}
    </Popover>
  );
}
