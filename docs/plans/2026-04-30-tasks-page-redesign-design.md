# Tasks Page Redesign — Design Doc

**Date:** 2026-04-30
**Status:** Approved (brainstorming)
**Approach:** B — Linear-style power list (single dense list with serious controls)

## Problem

The current Tasks page (`src/components/TaskListView.tsx`) is a flat three-group list (To Do / In Progress / Done) with checkbox, title, source-text snippet, priority pill, due date, and a "View note" link. It has no filters, no sort, no smart views, no inline editing, no manual task creation, no keyboard navigation, and no search — even though `CLAUDE.md` calls for it to be "filterable by priority, due date, source note." The page is read-only in practice; users have no fast way to triage, edit, or manage tasks at scale.

## Goals

- Triage and edit tasks at speed, keyboard-first.
- Manually add tasks (today they only come from AI extraction).
- Slice tasks by status, priority, due, and source note.
- Honor `DESIGN.md` strictly — quiet, dense, no anti-patterns.
- Reuse existing API and storage; one targeted schema migration.

## Non-goals (post-MVP)

Saved views; drag-to-reorder; drag-to-time-block onto calendar; recurring tasks; sub-tasks; attachments; rich-text descriptions; sharing; multi-user; smart-view tabs (Today/Upcoming).

## Approach (chosen)

Single page, single dense list, with a top quick-add bar and a thin control row (search, filter, sort, group-by). Multi-select drives a slide-in bulk-action bar. All row interactions are inline (no modals for routine work). Source-note context shows on hover via a peek popover, and the source-note pill replaces the current "View note" button. Manual tasks become first-class (small schema change).

Approaches considered and rejected:
- **A — Things 3 smart views + drawer**: calmer mental model, but lacks the slicing power requested.
- **C — Hybrid (smart views + power controls + calendar slot strip)**: most ambitious; deferred. The smart-view layer can be added later as saved-URL chips on top of B.

## Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  TASKS                                              12 OPEN · 8 DONE         │
│  ─────────────────────────────────────────────────────────────────────────   │
│  + Add task… (try "Send Q2 report Fri !high")                          [↵]   │
│  ─────────────────────────────────────────────────────────────────────────   │
│  /search…    [ status: open ▾ ] [ priority ▾ ] [ due ▾ ] [ note ▾ ]          │
│              sort: due ↑ ▾    group: status ▾                                │
│  ─────────────────────────────────────────────────────────────────────────   │
│  TO DO  · 7                                                                  │
│  ☐  ●hi  Send Q2 report to Sarah                       FRI · meeting-notes   │
│  ☐  ●md  Reply to Marcus about contract review         MON · client-emails   │
│  ☐  ●lo  Sketch landing hero variations                — · ideas             │
│                                                                              │
│  IN PROGRESS · 2                                                             │
│  ◐  ●hi  Migrate billing tables                        OVERDUE · infra       │
│  ◐  ●md  Refactor extraction prompt                    TODAY  · ai-notes     │
│                                                                              │
│  DONE · 8  (collapsed)                                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

When ≥1 row is selected, a slide-in strip appears under the controls:

```
3 SELECTED   [ Complete ]  [ Set due… ]  [ Set priority… ]  [ Delete ]   ✕
```

- The current `sourceText` snippet is removed from the row — it bloated rows and rarely helped. It moves to the source-note hover-peek and to the (optional) inline description expansion.
- The current "View note" button is replaced by a slug-style **source-note pill**, also clickable.
- Group headers are always visible; the `Done` group is collapsed by default; collapse state persists per group via `localStorage`.

## Quick-add bar

Always visible above the controls. Focusable with `c` or click. `Enter` parses, creates, clears, refocuses (rapid sequential add).

Deterministic NL parser (no LLM call):

| Token | Meaning | Examples |
|---|---|---|
| `!high` `!h` `!med` `!m` `!low` `!l` | Priority (default `medium`) | `!h`, `!high` |
| Bare date words | Due date | `today`, `tomorrow`, `mon`–`sun`, `next mon`, `fri`, `next week` |
| `MM/DD` or `MMM D` | Explicit due date | `12/3`, `dec 3`, `apr 30` |
| `#note-slug` | Pin to existing source note (autocomplete) | `#meeting-notes` |
| Everything else | Title | — |

