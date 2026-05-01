import { describe, it, expect } from 'vitest';
import { stubCalendarProvider } from '../calendar';

function dayBoundsIso(year: number, month: number, day: number): { dayStartIso: string; dayEndIso: string } {
  const start = new Date(year, month, day, 8, 0, 0, 0);
  const end = new Date(year, month, day, 20, 0, 0, 0);
  return { dayStartIso: start.toISOString(), dayEndIso: end.toISOString() };
}

describe('stubCalendarProvider', () => {
  it('returns 4 events inside a full workday window', async () => {
    const { dayStartIso, dayEndIso } = dayBoundsIso(2026, 4, 1);
    const events = await stubCalendarProvider.getEvents(dayStartIso, dayEndIso);
    expect(events).toHaveLength(4);
  });

  it('each event has start strictly before end', async () => {
    const { dayStartIso, dayEndIso } = dayBoundsIso(2026, 4, 1);
    const events = await stubCalendarProvider.getEvents(dayStartIso, dayEndIso);
    for (const e of events) {
      expect(new Date(e.start).getTime()).toBeLessThan(new Date(e.end).getTime());
    }
  });

  it('returns a stable set of ids across days', async () => {
    const a = await stubCalendarProvider.getEvents(
      ...Object.values(dayBoundsIso(2026, 4, 1)) as [string, string],
    );
    const b = await stubCalendarProvider.getEvents(
      ...Object.values(dayBoundsIso(2026, 5, 15)) as [string, string],
    );
    expect(a.map((e) => e.id).sort()).toEqual(b.map((e) => e.id).sort());
  });

  it('filters out events entirely outside the window', async () => {
    // Morning-only window that cuts off after the Q2 block starts.
    const day = new Date(2026, 4, 1);
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = new Date(day); end.setHours(8, 0, 0, 0);
    const events = await stubCalendarProvider.getEvents(start.toISOString(), end.toISOString());
    expect(events).toHaveLength(0);
  });
});
