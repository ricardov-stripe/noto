# Design System — Noto

> A writer's tool with quiet AI. The design system serves the writing first.

## Product Context
- **What this is:** Local-first notes app with AI-powered task and schedule extraction. Notes (Tiptap rich text), tasks (extracted via Anthropic SDK), calendar with free-slot detection.
- **Who it's for:** People who write to think — knowledge workers, makers, founders. Folks who want their data on their machine and want AI to work *for* them, not *on* them.
- **Space/industry:** Personal productivity / note-taking. Adjacent to Bear, Obsidian, Reflect, Mem, Tana, Things 3, Sunsama.
- **Project type:** Desktop app (Electron) with rich-text editor + side panel + multi-view (notes, tasks, schedule).

## Aesthetic Direction
- **Direction:** Editorial Quiet — a writer's personal tool with the craft of an indie studio. Closer to Bear and Reflect than to Linear or Notion.
- **Decoration level:** Minimal. Typography and paper-tone surfaces carry all visual weight. No gradients, no icon-in-circle treatments, no shimmer.
- **Mood:** Calm, considered, confident. Should feel like opening a well-bound notebook on a clean desk, not like opening a SaaS dashboard.
- **Reference sites researched:** Reflect (reflect.app), Bear (bear.app), Mem (mem.ai), Obsidian (obsidian.md), Tana (tana.inc), Linear (linear.app).

## Typography
Three families. Each has a clear role. Loaded from privacy-respecting CDNs (Bunny Fonts, Fontshare) consistent with Noto's local-first ethos.

- **Display** (app brand, marquee headings, empty-state titles): **Cabinet Grotesk** (800/700) — confident geometric sans with character. Used sparingly.
- **UI / Labels** (sidebar items, buttons, tabs, task panel, metadata): **General Sans** (400/500/600) — clean, distinctive, modern. The chrome.
- **Note body** (the editor — what you actually write into): **Source Serif 4** (400/600, italic 400) — paper-like, considered, makes writing feel like writing. The whole reason this is a serif: a notes app where the act of writing should feel different from filling out a form.
- **Mono / data / shortcuts**: **JetBrains Mono** (400/500) — for code blocks, inline `code`, keyboard shortcuts (`⌘N`), tabular numerals in due dates and counts.

**Loading:**
```html
<link rel="preconnect" href="https://fonts.bunny.net" />
<link rel="preconnect" href="https://api.fontshare.com" />
<link href="https://fonts.bunny.net/css?family=source-serif-4:400,400i,500,600,700&family=jetbrains-mono:400,500,600&display=swap" rel="stylesheet" />
<link href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,700,800&f[]=general-sans@400,500,600&display=swap" rel="stylesheet" />
```

**Modular scale (1.25 ratio):** 12 / 14 / 16 / 20 / 24 / 32 / 48 / 64 px.

**Note-body typesetting rules (non-negotiable for a writing surface):**
- `font-size: 17px`, `line-height: 1.65`, `max-width: 64ch`
- `text-rendering: optimizeLegibility`
- `font-feature-settings: 'liga', 'kern'`
- Real italics, never CSS-faked
- Justified text is a no — left-aligned, ragged right, always

## Color
- **Approach:** Restrained, warm-neutral, single grounded accent.
- **Risk taken:** Warm paper palette (instead of cool gray) + terracotta accent (instead of the category-default purple/violet for AI).

### Light mode
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FAF7F2` | App background (warm paper) |
| `--surface` | `#FFFFFF` | Editor canvas, cards, mockup chrome |
| `--surface-alt` | `#F4EFE6` | Hover states, code backgrounds, sidebar headers |
| `--text` | `#1F1B16` | Body text (warm near-black) |
| `--text-muted` | `#76705F` | Metadata, hints, secondary labels |
| `--text-soft` | `#A8A192` | Tertiary text, placeholder, dim icons |
| `--border` | `#E8E2D5` | Dividers, card borders |
| `--border-soft` | `#F0EBDF` | Subtle dividers (table rows) |
| `--accent` | `#B8451E` | Active state, CTA, AI moments (deep terracotta) |
| `--accent-soft` | `#F6E5DA` | Active background, AI suggestion pills |
| `--accent-ink` | `#6B2810` | Hover/pressed accent, accent text on light bg |

