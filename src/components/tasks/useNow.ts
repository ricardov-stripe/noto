import { useEffect, useState } from 'react';

/**
 * Returns the current Date, refreshed at `intervalMs` (default 60s). Used by
 * the Today Strip to move the NOW line as time passes without re-rendering
 * the whole tasks view on a faster tick.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
