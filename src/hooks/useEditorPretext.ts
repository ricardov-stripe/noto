import { useCallback, useEffect, useRef, useState } from 'react';
import { prepare, layout, type PreparedHandle } from '../lib/pretext.js';

/**
 * Stats reported by the layout pass. `ready` is false until at least one
 * `[data-pretext]` element has been measured successfully.
 */
export interface PretextStats {
  blockCount: number;
  lineCount: number;
  totalHeight: number;
  width: number;
  ready: boolean;
}

const EMPTY_STATS: PretextStats = {
  blockCount: 0,
  lineCount: 0,
  totalHeight: 0,
  width: 0,
  ready: false,
};

/**
 * Wires Pretext into a React tree. For every element under `rootRef` that
 * carries `data-pretext`, the hook:
 *   1. waits for `document.fonts.ready` so font metrics are stable,
 *   2. calls `prepare(text, font)` once per element,
 *   3. re-runs `layout(handle, width, lineHeight)` whenever the element's
 *      text changes (MutationObserver) or the root resizes (ResizeObserver),
 *   4. returns aggregated stats so callers can show line counts, etc.
 *
 * Pretext fails gracefully on environments without OffscreenCanvas (e.g.
 * jsdom in tests) — the hook simply returns EMPTY_STATS.
 */
export function useEditorPretext(rootRef: React.RefObject<HTMLElement | null>): PretextStats {
  const [stats, setStats] = useState<PretextStats>(EMPTY_STATS);
  const prepared = useRef<WeakMap<HTMLElement, PreparedHandle>>(new WeakMap());
  const rafRef = useRef<number | null>(null);

  const fontFor = useCallback((el: HTMLElement) => {
    const cs = getComputedStyle(el);
    return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  }, []);

  const lineHeightFor = useCallback((el: HTMLElement) => {
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight);
    if (!isNaN(lh) && lh > 0) return lh;
    return parseFloat(cs.fontSize) * 1.4;
  }, []);

  const prepareEl = useCallback(
    (el: HTMLElement) => {
      const text = (el.textContent || '').trim();
      if (text.length === 0) {
        prepared.current.delete(el);
        return;
      }
      try {
        prepared.current.set(el, prepare(text, fontFor(el)));
      } catch {
        // OffscreenCanvas unavailable — skip this element.
      }
    },
    [fontFor]
  );

  const relayout = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-pretext]'));
    let totalHeight = 0;
    let lineCount = 0;
    let measured = 0;
    let width = 0;
    for (const el of elements) {
      const handle = prepared.current.get(el);
      if (!handle) continue;
      const w = el.clientWidth;
      if (w === 0) continue;
      try {
        const result = layout(handle, w, lineHeightFor(el));
        totalHeight += result.height;
        lineCount += result.lineCount;
        measured++;
        width = w;
      } catch {
        // ignore per-element measurement failures
      }
    }
    setStats({ blockCount: measured, lineCount, totalHeight, width, ready: measured > 0 });
  }, [lineHeightFor, rootRef]);

  const scheduleRelayout = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      relayout();
    });
  }, [relayout]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observers: Array<MutationObserver | ResizeObserver> = [];
    let cancelled = false;

    const init = async () => {
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        try { await document.fonts.ready; } catch { /* noop */ }
      }
      if (cancelled) return;

      const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-pretext]'));
      for (const el of elements) {
        prepareEl(el);
        if (el.isContentEditable || el.closest('[contenteditable]')) {
          const mo = new MutationObserver(() => {
            prepareEl(el);
            scheduleRelayout();
          });
          mo.observe(el, { characterData: true, subtree: true, childList: true });
          observers.push(mo);
        }
      }

      // A single ResizeObserver on the root catches both window and pane resizes.
      // jsdom (test env) doesn't provide ResizeObserver; skip silently.
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => scheduleRelayout());
        ro.observe(root);
        observers.push(ro);
      }

      relayout();
    };

    init();

    return () => {
      cancelled = true;
      for (const obs of observers) obs.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [prepareEl, relayout, rootRef, scheduleRelayout]);

  // Re-prepare elements when their content changes from the outside (e.g. a
  // different note loads). We do this by invalidating the WeakMap and asking
  // for a fresh layout. Done via a sentinel that observes data-pretext
  // attribute additions.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const mo = new MutationObserver((records) => {
      let dirty = false;
      for (const rec of records) {
        if (rec.type === 'childList') {
          rec.addedNodes.forEach((n) => {
            if (n instanceof HTMLElement) {
              const els = n.matches('[data-pretext]') ? [n] : Array.from(n.querySelectorAll<HTMLElement>('[data-pretext]'));
              for (const el of els) {
                prepareEl(el);
                dirty = true;
              }
            }
          });
        }
      }
      if (dirty) scheduleRelayout();
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [prepareEl, rootRef, scheduleRelayout]);

  return stats;
}