A ghost preview line under the input shows what was parsed *before* `Enter`:

```
+ Send Q2 report to Sarah !h fri #meeting-notes
  → "Send Q2 report to Sarah"  ●high · FRI · meeting-notes
```

`⌘↵` skips parsing and creates a literal-title task with defaults. `Esc` clears the input but keeps focus.

Edge cases: empty string → no-op; title-only → manual task; conflicting tokens → last wins; ambiguous past-date weekday → resolves forward; no `#note` → manual task (no source note).

## Controls

| Control | Behavior |
|---|---|
| **Search** (`/`, Esc clears) | Live substring match, case-insensitive, against `title` and `sourceText`. |
| **Status filter** | Multi-select: todo, in_progress, done; pseudo-value `open` = todo + in_progress. Default: `open`. |
| **Priority filter** | Multi-select: high, medium, low. Default: any. |
| **Due filter** | Multi-select: overdue, today, this week, later, none. Default: any. |
| **Note filter** | Autocomplete picker over notes that have tasks, plus `Manual`. Default: any. |
| **Sort** (single) | due ↑/↓, priority ↑/↓, created ↑/↓, title A→Z. Default: `due-asc` (overdue first, no-due last). |
| **Group by** (single) | status, due bucket, priority, source note, none. Default: `status`. |

Active (non-default) filter chips get a 2px `--accent` left border, no fill change. Group header order is fixed per group-by choice.

State persists in two places:
- **URL hash** for bookmarkability and back-button: `#tasks?q=…&status=open&prio=high,med&due=this-week&note=12&sort=due-asc&group=status`.
- **`localStorage`** keyed `noto:tasks:view-state` for next session. URL > localStorage > defaults precedence on hydrate. Invalid params silently fall back.

The header meta line updates live: `12 OPEN · 8 DONE` becomes `3 SHOWN · 12 OPEN · 8 DONE` when filters narrow the result; clicking the `SHOWN` pill clears all filters.

## Row interactions

Row anatomy (in order, `gap: 8px`):

1. **Checkbox** (16×16, 4px radius). Click cycles `todo → in_progress → done → todo`. `done` shows a check; `in_progress` shows a half-fill ring.
2. **Priority dot** (6px). Click opens `High / Medium / Low / —` popover.
3. **Title** — Geist 13/400. Single click selects row; double click or `Enter` enters in-place edit. `Enter` saves, `Esc` cancels, `Tab` saves and moves focus to the due chip. Empty save = revert.
4. **Due chip** — Geist Mono 10 uppercase. Click opens popover: `Today, Tomorrow, This weekend, Next week, Pick a date…, No date`. Custom date uses native `<input type="date">`. Overdue chip rendered with `--error` text on `--accent-soft` ground.
5. **Source-note pill** — slug-style. Click navigates to the note (current behavior). Hover (300 ms) opens a peek: note title + 4-line excerpt around `sourceText` with the source phrase highlighted in `--accent-soft`. Manual tasks render a muted `manual` chip with no peek. Orphaned tasks (note deleted) render a muted `note deleted` chip with no peek.
6. **`⋯` overflow** (16px, opacity 1 on hover/focus): `Edit description`, `Duplicate`, `Copy as markdown`, `Delete`. Description editing happens inline below the row in iA Writer Quattro 14px (continuous with the writing surface).

Done rows: title color is `--text-muted`. **No strikethrough** (noise, breaks scan).

## Selection & bulk actions

- Click empty row space → exclusive select.
- Shift+Click → range from last anchor.
- ⌘/Ctrl+Click → toggle in/out of selection.
- `x` → toggle on focused row. `⌘A` → select all visible. `Esc` → clear.

When `selection.size > 0`, the bulk-action bar slides in (220 ms) under the controls:
- `Complete` → status `done`. If all selected are done, the button becomes `Reopen` (status `todo`).
- `Set due` / `Set priority` open the same popovers as on the row.
- `Delete` requires confirm if any selected has a non-empty description or there are >5 rows; otherwise deletes immediately with a 6-second undo toast (existing toast pattern from suggestion dismiss).
- `✕` or `Esc` clears selection.
- Operations dispatch sequential `tasks.update` / `tasks.delete` calls, optimistically update locally, roll back affected rows on failure with a single error toast.

