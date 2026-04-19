import { describe, it, expect } from 'vitest';
import { parseCalendarEvents, findFreeSlots } from '../calendar';

describe('calendar', () => {
  describe('parseCalendarEvents', () => {
    it('parses icalBuddy-style output into events', () => {
      const output = `Team standup
        2026-04-18 at 09:00 - 09:30
    Design review
        2026-04-18 at 14:00 - 15:00`;
      const events = parseCalendarEvents(output);
      expect(events).toHaveLength(2);
      expect(events[0].title).toBe('Team standup');
      expect(events[0].startHour).toBe(9);
      expect(events[0].endHour).toBe(9.5);
    });
  });

  describe('findFreeSlots', () => {
    it('finds gaps between events in a workday', () => {
      const events = [
        { title: 'Meeting', date: '2026-04-18', startHour: 10, endHour: 11 },
        { title: 'Lunch', date: '2026-04-18', startHour: 12, endHour: 13 },
      ];
      const slots = findFreeSlots(events, '2026-04-18', 9, 17);
      expect(slots).toEqual([
        { start: 9, end: 10 },
        { start: 11, end: 12 },
        { start: 13, end: 17 },
      ]);
    });

    it('returns full workday when no events', () => {
      const slots = findFreeSlots([], '2026-04-18', 9, 17);
      expect(slots).toEqual([{ start: 9, end: 17 }]);
    });
  });
});
