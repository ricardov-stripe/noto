import type React from 'react';
import type { CalendarEvent } from '../../lib/calendar';
import type { Task } from '../../api';
import type { FreeSlot } from '../../lib/timeSlots';

const MINUTE_MS = 60_000;

function addMinutesIso(iso: string, minutes: number): string {
  const d = new Date(iso);
  d.setTime(d.getTime() + minutes * MINUTE_MS);
  return d.toISOString();
}

/** Top offset % and height % for [start, end) inside [dayStart, dayEnd). */
function percentSpanInWindow(
  startIso: string,
  endIso: string,
  dayStart: string,
  dayEnd: string,
): { topPct: number; heightPct: number } {
  const w0 = new Date(dayStart).getTime();
  const w1 = new Date(dayEnd).getTime();
  const totalMs = w1 - w0;
  if (totalMs <= 0) return { topPct: 0, heightPct: 0 };

  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  const clampedStart = Math.max(s, w0);
  const clampedEnd = Math.min(e, w1);
  if (clampedEnd <= clampedStart) return { topPct: 0, heightPct: 0 };

  const topPct = ((clampedStart - w0) / totalMs) * 100;
  const heightPct = ((clampedEnd - clampedStart) / totalMs) * 100;
  return { topPct, heightPct };
}

function formatHourLabel(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: undefined,
    hour12: true,
  });
}

function formatRange(isoStart: string, isoEnd: string): string {
  const a = new Date(isoStart);
  const b = new Date(isoEnd);
  const opt: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${a.toLocaleTimeString(undefined, opt)}–${b.toLocaleTimeString(undefined, opt)}`;
}

const DEFAULT_TASK_BLOCK_MIN = 30;

export interface TodayStripProps {
  now: Date;
  events: CalendarEvent[];
  scheduledTasks: Task[];
  freeSlots: FreeSlot[];
  dayStart: string;
  dayEnd: string;
  onSlotDrop?: (slotStart: string, slotEnd: string, taskId: number) => void;
  onEventClick?: (eventId: string) => void;
}

export function TodayStrip({
  now,
  events,
  scheduledTasks,
  freeSlots,
  dayStart,
  dayEnd,
  onSlotDrop,
  onEventClick,
}: TodayStripProps) {
  const w0 = new Date(dayStart).getTime();
  const w1 = new Date(dayEnd).getTime();
  const totalMs = Math.max(0, w1 - w0);
  const hourMs = 60 * MINUTE_MS;

  const hourTicks: Date[] = [];
  if (totalMs > 0) {
    const cur = new Date(dayStart);
    cur.setMinutes(0, 0, 0);
    if (cur.getTime() < w0) cur.setTime(cur.getTime() + hourMs);
    while (cur.getTime() < w1) {
      hourTicks.push(new Date(cur));
      cur.setTime(cur.getTime() + hourMs);
    }
  }

  const nHours = hourTicks.length;
  const trackHeightPx = nHours * 48;

  const nowMs = now.getTime();
  const nowInWindow = totalMs > 0 && nowMs >= w0 && nowMs <= w1;

  return (
    <aside className="today-strip" aria-label="Your day timeline">
      <div className="today-strip__scroll">
        <div className="today-strip__canvas" style={{ height: `${trackHeightPx}px` }}>
          <div className="today-strip__labels">
            {hourTicks.map((t) => (
              <div key={t.getTime()} className="today-strip__label-cell">
                {formatHourLabel(t)}
              </div>
            ))}
          </div>
          <div className="today-strip__track">
            {nHours > 0 &&
              hourTicks.map((t, i) => (
                <div
                  key={`line-${t.getTime()}`}
                  className="today-strip__hour-line"
                  style={{ top: `${(i / nHours) * 100}%` }}
                />
              ))}
            {events.map((ev) => {
              const { topPct, heightPct } = percentSpanInWindow(
                ev.start,
                ev.end,
                dayStart,
                dayEnd,
              );
              if (heightPct <= 0) return null;
              return (
                <button
                  key={ev.id}
                  type="button"
                  className="today-strip__event"
                  style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                  onClick={() => onEventClick?.(ev.id)}
                >
                  <span className="today-strip__block-title">{ev.title}</span>
                  <span className="today-strip__block-meta">{formatRange(ev.start, ev.end)}</span>
                </button>
              );
            })}
            {scheduledTasks.map((t) => {
              const start = t.dueDate!;
              const end = addMinutesIso(start, DEFAULT_TASK_BLOCK_MIN);
              const { topPct, heightPct } = percentSpanInWindow(start, end, dayStart, dayEnd);
              if (heightPct <= 0) return null;
              return (
                <div
                  key={`task-${t.id}`}
                  className="today-strip__task-block"
                  style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                >
                  <span className="today-strip__task-pill">TASK</span>
                  <span className="today-strip__block-title">{t.title}</span>
                  <span className="today-strip__block-meta">{formatRange(start, end)}</span>
                </div>
              );
            })}
            {freeSlots.map((slot) => {
              const { topPct, heightPct } = percentSpanInWindow(
                slot.start,
                slot.end,
                dayStart,
                dayEnd,
              );
              if (heightPct <= 0) return null;
              const handleDragOver = (e: React.DragEvent) => {
                if (!onSlotDrop) return;
                if (!Array.from(e.dataTransfer.types).includes('application/x-noto-task')) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                (e.currentTarget as HTMLElement).classList.add('today-strip__slot--active');
              };
              const handleDragLeave = (e: React.DragEvent) => {
                (e.currentTarget as HTMLElement).classList.remove('today-strip__slot--active');
              };
              const handleDrop = (e: React.DragEvent) => {
                (e.currentTarget as HTMLElement).classList.remove('today-strip__slot--active');
                if (!onSlotDrop) return;
                const raw = e.dataTransfer.getData('application/x-noto-task');
                const id = Number.parseInt(raw, 10);
                if (!Number.isFinite(id)) return;
                e.preventDefault();
                onSlotDrop(slot.start, slot.end, id);
              };
              return (
                <div
                  key={slot.start}
                  className="today-strip__slot today-strip__slot--drop-target"
                  style={{ top: `${topPct}%`, height: `${heightPct}%` }}
                  data-slot-start={slot.start}
                  data-slot-end={slot.end}
                  data-drop-type="free-slot"
                  aria-label={`Free ${slot.durationMin} minutes`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                />
              );
            })}
            {nowInWindow && (
              <div
                className="today-strip__now"
                style={{
                  top: `${((nowMs - w0) / totalMs) * 100}%`,
                }}
              >
                <span className="today-strip__now-dot" />
                <span className="today-strip__now-line" />
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
