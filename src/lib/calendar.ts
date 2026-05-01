/**
 * Calendar provider abstraction.
 *
 * For MVP we ship a deterministic `stubCalendarProvider` so the UI can be
 * built, tested, and demoed without any external integration. The same
 * interface will be implemented by a real Google Calendar provider in a
 * follow-up project; no UI changes required at that point.
 */

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
}

export interface CalendarProvider {
  getEvents(dayStartIso: string, dayEndIso: string): Promise<CalendarEvent[]>;
}

/**
 * Deterministic "a typical workday" stub used by the Today Strip until real
 * Google Calendar lands. Events are anchored to midnight of the day that
 * `dayStartIso` falls on, so the same fixture applies to whatever day is
 * currently rendered.
 */
export const stubCalendarProvider: CalendarProvider = {
  async getEvents(dayStartIso, dayEndIso) {
    const day = new Date(dayStartIso);
    day.setHours(0, 0, 0, 0);
    const at = (h: number, m = 0): string => {
      const d = new Date(day);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };
    const events: CalendarEvent[] = [
      { id: 'stub-standup', title: 'Standup', start: at(9, 0), end: at(9, 30) },
      { id: 'stub-q2', title: 'Q2 deck review', start: at(10, 0), end: at(12, 0) },
      { id: 'stub-prs', title: 'PR reviews', start: at(14, 0), end: at(15, 0) },
      { id: 'stub-11', title: '1:1 with Sam', start: at(16, 30), end: at(17, 30) },
    ];
    return events.filter((e) => e.end > dayStartIso && e.start < dayEndIso);
  },
};
