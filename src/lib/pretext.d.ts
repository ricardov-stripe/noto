/**
 * Type surface for ./pretext.js — TypeScript automatically pairs this
 * .d.ts with the sibling .js by filename. Do not rename without renaming
 * the .js too.
 *
 * Pretext (https://github.com/chenglou/pretext) is a small canvas-based
 * text-layout engine. We use the basic two-call pattern: prepare() once
 * per text+font, then layout() on every relayout. Sub-millisecond after
 * prepare.
 */

export interface PreparedHandle {
  readonly __pretext: true;
}

export interface LayoutResult {
  height: number;
  lineCount: number;
}

export function prepare(text: string, font: string): PreparedHandle;

export function layout(
  prepared: PreparedHandle,
  maxWidth: number,
  lineHeight: number
): LayoutResult;

export function clearCache(): void;