### Dark mode
| Token | Hex |
|---|---|
| `--bg` | `#1A1816` (warm ink) |
| `--surface` | `#232120` |
| `--surface-alt` | `#2A2724` |
| `--text` | `#ECE7DD` |
| `--text-muted` | `#908874` |
| `--text-soft` | `#6B6557` |
| `--border` | `#2D2A26` |
| `--border-soft` | `#26231F` |
| `--accent` | `#D26A3F` |
| `--accent-soft` | `#3A2418` |
| `--accent-ink` | `#F1B392` |

### Semantic
| Token | Light | Dark |
|---|---|---|
| `--success` | `#4D7A4D` | `#7AA87A` |
| `--warning` | `#C77B2A` | `#E5A056` |
| `--error` | `#9B3329` | `#D86459` |
| `--info` | `#466583` | `#7B96B8` |

**Dark mode strategy:** True redesign, not a tint. Surfaces shift to warm dark grays (not pure black). Accent saturates *up* slightly in dark mode (the warm bg eats some chroma). All semantic colors lighten ~15% for legibility.

**Hard rule:** No purple, no violet, no blue-purple gradients anywhere in the product. The accent does the AI-signaling job, in earth tones, on purpose.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable. The chrome uses tight 4px rhythm; the editor uses an 8px rhythm with 16-24px between sections.
- **Scale:** `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` px

CSS custom properties:
```css
--s-2xs: 2px; --s-xs: 4px; --s-sm: 8px; --s-md: 16px;
--s-lg: 24px; --s-xl: 32px; --s-2xl: 48px; --s-3xl: 64px;
```

## Layout
- **Approach:** Hybrid — strict grid for the app shell, editorial breathing room inside the editor.
- **Main shell:** 3-pane: sidebar `240px` / editor `flex` / task panel `320px`. Panels collapse below `900px`.
- **Editor measure:** Max content width `64ch` (~620px at 17px serif). The page can be wider; the text never sprawls.
- **Border radius (hierarchical):** `sm: 4px` (inputs, pills, code) · `md: 8px` (buttons, cards, suggestions) · `lg: 12px` (mockup chrome, modals) · `pill: 9999px` (tags, status chips)
- **Shadows:** Only used for floating elements (modals, dropdowns, mockup chrome). Never on inline cards. Soft, warm-tinted (rgba of `--text`), not pure black.

## Motion
- **Approach:** Minimal-functional. Motion exists to confirm state, never to perform.
- **Easing:** `enter: ease-out` · `exit: ease-in` · `move: cubic-bezier(0.32, 0.72, 0.24, 1)`
- **Duration:** `fast: 120ms` (hover, active) · `default: 180ms` (state change) · `slide: 220ms` (panel open/close)
- **The "AI thinking" moment:** Single slow pulse on the task panel's status dot (1.6s ease-in-out infinite), opacity 0.4 ↔ 1.0. No spinners. No shimmer. No "✨".

CSS:
```css
--motion-fast: 120ms ease-out;
--motion: 180ms ease-out;
--motion-slide: 220ms cubic-bezier(0.32, 0.72, 0.24, 1);
```

## Voice & UI Copy
- **Microcopy is plain and present-tense.** "Add task" not "Click here to add a task." "Saved." not "Your changes have been saved successfully."
- **AI is referred to functionally,** not anthropomorphized. "Suggestions" not "Noto thinks." "Extracted from this note" not "I found these for you."
- **Empty states explain, then invite.** "No tasks yet. Write a note and Noto will find them." not "Get started!"
- **Errors say what happened and what to do.** "Couldn't reach Anthropic. Saved locally — will retry when online." not "Something went wrong."

## Anti-patterns (banned in Noto)
- Purple/violet gradient anywhere
- Sparkle, star, or wand icons for AI
- Spinner-with-text "AI is thinking..." UI
- 3-column icon-in-circle feature grids
- Centered-everything marketing layouts
- Border-radius-of-everything bubbliness
- Stock-photo-style hero illustrations
- Toast notifications for routine actions (saving, etc.)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-19 | Initial system created via /design-consultation | Editorial-quiet aesthetic, warm paper palette, terracotta accent, Cabinet+General+Source Serif type stack. Three deliberate risks: warm vs cool, terracotta vs purple-violet, serif body vs sans body. |
