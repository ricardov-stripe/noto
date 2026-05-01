# Tasks Page Redesign v2 — Approach C (Smart Views + Calendar) Design Doc

**Date:** 2026-05-01
**Status:** Approved (brainstorming)
**Approach:** C — Hybrid: smart-view tabs + power controls + Noto's calendar superpower
**Supersedes:** `docs/plans/2026-04-30-tasks-page-redesign-design.md` (Approach B — the single-page power list)

## Problem

The previous Tasks page redesign (Approach B, implemented on the abandoned `tasks-page-redesign` branch) shipped a power-user list with filters, multi-select, keyboard nav, and inline edit. It was technically complete but product-wrong in three ways:

1. **No workflow answer.** It's still a database. You can slice and sort, but the page never answers "what should I do now?"
2. **No Noto-ness.** Tasks originate from notes and need scheduling. B ignores both threads — no source-note context is made prominent (except a hover peek), and calendar is absent.
3. **Filters are a poor substitute for views.** Pretending that filter chips ("status: open + due: today") can replace an explicit Today view is a power-user convenience that asks the user to assemble their own workflow. Users don't want to assemble; they want to arrive.

## Goals

- Answer "what should I do today?" the moment the Tasks page opens.
- Route freshly-extracted tasks through an explicit triage inbox so nothing rots.
- Make calendar context visible and actionable — drag tasks onto free slots to time-block them.
- Preserve the power-user machinery from Approach B (search, filter, sort, group, inline edit, popovers, multi-select, keyboard nav) for when the user needs it.
- Honor DESIGN.md strictly.

## Non-goals (explicitly deferred)

- Real Google Calendar integration (separate future project — see "Calendar stub" below).
- Calendar write-back beyond the stub's in-memory state.
- Multi-day Upcoming timeline; resizable blocks; all-day events; conflict detection.
- Recurring tasks, sub-tasks, focus/pomodoro mode.
- Fix for the existing `ScheduleView` nav item (it will break when EventKit goes away; fixed when real GCal lands).

## Approach

Five tabs, each a distinct view shape, backed by shared filter/sort/group primitives:

```
[•] NEW    TODAY    UPCOMING    ALL    DONE
```

- **NEW** is the triage inbox — untriaged open tasks, regardless of source.
- **TODAY** is a Plate + Strip — today's tasks on the left, a 280px chronological day-strip on the right with events and free slots; drag plate → slot to time-block.
- **UPCOMING** is a planning view grouped by due bucket.
- **ALL** is the power-user list from Approach B (full ControlBar, multi-select, etc.).
- **DONE** is the archive, grouped by week.

Calendar integration is stubbed behind a `CalendarProvider` interface so the UI ships now and real Google Calendar drops in later without UI churn.

Approach C was chosen over B (single list) and A (Things 3 style drawer) because:
- A lacks the slicing power the user asked for.
- B lacks workflow (the original complaint).
- C gets both — explicit views for daily flow **and** the power list for power moments.

## Shell & tabs

### Layout

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  TASKS                                                         12 OPEN · 8 DONE     │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│  [•] NEW 5    TODAY 7    UPCOMING 12    ALL    DONE                                 │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│  + Add task… (try "Send Q2 report Fri !high")                                 [↵]   │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│  /search…                               [ priority ▾ ]   sort: smart ▾              │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│  ( tab-specific body )                                                              │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

