/**
 * Pure helpers for computing the Today Strip's free time slots.
 *
 * Given a day window and a set of blockers (events + scheduled tasks),
 * returns the ordered list of gaps that are at least `minSlotMin` minutes
 * long. Blockers may overlap or be out of order; we merge them internally.
 */

export interface TimeBlock {
  start: string; // ISO datetime
  end: string;   // ISO datetime
}

export interface FreeSlot extends TimeBlock {
  durationMin: number;
}

const MINUTE_MS = 60_000;

export function computeFreeSlots(
  dayStart: string,
  dayEnd: string,
  blockers: TimeBlock[],
  minSlotMin = 15,
): FreeSlot[] {
  if (dayStart >= dayEnd) return [];

  // Clamp each blocker to the day window and discard ones entirely outside it.
  const clamped: TimeBlock[] = [];
  for (const b of blockers) {
    if (b.end <= dayStart || b.start >= dayEnd) continue;
    const start = b.start < dayStart ? dayStart : b.start;
    const end = b.end > dayEnd ? dayEnd : b.end;
    if (start < end) clamped.push({ start, end });
  }

  clamped.sort((a, b) => a.start.localeCompare(b.start));

  // Merge overlapping / adjacent-but-touching blockers.
  const merged: TimeBlock[] = [];
  for (const b of clamped) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) {
      if (b.end > last.end) last.end = b.end;
    } else {
      merged.push({ start: b.start, end: b.end });
    }
  }

  const slots: FreeSlot[] = [];
  let cursor = dayStart;
  for (const m of merged) {
    if (m.start > cursor) slots.push(slotFrom(cursor, m.start));
    if (m.end > cursor) cursor = m.end;
  }
  if (cursor < dayEnd) slots.push(slotFrom(cursor, dayEnd));

  return slots.filter((s) => s.durationMin >= minSlotMin);
}

function slotFrom(start: string, end: string): FreeSlot {
  const durationMin = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / MINUTE_MS,
  );
  return { start, end, durationMin };
}