## Keyboard model

There's always exactly one *focused* row (visual ring in `--accent`, no background change), and zero or more *selected* rows (`--accent-soft` background). Focus moves with `j/k`; selection toggles with `x`.

**Global on Tasks page**

| Key | Action |
|---|---|
| `c` | Focus quick-add |
| `/` | Focus search |
| `g` then `t` | Jump to Tasks |
| `?` | Cheatsheet overlay |

**List navigation**

| Key | Action |
|---|---|
| `j` / `↓` | Focus next row |
| `k` / `↑` | Focus previous row |
| `J` / `K` | Focus next/previous group header |
| `Home` / `End` | First / last row |
| `Space` (group focused) | Toggle collapse |

**Per row** (operate on focused row, or all selected if any are selected)

| Key | Action |
|---|---|
| `Enter` | Edit title |
| `e` | Edit description (inline expansion) |
| `x` | Toggle selection |
| `⌘A` | Select all visible |
| `Esc` | Clear selection / exit edit |
| `Space` | Cycle status |
| `1` / `2` / `3` | Priority high / medium / low |
| `0` | Clear priority → medium |
| `t` / `T` / `w` / `n` | Due → today / tomorrow / this weekend / next week |
| `d` | Open due popover |
| `r` | Clear due |
| `o` | Open source note |
| `⌘D` | Duplicate |
| `⌫` / `Delete` | Delete (with undo toast) |

**In edit mode**

| Key | Action |
|---|---|
| `Enter` | Save & exit |
| `⇧Enter` (description) | Newline |
| `Esc` | Cancel & revert |
| `Tab` | Save and focus due chip |

**In quick-add**

| Key | Action |
|---|---|
| `Enter` | Parse & create; clear; refocus |
| `⌘Enter` | Create literal title (skip parsing) |
| `Esc` | Clear input, keep focus |
| `↓` | Move focus into list |

A first-run tip strip under the controls: `Tip: c to add, / to search, j/k to move, x to select. Press ? for more.` Dismissed forever after click or `Esc`.

Accessibility: every chip and popover is a real `<button>` with `aria-label` and `aria-expanded`; group headers are `<h2>` with `aria-level`; the list is `role="list"`, rows `role="listitem"` with `aria-selected`; a live region announces bulk-action results.

## States, errors, voice

**Loading.** No loading state for the list itself — `App.tsx` already owns `tasks`. Mutating rows dim to 0.6 opacity, snap back on success, snap back + toast on failure. Quick-add inserts an optimistic row with a faint `--accent` left border for 400 ms; on failure the row vanishes and the input refills with the original text and an error line: `Couldn't add task. Try again.`

**Empty states** (Cabinet Grotesk hero, Geist 13 body, no illustration):

| Situation | Copy |
|---|---|
| Zero tasks ever | `No tasks yet.` / `Write a note and Noto will find them. Or press c to add one.` |
| Filters yield zero rows | `Nothing matches.` / `[ Clear filters ]` |
| Group empty within active view | `Empty` (`--text-soft`, italic) |
| All open done in default view | `Inbox zero.` / `Nice. Done count: 8.` |

**Errors** (extending CLAUDE.md):

| Failure | Behavior |
|---|---|
| `tasks.update` fails | Row reverts; toast: `Couldn't save. Retrying…` Auto-retry every 5 s ×3, then `Saved locally — will sync when reachable.` |
| `tasks.create` fails | See quick-add behavior. |
| `tasks.delete` fails | Row reappears; toast: `Couldn't delete. Try again.` |
| Migration fails on app start | Existing surfacing in `database.ts`; tasks page shows `Couldn't load tasks.` with a Retry button. |
| Source note no longer exists | Pill renders as `note deleted` muted chip; we do not auto-delete the task. |
| Invalid URL hash | Silently fall back to defaults. |

**Voice** (extending DESIGN.md): plain present tense; verbs over nouns (`Add task`, `Set due`); no exclamation marks; no emojis; no "successfully"; toasts only for undo-able destructive actions, bulk completions over 3 rows, and explicit failures. The Tasks page never says "AI" or "extracted" — the source-note pill carries that meaning implicitly.

