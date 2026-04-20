/**
 * Inline SVG icons. All icons follow the same conventions:
 *   - 14×14 viewBox unless noted
 *   - currentColor stroke
 *   - 1.5px stroke-width, round caps + joins
 *
 * Inline (rather than a sprite or an icon-lib) because the set is small
 * and shipping no icon dependency is a feature.
 */

type IconProps = { className?: string };

export const IconSearch = (p: IconProps) => (
  <svg className={p.className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="14" height="14">
    <circle cx="6" cy="6" r="4" />
    <path d="M9 9l3 3" />
  </svg>
);

export const IconSun = (p: IconProps) => (
  <svg className={p.className ?? 'theme-icon'} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="7" cy="7" r="2.2" />
    <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1 1M10.2 10.2l1 1M2.8 11.2l1-1M10.2 3.8l1-1" />
  </svg>
);

export const IconMoon = (p: IconProps) => (
  <svg className={p.className ?? 'theme-icon'} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11.5 8.5A4.5 4.5 0 0 1 5.5 2.5a5 5 0 1 0 6 6z" />
  </svg>
);

export const IconPlus = (p: IconProps) => (
  <svg className={p.className ?? 'plus'} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M7 3v8M3 7h8" />
  </svg>
);

export const IconFolder = (p: IconProps) => (
  <svg className={p.className ?? 'icon'} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M2 4l1.5-1.5h3L8 4h4v7H2z" />
  </svg>
);

export const IconSettings = (p: IconProps) => (
  <svg className={p.className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" width="14" height="14">
    <circle cx="7" cy="7" r="2" />
    <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M2.8 11.2l1.4-1.4M9.8 4.2l1.4-1.4" />
  </svg>
);

export const IconNote = (p: IconProps) => (
  <svg className={p.className ?? 'icon'} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M3 2h6l2 2v8H3z" />
    <path d="M5 6h4M5 8.5h4" />
  </svg>
);

export const IconTask = (p: IconProps) => (
  <svg className={p.className ?? 'icon'} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="2.5" y="2.5" width="9" height="9" rx="1" />
    <path d="M4.5 7l1.5 1.5L9.5 5" />
  </svg>
);

export const IconCalendar = (p: IconProps) => (
  <svg className={p.className ?? 'icon'} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="2" y="3" width="10" height="9" rx="1" />
    <path d="M2 5.5h10M5 2v2M9 2v2" />
  </svg>
);

export const IconCheck = (p: IconProps) => (
  <svg className={p.className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
    <path d="M3 7l3 3 5-6" />
  </svg>
);