- Page header `Tasks` in Cabinet Grotesk 700 / 32px; meta in Geist Mono 10 uppercase.
- **Tab strip** between header and quick-add. Tabs in Geist 13/500. Active tab gets a 2px `--accent` bottom border and `--text` color; inactive tabs `--text-muted`. Counts in Geist Mono 10 next to labels when non-zero.
- **NEW count** uses `--accent` color when `> 0` — the only place on the page that color pulls attention. Other tab counts stay `--text`.
- Quick-add bar and control bar persist across all tabs.
- On Tasks view, the note task panel is hidden (it's not relevant here; makes room for the 280px Strip on TODAY).
- App-level sidebar (240px) is unchanged.

### State & URL

`ViewState` gains one field: `tab: 'new' | 'today' | 'upcoming' | 'all' | 'done'`.

URL hash: `#tasks/<tab>?<refinements>` — e.g. `#tasks/today?prio=high,med`. `encodeView` / `decodeView` reflect the tab; invalid tab silently falls back to `today`.

Switching tabs:
- Replaces preset fields (status, due filters, sort, group).
- Preserves user refinements: `search`, `priority`, `noteIds`. These carry across tabs.
- Resets `selection`, `focusedId`.
- Applies the tab's default collapse state.

### Default landing tab

On first render:
1. If URL hash has a tab, use it.
2. Else if `NEW` has any untriaged tasks, land on `NEW`.
3. Else land on `TODAY`.
4. If both empty, still land on `TODAY` (it renders a calm "nothing today" state).

### Tab presets

| Tab | Filter | Default sort | Default group | Body shape |
|---|---|---|---|---|
| **New** | `status: open` + not triaged | `created-desc` | none | Flat list with bulk-triage CTAs |
| **Today** | `status: open` + `dueBucket ∈ [overdue, today]` ∪ (time-scheduled today) | `smart` | none (implicit sections) | Plate + Strip |
| **Upcoming** | `status: open` + `dueBucket ∈ [tomorrow, this-week, later]` | `due-asc` | `due` | Flat list |
| **All** | `status: open` | `due-asc` | `status` | Flat list |
| **Done** | `status: done` | `created-desc` (proxy for completedAt) | week-bucket | Flat list |

**Smart sort (Today only):** overdue first (by how overdue), then time-scheduled by chronological order, then today-due unscheduled by priority desc, then title. Pure function, tested.

## NEW tab — the triage inbox

### What counts as "New"

A task is New if **all** of:
1. `status == 'todo'`
2. Not triaged

"Triaged" means the user has performed any explicit action: status change, due-date set, priority change from default, title edit, scheduling. Implementation: the **heuristic** `task.status === 'todo' && task.updatedAt === task.createdAt`. The app already bumps `updatedAt` on every `tasks.update`, so any inline interaction naturally clears newness. Zero schema change. If this heuristic proves wrong in practice, upgrade to an explicit `triagedAt` column later (known follow-up, not blocking).

Scope: **AI-extracted AND manually-typed** tasks alike — if either is untriaged, it's New. A quick-add like `Send Q2 report fri !h` includes triage signals (due + priority) and goes straight to All; `Buy milk` (just title) lands in NEW until touched.

### Body

```
┌─────────────────────────────────────────────────────────────────────────┐
│  5 UNTRIAGED        last extracted 12 MIN AGO FROM meeting-notes         │
│  ─────────────────────────────────────────────────────────────────────  │
│  ☐  ●hi   Send Q2 report to Sarah                       + due — ⋯        │
│  ☐  ●md   Reply to Marcus about contract review         + due — ⋯        │
│  ☐  ●lo   Sketch landing hero variations                + due — ⋯        │
│  ☐  ●md   Migrate billing tables                        + due — ⋯        │
│  ☐  ●md   Refactor extraction prompt                    + due — ⋯        │
│                                                                          │
│  [ Triage all → Today ]    [ Dismiss all → Later ]                       │
└─────────────────────────────────────────────────────────────────────────┘
```

- Flat, newest first. No grouping (grouping defeats the purpose — this is a single batch to move through).
- The `+ due` affordance is prominent (not muted); tapping opens the due popover inline.
- Contextual meta line: if any New tasks have `sourceNoteId`, show "last extracted N MIN AGO FROM {note-title}". Clickable → opens the note.
- Bulk triage buttons at the bottom:
  - `Triage all → Today` sets `dueDate` to today for all visible rows.
  - `Dismiss all → Later` bumps `updatedAt` (without other changes) — silently moves them to All/Upcoming.
- Empty state: `Inbox zero.` Cabinet hero + Geist body. Calm.
- Row behavior otherwise identical to other tabs (inline edit, popovers, hover peek, overflow menu, multi-select).

## TODAY tab — Plate + Strip

### Layout

```
┌───────────────────────────────── TODAY ────────────────────────────────────────┐
│                                                                                 │
│  OVERDUE · 2                                                    │  YOUR DAY    │
│  ☐ ●hi  Migrate billing tables          OVERDUE · infra         │  ────────    │
│  ☐ ●md  Send Q2 report to Sarah         FRI · meeting-notes     │              │
│                                                                 │  9:00 ──     │
│  SCHEDULED · 3                                                  │  ▓▓ Standup  │
│  ☐ ●md   9:00 Standup prep              #team                   │  9:30 ──     │
│  ◐ ●hi  10:30 Draft Q2 deck             #strategy               │              │
│  ☐ ●md  14:00 Review PRs                manual                  │  ◌ 30 min    │
│                                                                 │              │
│  TODAY · 4                                                      │  10:00 ──    │
│  ☐ ●md  Reply to Marcus                 TODAY · client-emails   │  ▓▓ Q2 deck  │
│  ☐ ●lo  Water the plants                manual                  │              │
│  ☐ ●md  Follow up on Figma thread       manual                  │  12:00 ──    │
│  ☐ ●md  Book dentist                    manual                  │  ◌ 2h        │
│                                                                 │              │
│                                                                 │  ───NOW 14:32│
│                                                                 │  14:00 ──    │
│                                                                 │  ▓▓ PRs      │
│                                                                 │  15:00 ──    │
│                                                                 │  ◌ 1h 30m    │
│                                                                 │  16:30 ──    │
│                                                                 │  ▓▓ 1:1 Sam  │
│                                                                 │  17:30 ──    │
└─────────────────────────────────────────────────────────────────┴──────────────┘
```

### Plate (left, flex)

Three implicit sections, always in this order:
- **OVERDUE** (red-accent chip): `status: open` and `dueDate < today`. Hidden when empty.
- **SCHEDULED**: tasks whose `dueDate` falls *today* AND has a time component. Sorted by time. Row prefix: time in Geist Mono 10 uppercase. Includes in-progress tasks (`◐`).
- **TODAY**: tasks whose `dueDate` falls today WITHOUT a time component, or today-due tasks not yet scheduled. Sorted by priority desc, then title.

Group headers and row anatomy match Approach B. Sort/group controls are **hidden on Today** — the sections are the sort. Priority filter and search still work and refine live.

### Strip (right, 280px fixed)

Chronological day timeline (8:00–20:00 default):

- **Events** from `CalendarProvider.getEvents(todayStart, todayEnd)`. Solid blocks spanning their duration. Title in Geist 12, time in Geist Mono 10 uppercase. Background `--surface-alt`, 2px left border `--accent-ink`. Read-only.
- **Time-scheduled tasks** (`dueDate` has time, is today): same block shape, `◉` bullet prefix, left border `--accent`. Draggable to move; drag off the Strip to unschedule.
- **Free slots**: gaps between blocks. Dashed-border placeholder with duration label `◌ 30 min`, Geist Mono 10 `--text-muted`. Drop zone for drag-to-schedule.
- **NOW line**: thin `--accent` horizontal line labeled `NOW — 14:32`, updates every 60 seconds via a `useNow()` hook.
- **Hour gridlines**: every hour, `--border-soft`, 1px. Label `9:00`, `10:00` on left edge, Geist Mono 10.

### Drag-to-schedule

Drag source: the `⋮⋮` drag handle at far-left of Plate rows, visible on hover only (opacity 0 → 1).
Drop target: a free-slot tile.

On drop:
1. Task's `dueDate` is set to `slot.start` as a full ISO timestamp (`2026-05-01T14:00:00.000Z`).
2. Block duration: fixed 30 min. If the slot is smaller, block fills the slot.
3. Task moves from the Plate's Today section to Scheduled section; Strip re-renders with new block.
4. Undo toast (6 s): `Scheduled "X" at 14:00. Undo` — Undo reverts `dueDate` to its previous value.

Rejected drops (over an event or scheduled-task block): no-op with a `.reject` class on the hovered block as feedback.

**Edge cases:**
- Overdue task dragged → its `dueDate` becomes today at the slot time (effectively scheduling AND moving its due).
- Task already scheduled, dragged to another slot → its `dueDate` time-portion updates; date stays today.
- Dragging a task outside the Strip → no-op (the strip consumes the drop; otherwise nothing happens).

**Keyboard alternative:** `s` on a focused Plate row opens a small "Schedule at…" popover listing available 15-min increments within free slots. Enter confirms.

### Collapsed scheduled/due model

We use a single `dueDate` field for both concepts:
- `dueDate = '2026-05-01'` (or null time portion) → "due Friday" (date-only).
- `dueDate = '2026-05-01T14:00:00.000Z'` → "scheduled Friday 2 pm" (date + time).

Trade-off accepted: you can't express "due Friday, but I plan to do it Wednesday at 2pm". If needed later, add a separate `scheduledAt` column as a dedicated migration — nothing in this design paints us into that corner.

### What the Strip does NOT do (Phase C v1)

- No resize (duration handles).
- No write-to-calendar (stubbed). `dueDate` on the task is the only persisted state.
- No reordering events (events are read-only).
- No all-day events rendering.
- No multi-day view.

## UPCOMING, ALL, DONE

### UPCOMING

Planning view, grouped by due bucket.

```
TOMORROW · 3    (default expanded)
THIS WEEK · 5   (default expanded)
LATER · 8       (default expanded)
```

Default sort within each group: due-asc, priority-desc tiebreak. ControlBar is fully visible; user can override sort/group. No Strip.

### ALL

The power list from Approach B, preserved verbatim minus the Strip.

- Default: `status: open`, group by status, sort by due-asc.
- Full ControlBar, multi-select, bulk actions, keyboard nav.
- Done tasks hidden by default (they're on Done tab); user can override the filter to include them.

### DONE

Archive, grouped by completion-date bucket (`This week / Last week / Earlier` subdivided by month).

- Completion date is a proxy: `updatedAt` when `status == 'done'`. We don't track a dedicated `completedAt` field — acceptable for v1.
- Default sort: created-desc within each bucket.
- Voice: informational. "47 Earlier" is fine, calm.

## Calendar integration — stubbed

```ts
// src/lib/calendar.ts
export interface CalendarEvent { id: string; title: string; start: string; end: string; }

export interface CalendarProvider {
  getEvents(dayStartIso: string, dayEndIso: string): Promise<CalendarEvent[]>;
  // future: createEvent, deleteEvent, updateEvent
}

export const stubCalendarProvider: CalendarProvider = { /* deterministic stub */ };
```

The UI depends on `CalendarProvider` only; the stub is injected at the edge. When real Google Calendar lands (separate future project), a `googleCalendarProvider` replaces the stub with no UI changes.

Stub returns a deterministic set of events for "today" (Standup 9:00, Q2 deck 10:00–12:00, PRs 14:00–15:00, 1:1 16:30–17:30). Shifted to whatever `today` is at render time.

Free-slot computation lives in `src/lib/timeSlots.ts`: pure function `computeFreeSlots(dayStart, dayEnd, blockers, minSlotMin = 15) → TimeSlot[]`. Blockers = events + scheduled tasks. Tested with ~10 edge cases (empty, adjacent, overlapping, boundary, minSlot rejection).

## Data model

### Schema changes

**One migration — nullable `sourceNoteId`** (same as Approach B Phase 1). Cherry-picked from the abandoned `tasks-page-redesign` branch verbatim.

```sql
-- tasks.sourceNoteId INTEGER REFERENCES notes(id)     -- was NOT NULL; now nullable
```

**No other columns.** The collapsed scheduled/due decision means `dueDate` carries both concepts via presence of time component.

### Types

```ts
// Task (unchanged except for nullable sourceNoteId)
interface Task {
  id: number;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'done';
  dueDate: string | null;           // ISO8601 date OR datetime — date-only means "due", datetime means "scheduled"
  sourceNoteId: number | null;       // null = manual
  sourceText: string;
  createdAt: string;
  updatedAt: string;
}
```

### ViewState addition

```ts
type Tab = 'new' | 'today' | 'upcoming' | 'all' | 'done';

interface ViewState {
  tab: Tab;                          // NEW in v2
  search: string;
  status: StatusKey[];
  priority: PriorityKey[];
  due: DueBucket[];
  noteIds: (number | null)[];
  sort: SortKey;                     // includes new 'smart' option
  group: GroupKey;
  collapsed: Record<string, boolean>;
  selection: Set<number>;
}
```

## Reuse from the abandoned branch

Rather than rebuilding, we cherry-pick and modify. The abandoned `tasks-page-redesign` branch lives on as a reference tree.

| From branch | Plan |
|---|---|
| Phase 1 backend (nullable `sourceNoteId`, DB backup, tests) | Cherry-pick commits verbatim |
| `taskFilters.ts` | Port, add `triaged` predicate + `smart` sort |
| `useTasksViewState.ts` | Port, add `tab` field + new URL scheme |
| `parseQuickAdd.ts`, `QuickAddBar.tsx` | Port verbatim |
| `TaskRow.tsx`, `TaskGroup.tsx` | Port, add `⋮⋮` drag handle in Today/All |
| `ControlBar.tsx` | Port with variant that hides sort/group on Today |
| `Popover.tsx`, `DuePopover.tsx`, `SourceNotePeek.tsx` | Port; DuePopover gains "Schedule at…" option |
| `BulkActionBar.tsx` | Port, add "Triage to Today" action in NEW |
| `useKeyboardNav.ts` | Port, add tab-switching keys (`g n`, `g t`, `g u`, `g a`, `g d`) |
| `CheatsheetOverlay.tsx` | Port, document new shortcuts |
| First-run tip, sr-only live region, reduced-motion guard | Port verbatim |
| App.tsx wiring (`handleCreateManualTask`, `handleUpdateTask`, `handleDeleteTask`, delete-undo) | Port verbatim |
| `TasksView.tsx` | Heavily modified shell to host tabs + Strip |
| CSS | Reuse most rules; adjust row grid for drag handle; add tab strip, Strip, NEW-tab styles |

Mechanics: treat the branch as a read-only reference tree and copy files into the new branch via `git show tasks-page-redesign:<path> > <path>` per file, then modify as needed. This is cleaner than cherry-picking commits because the shell gets restructured.

## New files (delta over what we're reusing)

```
src/components/tasks/
  TabStrip.tsx              — 5-tab header
  TodayStrip.tsx            — 280px Strip (events + free slots + scheduled tasks + NOW)
  TodayPlate.tsx            — Today tab's plate body (Overdue / Scheduled / Today)
  TriagedPredicate.ts       — pure: isTriaged(task) heuristic
  tabPresets.ts             — pure: preset(tab) → ViewState patch
  useDragToSchedule.ts      — HTML5 DnD wiring
  useNow.ts                 — ticks every 60s
  __tests__/
    tabPresets.test.ts
    triagedPredicate.test.ts
    TodayStrip.test.tsx
    useDragToSchedule.test.ts       (light; real drag is manually QA'd)
src/lib/
  calendar.ts               — CalendarProvider interface + stub
  timeSlots.ts              — computeFreeSlots pure fn
  __tests__/
    timeSlots.test.ts
    calendarStub.test.ts
```

## Testing strategy

| Scope | What we test |
|---|---|
| `tabPresets` | Each tab → correct ViewState patch; invalid → default. |
| `triagedPredicate` | New task → false; status change, title edit, due set, priority change → true. |
| `timeSlots.computeFreeSlots` | Empty, single event, adjacent, overlapping, at boundaries, minSlot rejection. |
| `calendarStub` | Deterministic events; filters by date window. |
| `TabStrip` | Renders 5 tabs with correct counts; click switches tab; active tab gets accent border. |
| `TodayPlate` | Correct sections from fixtures; empty sections hidden; smart-sort ordering. |
| `TodayStrip` | Blocks at right y-positions; free slots render; NOW line present. |
| `useDragToSchedule` | Smoke test: dispatch dragstart/drop, verify handler fires with expected args. |
| `TasksView` integration | Tab switch updates URL; NEW shows untriaged only; ALL is the Approach-B list. |

Manual QA items listed in the implementation plan (drag interactions don't test well in jsdom).

## UI Copy & Voice (in addition to DESIGN.md)

- NEW empty state: `Inbox zero.` / `Nice.`
- TODAY empty (no tasks today): `Nothing today.` / `[ N upcoming ] [ N in All ]` as quiet links.
- Bulk triage: `Triage all → Today` / `Dismiss all → Later`.
- Schedule undo: `Scheduled "X" at 14:00. Undo`.
- Schedule conflict: silent no-op with visual reject; no toast (it'd be noise).
- Meta line in NEW: `last extracted 12 MIN AGO FROM meeting-notes` (note title clickable).
- Tab labels uppercase in Geist 13/500; counts in Geist Mono 10. NEW count in `--accent` when `> 0`.

## Anti-pattern audit (DESIGN.md)

- ✅ No purple/violet — only terracotta accent and semantic colors.
- ✅ No sparkle/wand icons for AI.
- ✅ No spinners (loading = optimistic + row dim).
- ✅ No toasts for routine saves.
- ✅ Calendar Strip is quiet chrome; no gradients or shimmer.
- ✅ Two monos kept apart (Geist Mono in chrome; iA Mono only in canvas/peek).
- ✅ Shadows only on floating elements (popovers, peek, modal).
- ✅ Smart-sort emphasizes "now-relevant," not "AI magic."

## Sequencing — four phases

1. **Foundation + reuse** (~6 commits): port Phase 1 migration, port pure modules, add `tab` to state, wire tests. No UI change lands.
2. **Tab strip + tab routing** (~3 commits): `TabStrip`, URL routing, default landing, presets applied. Each tab renders a plain list (no Today-special body yet). Ship-able interim.
3. **NEW tab body** (~2 commits): triage list, bulk CTAs, counts, contextual meta line.
4. **Today Plate + Strip** (~4–6 commits): Plate sections with smart-sort, calendar stub + free slots, Strip rendering, drag-to-schedule, keyboard alternative, tests.

Each phase ships green (tests + tsc). Phase 2 alone is a meaningful improvement over current master.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Drag-to-schedule is hard to test in jsdom; real drag UX can be broken without us knowing | Unit-test `useDragToSchedule` at event-handler level; explicit manual QA checklist in plan; keyboard `s` alternative always works. |
| `dueDate` doing double duty (date-only vs datetime) is a subtle overload a future dev could get wrong | Narrow helper functions `hasTime(dueDate)`, `setScheduleTime(dueDate, slot)`, `setDueDateOnly(d)` to localize the knowledge. Tests cover both shapes. |
| Heuristic triage (`updatedAt === createdAt`) misclassifies tasks when AI extraction later does any background update | Today's extraction sets createdAt and updatedAt to the same value at creation only. We control the write path. If it proves wrong, escalate to explicit `triagedAt`. |
| Strip state diverges from calendar when user adds an event in Google after page load | Stub doesn't refresh; real-GCal plan will add a 5-min polling refresh. Document. |
| Users who wanted the Approach-B single-page view feel they lost it | They haven't — ALL tab is Approach-B verbatim. Default to NEW/TODAY is the new thing; ALL remains one click away. |

## Open questions

None currently. All major product and architectural decisions settled.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-01 | Adopt Approach C over B | User feedback: B is a database, lacks workflow, lacks calendar, filters ≠ views. |
| 2026-05-01 | Google Calendar replaces EventKit entirely, but stubbed in this design | User directive; real integration is a separate future project. |
| 2026-05-01 | Collapse `scheduledAt` into `dueDate` (date-only vs datetime) | User directive; accepts loss of "due vs scheduled" distinction for model simplicity. |
| 2026-05-01 | Fixed 30-min drag block size | User directive; simpler than priority-based or prompt-on-drop. |
| 2026-05-01 | Heuristic triage (`updatedAt === createdAt`) over explicit `triagedAt` column | User directive; zero schema change; upgrade later if needed. |
| 2026-05-01 | Manually-typed tasks without due go through NEW | User directive; unified triage regardless of source. |
| 2026-05-01 | Plate + Strip shape for TODAY (two columns) | Defaulted by me on user's skip; matches DESIGN.md editorial-quiet, reuses existing mental model. |
| 2026-05-01 | Strip is 280px fixed; note task panel hidden on Tasks view | User directive; preserves plate room. |
| 2026-05-01 | Default landing = NEW if non-empty else TODAY | User agreed during NEW-tab discussion (implicit via "All" earlier referred to Approach B only). |