## Visual spec (DESIGN.md compliance)

Every value resolves to an existing token in `app.css`. No new colors, no new fonts.

**Page frame.** View root `padding: var(--s-lg) var(--s-xl)`; max content width 880px, centered. Tasks is chrome — no 64ch editor measure. Header: `Tasks` in Cabinet Grotesk 700 / 32px (the only Cabinet moment on the page). Right meta line in Geist Mono 10 uppercase, `--text-soft`, 0.12em tracking. Bottom border `--border-soft`.

**Quick-add bar.** Height 40px, `--surface`, `--border` 1px, `--radius-md`, padding `0 var(--s-md)`. Input Geist 14/400; placeholder `--text-soft`. Ghost preview Geist Mono 11, `--text-muted`, 4px gap. Focus state: 1px `--accent` border, no glow.

**Control bar.** Single row, gap `var(--s-sm)`; wraps to two rows below 720px. Search 28px tall, 220px wide. Filter/sort/group buttons 28px tall, padding `0 var(--s-sm)`, Geist 13/500, `--surface`, `--border`, `--radius-sm`. Caret in `--text-soft`. Active filter (non-default) gets a 2px `--accent` left border.

**Popovers.** `--surface`, `--border`, `--radius-md`, soft warm shadow `0 8px 24px rgba(31,27,22,0.08)`, 6px padding. Items 24px tall, Geist 13.

**Group header.** 24px tall, `--text-muted`, Geist Mono 10 uppercase, 0.12em. Format `TO DO  ·  7`. Caret rotates 90° when collapsed. Border-bottom `--border-soft`. Top margin `var(--s-md)` between groups; `0` for the first.

**Row.** 32px tall (denser than today), padding `0 var(--s-sm)`. Hover `--surface-alt`. Focus: 1px inset ring in `--accent`, no bg change. Selected: `--accent-soft` bg. Done: title `--text-muted`, no strikethrough. Overdue: title color unchanged; due chip carries it.

**Row chips.** Checkbox 16×16, 4px radius, 1px `--border`; checked = `--accent` fill with `--surface` glyph; in-progress = 1.5px `--accent` ring around empty inner. Priority dot 6px (high `--error`, medium `--warning`, low `--text-soft`); grows to 8px on hover. Title Geist 13/400, `--text`; inline edit becomes a transparent input with the same metrics. Due chip Geist Mono 10 uppercase, `--text-muted`; today/tomorrow `--accent-ink`; overdue `--error` text on `--accent-soft` 4px-radius pill (`2px 4px` padding). Source-note pill Geist Mono 10 lowercase, `--text-muted`, `--surface-alt`, `9999` radius, `1px 6px`. Manual chip same shape, `--text-soft`, no hover. `⋯` overflow 16px, opacity 1 only on row hover/focus.

**Bulk-action bar.** Slide-in below controls, 36px tall, `--surface-alt`, no border. Count label Geist Mono 11 uppercase, `--text-muted`. Buttons 24px tall, Geist 13/500, transparent bg, hover `--surface`. `Delete` button: `--error` text, no fill.

**Source-note peek.** 360×auto, padding `var(--s-md)`, `--surface`, `--border`, `--radius-md`, warm shadow. Note title in iA Writer Quattro Bold 14 (canvas-of-canvas — what the user wrote). Excerpt iA Writer Quattro 13/1.5, max 4 lines, ellipsis on last; `sourceText` span `--accent-soft` background.

**Cheatsheet (`?`).** Centered modal 480px, `--surface`, `--radius-lg`, warm shadow. Two columns of `key → action`, Geist Mono 11. Headers Geist Mono 10 uppercase.

**First-run tip.** 28px row above the list, `--accent-soft`, Geist 12 `--accent-ink`, `✕` on the right.

**Anti-pattern audit.** No purple/violet; no sparkle/wand icons; AI status pulse stays in the editor's task panel; no spinners (loading = row dim + optimistic); no toasts for routine saves; no icon-in-circle; chrome uses Geist Mono only, iA Mono only inside the source-note peek if the excerpt contains inline code; shadows only on floating elements (popovers, peek, modal) — none on rows or cards.

## Architecture

New directory `src/components/tasks/`:

