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

Five families, organized by **surface** rather than role. The product has two surfaces:

- **Canvas** = the editor — *what you wrote*. Sacred space. Set in iA Writer DNA.
- **Chrome** = everything around it (sidebar, panels, buttons, status, metadata) — *what the app shows*. Set in Geist + Cabinet.

The change of surface (canvas `#FFFFFF` over chrome `#FAF7F2`) plus the change of type system together enforce the boundary. The canvas should feel like opening a serious writing tool; the chrome should feel like a quiet, modern app.

### The stack

| Surface | Role | Family | Weights | Use |
|---|---|---|---|---|
| Chrome | Display | **Cabinet Grotesk** | 700, 800 | Brand mark (`Noto.`), marquee headings, empty-state hero titles, marketing surfaces |
| Chrome | UI | **Geist** | 400, 500, 600 | Sidebar nav, buttons, panel labels, suggestion titles, dropdown items, settings |
| **Canvas** | **Body** | **iA Writer Quattro** | 400, 500, 700, italic 400 | **Note title, headings, body text, italic, bold — everything you typed** |
| Canvas | Inline mono | **iA Writer Mono** | 400, 500 | Inline `` `code` `` and code blocks *inside notes* (sibling family to Quattro) |
| Chrome | App mono | **Geist Mono** | 400, 500 | Due dates, keyboard shortcuts (`⌘N`), status pill labels, file paths, timestamps in metadata |

### The non-negotiable rule

> **What you wrote → iA family. What the app shows → Geist / Cabinet.**

This is the rule. Every typographic decision flows from it. Concretely:

- The **note title** is iA Writer Quattro Bold (it's part of what you wrote), not Cabinet Grotesk.
- **Headings inside notes** (H2, H3) are iA Writer Quattro Bold.
- **Inline code inside a note** is iA Writer Mono — sibling to Quattro, no flow break.
- The **editor meta line** (date · category · AI status) sits *inside* the canvas surface but is in Geist Mono — it's app metadata, not your writing. Visually muted, smaller, generous whitespace below before the title starts.
- **The two monos never appear in the same paragraph.** Canvas mono = iA Mono. Chrome mono = Geist Mono. They live on different surfaces.

### Loading (self-host, do not CDN)

All five fonts are MIT/OFL/SIL — fully ship-clean and self-hostable. Self-hosting is a hard requirement: it removes CDN privacy concerns, eliminates cold-start latency, and matches Noto's local-first ethos (the app must work offline).

Pull the woff2 files into `public/fonts/` and declare with `@font-face`. Subset to Latin. Total over-the-wire ~140 KB.

Sources for the woff2 files:
- **iA Writer Quattro / Mono** — [github.com/iaolo/iA-Fonts](https://github.com/iaolo/iA-Fonts) (MIT)
- **Geist / Geist Mono** — [vercel.com/font](https://vercel.com/font) or `@fontsource/geist-sans` + `@fontsource/geist-mono` (SIL OFL)
- **Cabinet Grotesk** — [fontshare.com/fonts/cabinet-grotesk](https://www.fontshare.com/fonts/cabinet-grotesk) (Indian Type Foundry, free for commercial)

Preload the canvas body font (iA Writer Quattro Regular) in `index.html` — that's the one users will see first when they open a note. Other weights `font-display: swap`.

### Modular scale (1.25 ratio)

12 / 14 / 16 / 20 / 24 / 32 / 48 / 64 px

### Canvas typesetting (non-negotiable for the writing surface)

- `font-family: 'iA Writer Quattro', ui-monospace, Menlo, monospace`
- `font-size: 17px`, `line-height: 1.65`, `max-width: 64ch`
- `text-rendering: optimizeLegibility`
- `font-feature-settings: 'liga', 'kern'`
- Real italics, never CSS-faked
- Justified text is banned — left-aligned, ragged right, always
- Note title at 28px / 1.2 / weight 700
- H2 at 19.5px / 1.3 / weight 700, with 1.4em top margin
- Inline code in iA Writer Mono, `--accent-soft` background, `--accent-ink` text, `0.9em`

### Chrome typesetting

- UI body: Geist 13px / 1.5 / weight 400, weight 500 for active states
- Nav labels (section headers): Geist Mono 10px uppercase, 0.12em letter-spacing, `--soft` color
- Buttons: Geist 13px / weight 500
- Status pills: Geist Mono 9px uppercase, 0.06em letter-spacing
- Due dates / shortcuts: Geist Mono 10–11px, `--muted` color
- Brand mark: Cabinet Grotesk 22px / weight 800 / -0.02em tracking

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
| 2026-04-19 | Type system reworked via /design-shotgun (typography track) | Anchored on iA Writer's "calm reading surface" reference. Final hybrid stack: Cabinet Grotesk (display chrome) + Geist (UI chrome) + Geist Mono (chrome mono) + iA Writer Quattro (canvas body) + iA Writer Mono (canvas inline mono). Body shootout compared iA Quattro vs Literata vs Newsreader vs Lora; iA Quattro chosen for: (1) unmistakable iA Writer feel — signals "serious writing tool", (2) sibling pairing with iA Writer Mono inside notes — code never breaks the flow, (3) monospace-derived rhythm gives sustained reading the calm cadence a notes app needs. General Sans, Source Serif 4, JetBrains Mono dropped from the stack. |
