import { describe, it, expect } from 'vitest';
import { computeFreeSlots } from '../timeSlots';

// Helpers to build ISO strings for 2026-05-01 HH:mm
function iso(hour: number, min = 0): string {
  const d = new Date(2026, 4, 1, hour, min, 0, 0);
  return d.toISOString();
}

const DAY_START = iso(8);
const DAY_END = iso(20);

describe('computeFreeSlots', () => {
  it('returns one full-day slot when there are no blockers', () => {
    const slots = computeFreeSlots(DAY_START, DAY_END, []);
    expect(slots).toHaveLength(1);
    expect(slots[0].start).toBe(DAY_START);
    expect(slots[0].end).toBe(DAY_END);
    expect(slots[0].durationMin).toBe(12 * 60);
  });

  it('splits the day around a single mid-day event', () => {
    const slots = computeFreeSlots(DAY_START, DAY_END, [
      { start: iso(10), end: iso(11) },
    ]);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toEqual(expect.objectContaining({ start: DAY_START, end: iso(10) }));
    expect(slots[1]).toEqual(expect.objectContaining({ start: iso(11), end: DAY_END }));
  });

  it('produces no gap between adjacent events', () => {
    const slots = computeFreeSlots(DAY_START, DAY_END, [
      { start: iso(10), end: iso(11) },
      { start: iso(11), end: iso(12) },
    ]);
    // Gap between the two events should not appear (they touch).
    expect(slots.find((s) => s.start === iso(11) && s.end === iso(11))).toBeUndefined();
    expect(slots).toHaveLength(2);
  });

  it('merges overlapping events', () => {
    const slots = computeFreeSlots(DAY_START, DAY_END, [
      { start: iso(10), end: iso(12) },
      { start: iso(11), end: iso(13) },
    ]);
    expect(slots).toHaveLength(2);
    expect(slots[0]).toEqual(expect.objectContaining({ start: DAY_START, end: iso(10) }));
    expect(slots[1]).toEqual(expect.objectContaining({ start: iso(13), end: DAY_END }));
  });

  it('handles an event at the day start (no slot before)', () => {
    const slots = computeFreeSlots(DAY_START, DAY_END, [
      { start: DAY_START, end: iso(9) },
    ]);
    expect(slots).toHaveLength(1);
    expect(slots[0].start).toBe(iso(9));
  });

  it('handles an event at the day end (no slot after)', () => {
    const slots = computeFreeSlots(DAY_START, DAY_END, [
      { start: iso(19), end: DAY_END },
    ]);
    expect(slots).toHaveLength(1);
    expect(slots[0].end).toBe(iso(19));
  });

  it('clamps an event that spans the day boundary', () => {
    const slots = computeFreeSlots(DAY_START, DAY_END, [
      { start: iso(7), end: iso(9) },
    ]);
    expect(slots).toHaveLength(1);
    expect(slots[0].start).toBe(iso(9));
  });

  it('ignores events fully outside the window', () => {
    const slots = computeFreeSlots(DAY_START, DAY_END, [
      { start: iso(6), end: iso(7) },
      { start: iso(21), end: iso(22) },
    ]);
    expect(slots).toHaveLength(1);
  });

  it('rejects slots shorter than minSlotMin', () => {
    // 10-minute gap between two events, minSlotMin=15 → the gap is dropped.
    const slots = computeFreeSlots(DAY_START, DAY_END, [
      { start: iso(10), end: iso(11) },
      { start: iso(11, 10), end: iso(12) },
    ], 15);
    // Three gaps are possible: 8-10, 11-11:10 (10 min, dropped), 12-20.
    expect(slots.map((s) => [s.start, s.end])).toEqual([
      [DAY_START, iso(10)],
      [iso(12), DAY_END],
    ]);
  });

  it('keeps slots of exactly minSlotMin duration', () => {
    const slots = computeFreeSlots(DAY_START, DAY_END, [
      { start: iso(10), end: iso(11) },
      { start: iso(11, 15), end: iso(12) },
    ], 15);
    expect(slots.some((s) => s.start === iso(11) && s.end === iso(11, 15))).toBe(true);
  });

  it('accepts blockers in arbitrary order', () => {
    const slotsAsc = computeFreeSlots(DAY_START, DAY_END, [
      { start: iso(10), end: iso(11) },
      { start: iso(14), end: iso(15) },
    ]);
    const slotsDesc = computeFreeSlots(DAY_START, DAY_END, [
      { start: iso(14), end: iso(15) },
      { start: iso(10), end: iso(11) },
    ]);
    expect(slotsAsc).toEqual(slotsDesc);
  });

  it('returns empty when dayStart >= dayEnd', () => {
    expect(computeFreeSlots(DAY_END, DAY_START, [])).toEqual([]);
    expect(computeFreeSlots(DAY_END, DAY_END, [])).toEqual([]);
  });
});
