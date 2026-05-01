/**
 * Shared date-string helpers. Centralized here to avoid the local-vs-UTC
 * drift that was splitting "today" across timezones in earlier code paths.
 */

/**
 * YYYY-MM-DD in LOCAL time. Matches `dueBucket` convention and the way
 * users enter due dates via DuePopover ("today", "tomorrow").
 *
 * IMPORTANT: do not replace with `d.toISOString().slice(0,10)`. That is
 * UTC-based and will drift by one day near midnight for many timezones
 * (e.g. JST at 09:00 local is 00:00 UTC the SAME day, which is fine; but
 * JST at 01:00 local is 16:00 UTC the PREVIOUS day, which breaks "today").
 */
export function localDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
