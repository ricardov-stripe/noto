import { useState, type ReactNode } from 'react';
import { Popover } from './Popover';

function startOfTodayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIso(d: Date): string {
  return d.toISOString();
}

function dueTodayIso(): string {
  return toIso(startOfTodayDate());
}

function dueTomorrowIso(): string {
  const d = startOfTodayDate();
  d.setDate(d.getDate() + 1);
  return toIso(d);
}

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

interface Props {
  count: number;
  allDone: boolean;
  onComplete: () => void;
  onReopen: () => void;
  onSetDue: (date: string | null) => void;
  onSetPriority: (p: 'high' | 'medium' | 'low') => void;
  onDelete: () => void;
  onClear: () => void;
}

function BulkDueMenu({
  onSetDue,
  close,
}: {
  onSetDue: (date: string | null) => void;
  close: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const apply = (iso: string | null) => {
    onSetDue(iso);
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
            apply(dateInputToIso(v));
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
      <button type="button" role="menuitem" className="popover-item" onClick={() => apply(dueTodayIso())}>
        Today
      </button>
      <button type="button" role="menuitem" className="popover-item" onClick={() => apply(dueTomorrowIso())}>
        Tomorrow
      </button>
      <button type="button" role="menuitem" className="popover-item" onClick={() => apply(thisWeekendIso())}>
        This weekend
      </button>
      <button type="button" role="menuitem" className="popover-item" onClick={() => apply(nextWeekIso())}>
        Next week
      </button>
      <button type="button" role="menuitem" className="popover-item" onClick={() => setPickerOpen(true)}>
        Pick a date…
      </button>
      <button type="button" role="menuitem" className="popover-item" onClick={() => apply(null)}>
        No date
      </button>
    </>
  );
}

export function BulkActionBar({
  count,
  allDone,
  onComplete,
  onReopen,
  onSetDue,
  onSetPriority,
  onDelete,
  onClear,
}: Props) {
  const statusBtn = (handler: () => void, label: string): ReactNode => (
    <button type="button" className="bulk-action-btn" onClick={handler}>
      {label}
    </button>
  );

  return (
    <div className="bulk-action-bar" role="toolbar" aria-label="Bulk actions for selected tasks">
      <span className="bulk-action-count">{count} SELECTED</span>
      {statusBtn(allDone ? onReopen : onComplete, allDone ? 'Reopen' : 'Complete')}
      <Popover
        align="left"
        trigger={(open, toggle) => (
          <button type="button" className="bulk-action-btn" aria-expanded={open} aria-haspopup="menu" onClick={toggle}>
            Set due ▾
          </button>
        )}
      >
        {(close) => <BulkDueMenu onSetDue={onSetDue} close={close} />}
      </Popover>
      <Popover
        align="left"
        trigger={(open, toggle) => (
          <button type="button" className="bulk-action-btn" aria-expanded={open} aria-haspopup="menu" onClick={toggle}>
            Set priority ▾
          </button>
        )}
      >
        {(close) => (
          <>
            <button
              type="button"
              role="menuitem"
              className="popover-item"
              onClick={() => {
                onSetPriority('high');
                close();
              }}
            >
              High
            </button>
            <button
              type="button"
              role="menuitem"
              className="popover-item"
              onClick={() => {
                onSetPriority('medium');
                close();
              }}
            >
              Medium
            </button>
            <button
              type="button"
              role="menuitem"
              className="popover-item"
              onClick={() => {
                onSetPriority('low');
                close();
              }}
            >
              Low
            </button>
          </>
        )}
      </Popover>
      <button type="button" className="bulk-action-btn bulk-action-delete" onClick={onDelete}>
        Delete
      </button>
      <button type="button" className="bulk-action-clear" aria-label="Clear selection" onClick={onClear}>
        ✕
      </button>
    </div>
  );
}