```
src/components/tasks/
  TasksView.tsx
  QuickAddBar.tsx
  ControlBar.tsx
  BulkActionBar.tsx
  TaskGroup.tsx
  TaskRow.tsx
  DuePopover.tsx
  PriorityPopover.tsx
  SourceNotePeek.tsx
  CheatsheetOverlay.tsx
  parseQuickAdd.ts
  taskFilters.ts
  useTasksViewState.ts
```

`TasksView` replaces the current `TaskListView`. The old file is removed once the new view ships green. `App.tsx` swap is a one-line component change.

State model — single reducer, no Redux/Zustand:

```ts
type ViewState = {
  search: string;
  status: ('todo' | 'in_progress' | 'done')[];
  priority: ('high' | 'medium' | 'low')[];
  due: ('overdue' | 'today' | 'this-week' | 'later' | 'none')[];
  noteIds: (number | null)[];   // null = manual
  sort: 'due-asc' | 'due-desc' | 'prio-asc' | 'prio-desc' | 'created-asc' | 'created-desc' | 'title-asc';
  group: 'status' | 'due' | 'priority' | 'note' | 'none';
  collapsed: Record<string, boolean>;
  selection: Set<number>;
};
```

Hydrate order on mount: URL > `localStorage` > defaults. Writes: URL on every change (debounced 100 ms), `localStorage` on every change. Selection is not persisted.

**Data flow.** `tasks` continues to live in `App.tsx`; `TasksView` receives it as a prop and applies filter/sort/group purely. Mutations call existing `api.tasks.*` and update locally optimistically; on 4xx/5xx, revert and toast. `App.tsx` already refetches on mutation — no orchestration change.

**Backend changes** — minimal:
1. SQLite migration in `electron/database.ts` `initSchema`: detect via `PRAGMA table_info(tasks)`; if `sourceNoteId notnull = 1`, run a transactional table-rebuild dropping `NOT NULL`. Idempotent. Backup `tasks.db.bak.<timestamp>` before first migration.
2. `Task.sourceNoteId` becomes `number | null` in `electron/database.ts` and `src/api.ts`.
3. `POST /api/tasks` accepts `sourceNoteId: null` and `sourceText: ''`.
4. No new endpoints.

## Testing

| Layer | Coverage |
|---|---|
| Unit `parseQuickAdd.test.ts` | Each token, multiple priorities, ambiguous dates, empty input, `⌘↵` escape flag, `#note` autocomplete miss/hit (~25 cases). |
| Unit `taskFilters.test.ts` | Each filter, combinations, sort tie-breakers, group ordering (~20 cases). |
| Unit `useTasksViewState.test.ts` | URL ↔ state round-trip; localStorage rehydrate; precedence; invalid URL silent default. |
| Component `TasksView.test.tsx` | Render with sample tasks; toggle status; quick-add creates; bulk-select 3 → complete updates all; keyboard `j/k/x/Enter/Esc`; live search filter. |
| Component `TaskRow.test.tsx` | Inline edit save/cancel/revert; due popover; priority popover; overflow menu; orphan source-note rendering. |
| Backend (`database.test.ts`) | Migration is idempotent; `createTask` accepts `null` source note; `listTasks` returns mixed manual + extracted rows. |
| Manual QA | First-run tip shows once; URL deep-links restore state; cheatsheet overlay; reduced-motion respects on slide-in; high-density scroll perf with 500 fake tasks. |

## Performance

Plain DOM, no virtualization initially. 500 rows × 32 px = 16 000 px — fine in modern browsers. Virtualization (`@tanstack/react-virtual`) added only if profiling shows a problem. Filter/sort/group memoized on `(tasks, viewState)`.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| NL parser is "almost right" and frustrates more than helps | Conservative tokens only; ghost preview shows parse before `Enter`; `⌘↵` always escapes. |
| 32px row height feels too dense | Density toggle is an easy add later; ship dense and listen. |
| Schema migration breaks an existing user's DB | Wrap in transaction; idempotent check; backup file copied to `tasks.db.bak.<timestamp>` before first migration. |
| Optimistic updates desync from server on failure | All mutations carry a rollback closure; on rejection restore the prior task verbatim; single error toast (not per-row). |

## Open questions (none currently)

All questions resolved during brainstorming. Ready for implementation planning.
