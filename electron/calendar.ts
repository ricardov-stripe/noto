import { execSync } from 'child_process';

export interface CalendarEvent {
  title: string;
  date: string;
  startHour: number;
  endHour: number;
}

export interface FreeSlot {
  start: number;
  end: number;
}

export function parseCalendarEvents(output: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = output.trim().split('\n');

  for (let i = 0; i < lines.length; i++) {
    const titleLine = lines[i]?.trim();
    const timeLine = lines[i + 1]?.trim();
    if (!titleLine || !timeLine) continue;

    const timeMatch = timeLine.match(/(\d{4}-\d{2}-\d{2}) at (\d{2}):(\d{2}) - (\d{2}):(\d{2})/);
    if (timeMatch) {
      events.push({
        title: titleLine,
        date: timeMatch[1],
        startHour: parseInt(timeMatch[2]) + parseInt(timeMatch[3]) / 60,
        endHour: parseInt(timeMatch[4]) + parseInt(timeMatch[5]) / 60,
      });
      i++; // skip the time line
    }
  }

  return events;
}

export function findFreeSlots(events: CalendarEvent[], date: string, workStart: number, workEnd: number): FreeSlot[] {
  const dayEvents = events
    .filter(e => e.date === date)
    .sort((a, b) => a.startHour - b.startHour);

  const slots: FreeSlot[] = [];
  let cursor = workStart;

  for (const event of dayEvents) {
    if (event.startHour > cursor) {
      slots.push({ start: cursor, end: event.startHour });
    }
    cursor = Math.max(cursor, event.endHour);
  }

  if (cursor < workEnd) {
    slots.push({ start: cursor, end: workEnd });
  }

  return slots;
}

export function fetchCalendarEvents(daysAhead: number = 7): CalendarEvent[] {
  try {
    const output = execSync(
      `icalBuddy -f -nc -nrd -df "%Y-%m-%d" -tf "%H:%M" eventsFrom:today to:today+${daysAhead}`,
      { encoding: 'utf-8', timeout: 5000 }
    );
    return parseCalendarEvents(output);
  } catch {
    return []; // Calendar unavailable — app works without it
  }
}
