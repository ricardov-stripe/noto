# Tasks Page v2 (Approach C) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship Approach C (smart-view tabs NEW/TODAY/UPCOMING/ALL/DONE with a Plate+Strip Today view and calendar-stubbed drag-to-schedule), by cherry-picking reusable modules from the abandoned `tasks-page-redesign` branch and layering new tab + Strip infrastructure on top.

**Architecture:** Four phases. (1) Foundation + reuse port. (2) Tab strip + routing. (3) NEW tab body. (4) Today Plate + Strip + drag. Each phase ships green.

**Tech Stack:** React 19 + TypeScript + Vite (renderer); Express + better-sqlite3 (server); Vitest + @testing-library/react (tests). No new runtime dependencies.

**Design source of truth:** `docs/plans/2026-05-01-tasks-page-c-design.md` (authoritative). DESIGN.md for visual rules. Defer to design doc on conflict.

**Reference tree:** the abandoned `tasks-page-redesign` branch has ~14 components, tests, and CSS blocks we reuse via `git show <branch>:<path>`. Do NOT re-derive; port.

**Branch:** work on `tasks-page-c` (already created). Do not rebase or touch `tasks-page-redesign`.

## Guiding principles

1. **Port, don't re-derive.** For every module listed in the reuse table (design doc), use `git show tasks-page-redesign:<path> > <path>` as the starting point. Only hand-write the delta.
2. **TDD on new logic only.** Ported code already has passing tests; don't rewrite them. New logic (tabs, presets, smart sort, Strip, drag, triage predicate) gets test-first.
3. **Bite-sized commits.** Each numbered task in this plan = one commit.
4. **Ship green per phase.** `npx vitest run` + `npx tsc --noEmit` must both pass before a phase is marked done.
5. **Port `tsconfig.json`'s `"ignoreDeprecations": "6.0"` line** (Task 1.1b) — without it, TS 6 treats the `baseUrl` deprecation as a hard error (TS5101) and `tsc --noEmit` fails. The abandoned branch has this fix; master doesn't.

## Phase 1 — Foundation + reuse port

**Goal:** Get the backend migration and all reusable pure/helper modules into `tasks-page-c`, with all tests green. No UI change lands yet — the Tasks page still renders the current (pre-redesign) `TaskListView` from master.

### 1.1 Verify clean starting state

**Purpose:** Sanity-check the branch and current test baseline before copying files.

**Action:**

```bash
git status --short
git log --oneline -1
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | tail -5
```

**Expected:**
- Status: design doc + plan committed; no tracked modifications (untracked `.cursor/`, `images/`, `noto.db.bak*`, `src/lib/collapsibleHeadings.ts`, `src/lib/imageUpload.ts`, `src/lib/sourceHighlight.ts`, `public/favicon.svg` are pre-existing WIP and OK to leave).
- `HEAD` is the plan commit (`98c127f` or similar) on tasks-page-c.
- **Tests pass (50/50 at baseline).**
- **`tsc --noEmit` FAILS** with `error TS5101: Option 'baseUrl' is deprecated…`. This is expected at the start; Task 1.1b fixes it.

If tests are red (not tsc), STOP and fix before proceeding. TSC failure is handled next.

**Commit:** none (verification only).

---

### 1.1b Port `tsconfig.json` to silence TS5101

**Purpose:** TS 6 treats the `baseUrl` deprecation as a hard error. The abandoned branch carries a `"ignoreDeprecations": "6.0"` line that resolves this. Port it now so every later task's `tsc --noEmit` check is meaningful.

**Action:**

```bash
git show tasks-page-redesign:tsconfig.json > tsconfig.json
```

Inspect the diff — the only change should be adding the `"ignoreDeprecations": "6.0"` line.

**Verify:**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean (zero errors).

**Commit message:**
```
Port ignoreDeprecations=6.0 to tsconfig for TS baseUrl warning
```

---

### 1.2 Port DB migration + tests from branch

**Purpose:** Make `tasks.sourceNoteId` nullable so manual tasks can be created.

**Files to copy verbatim from `tasks-page-redesign`:**

```bash
git show tasks-page-redesign:electron/database.ts > electron/database.ts
git show tasks-page-redesign:electron/__tests__/database.test.ts > electron/__tests__/database.test.ts
git show tasks-page-redesign:electron/__tests__/extraction.test.ts > electron/__tests__/extraction.test.ts
```

Also port the Task type change in `src/api.ts`:

```bash
git show tasks-page-redesign:src/api.ts > src/api.ts
```

**Verify:**

```bash
npx vitest run electron/__tests__/database.test.ts 2>&1 | tail -15
```

Expected: migration tests pass; existing CRUD tests pass; total ~12 passing in that file (the exact count from the abandoned branch).

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean (but `src/components/TaskListView.tsx` may now fail because the current master's version accesses `task.sourceNoteId` as non-nullable — fix next task).

**Commit message:**
```
Port nullable-sourceNoteId migration from abandoned branch

Makes tasks.sourceNoteId nullable so manually-created tasks
(not extracted from a note) can persist. Includes transactional
table rebuild and pre-migration .bak file.
```

---

### 1.3 Temporarily guard `TaskListView.tsx` for nullable sourceNoteId

**Purpose:** tsc must stay clean at end of each task. The current `TaskListView.tsx` on master accesses `task.sourceNoteId` as if it's always a number — compile will break after 1.2 on fresh branches. If the abandoned branch had this component deleted, copy that deletion too; otherwise apply a minimal guard.

**Check first:**
```bash
git show tasks-page-redesign:src/components/TaskListView.tsx 2>&1 | head -2
```

**If the file was deleted in the branch** (output shows "fatal: Path ... does not exist in ..."), we still render it on master but with guards. If still exists, copy it: `git show tasks-page-redesign:src/components/TaskListView.tsx > src/components/TaskListView.tsx` and likewise its test.

**Apply guard if needed** — search for `task.sourceNoteId` in TaskListView.tsx and wrap with `task.sourceNoteId != null &&` before any navigation. (The plan for the old branch Phase 1.1 has details — follow that same pattern.)

**Verify:** `npx tsc --noEmit` clean.

**Commit message:**
```
Guard TaskListView against nullable sourceNoteId
```

(Skip commit if no changes were needed.)

---

### 1.4 Port shared pure modules

**Purpose:** Copy the pure logic files that will be reused across tabs.

```bash
mkdir -p src/components/tasks/__tests__
for f in taskFilters.ts taskFilters.test.ts \
         useTasksViewState.ts useTasksViewState.test.ts \
         parseQuickAdd.ts parseQuickAdd.test.ts; do
  if [[ "$f" == *.test.ts ]]; then
    git show "tasks-page-redesign:src/components/tasks/__tests__/$f" > "src/components/tasks/__tests__/$f"
  else
    git show "tasks-page-redesign:src/components/tasks/$f" > "src/components/tasks/$f"
  fi
done
```

**Verify:**
```bash
npx vitest run src/components/tasks 2>&1 | tail -10
npx tsc --noEmit 2>&1 | tail -5
```

Expected: all ported tests pass.

**Commit message:**
```
Port taskFilters, useTasksViewState, parseQuickAdd + tests
```

---

### 1.5 Add `triaged` predicate + tests

**Purpose:** A task is "triaged" if the user has touched it. Implemented as `updatedAt !== createdAt`. Bare file; imported by Phase 3.

**Create `src/components/tasks/TriagedPredicate.ts`:**

```ts
import type { Task } from '../../api';

/**
 * A task is "triaged" when the user has explicitly interacted with it
 * (changed status, priority, title, due date, etc.). We use the presence
 * of an updatedAt newer than createdAt as the signal. Initial AI-extracted
 * tasks and fresh manual tasks have updatedAt === createdAt until touched.
 */
export function isTriaged(task: Pick<Task, 'createdAt' | 'updatedAt'>): boolean {
  return task.updatedAt !== task.createdAt;
}

export function isUntriaged(task: Pick<Task, 'createdAt' | 'updatedAt' | 'status'>): boolean {
  return task.status === 'todo' && !isTriaged(task);
}
```

**Test `src/components/tasks/__tests__/TriagedPredicate.test.ts`:**

```ts
import { describe, it, expect } from 'vitest';
import { isTriaged, isUntriaged } from '../TriagedPredicate';

const base = { createdAt: '2026-05-01T10:00:00Z', updatedAt: '2026-05-01T10:00:00Z', status: 'todo' as const };

describe('isTriaged', () => {
  it('returns false when updatedAt equals createdAt', () => {
    expect(isTriaged(base)).toBe(false);
  });
  it('returns true when updatedAt is newer', () => {
    expect(isTriaged({ ...base, updatedAt: '2026-05-01T10:00:01Z' })).toBe(true);
  });
});

describe('isUntriaged', () => {
  it('returns true for fresh todo task', () => {
    expect(isUntriaged(base)).toBe(true);
  });
  it('returns false for done task even if fresh', () => {
    expect(isUntriaged({ ...base, status: 'done' })).toBe(false);
  });
  it('returns false for touched task', () => {
    expect(isUntriaged({ ...base, updatedAt: '2026-05-01T10:00:01Z' })).toBe(false);
  });
});
```

**Verify:**
```bash
npx vitest run src/components/tasks/__tests__/TriagedPredicate.test.ts
```

**Commit message:**
```
Add triaged predicate (updatedAt !== createdAt heuristic)
```

---

### 1.6 Add `smart` sort + `tab` field to taskFilters

**Purpose:** Smart sort orders Today tasks as overdue → scheduled (by time) → today-due (by priority) → title. Also add `SortKey` literal.

**Modify `src/components/tasks/taskFilters.ts`:**

Add to `SortKey` union: `'smart'`.

Add to the `sortTasks` function, handling `'smart'`:

```ts
if (sort === 'smart') {
  const todayStr = new Date().toISOString().slice(0, 10);
  const rank = (t: Task) => {
    if (!t.dueDate) return 4;                   // no due — last
    const d = t.dueDate.slice(0, 10);
    if (d < todayStr) return 0;                 // overdue
    if (d === todayStr && t.dueDate.length > 10) return 1; // scheduled today
    if (d === todayStr) return 2;               // today-due, no time
    return 3;                                   // later
  };
  return [...tasks].sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) return (a.dueDate ?? '').localeCompare(b.dueDate ?? ''); // oldest-overdue first
    if (ra === 1) return (a.dueDate ?? '').localeCompare(b.dueDate ?? ''); // chronological
    if (ra === 2) return prioRank(a) - prioRank(b);                        // high first
    return a.title.localeCompare(b.title);
  });
}
```

(Where `prioRank` maps high=0, medium=1, low=2.)

**Add to `taskFilters.test.ts`** three tests for `sort: 'smart'`:
1. Overdue tasks come before today's scheduled.
2. Scheduled tasks ordered by time.
3. Today-due no-time ordered by priority desc.

**Verify:**
```bash
npx vitest run src/components/tasks/__tests__/taskFilters.test.ts
```

**Commit message:**
```
Add smart sort (overdue → scheduled → today-due → rest)
```

---

### 1.7 Add `tab` to `ViewState` + URL encoding

**Purpose:** The view state reducer gains a `tab` field. URL hash becomes `#tasks/<tab>?…`.

**Modify `src/components/tasks/useTasksViewState.ts`:**

1. Add type:
   ```ts
   export type Tab = 'new' | 'today' | 'upcoming' | 'all' | 'done';
   ```
2. Add `tab: Tab` to `ViewState` interface.
3. Add action: `{ type: 'setTab'; tab: Tab }` → updates `state.tab`; resets `selection`, `focusedId`.
4. Update `encodeView` — URL is `#tasks/<tab>?<params>`. If `tab === 'today'`, omit for prettiness (root `#tasks?<params>` → default).
5. Update `decodeView` — parse `#tasks/<tab>` prefix; invalid tab falls back to `'today'`.
6. Default state: `tab: 'today'`.

**Update `useTasksViewState.test.ts`:**
- Test: `setTab` action updates tab.
- Test: `encodeView({ tab: 'new', ... })` → `#tasks/new`.
- Test: `decodeView('#tasks/upcoming?prio=high')` → tab 'upcoming', priority ['high'].
- Test: `decodeView('#tasks/bogus')` → tab 'today'.
- Test: localStorage persists tab across reloads.

**Verify:**
```bash
npx vitest run src/components/tasks/__tests__/useTasksViewState.test.ts
npx tsc --noEmit 2>&1 | tail -5
```

**Commit message:**
```
Add tab field to ViewState with URL hash routing
```

---

### 1.8 Port remaining reusable components

**Purpose:** Copy the presentational components that will be reused across tabs. No logic changes yet.

```bash
for f in Popover.tsx QuickAddBar.tsx DuePopover.tsx SourceNotePeek.tsx \
         BulkActionBar.tsx CheatsheetOverlay.tsx \
         TaskRow.tsx TaskGroup.tsx \
         useKeyboardNav.ts; do
  git show "tasks-page-redesign:src/components/tasks/$f" > "src/components/tasks/$f"
done

for f in QuickAddBar.test.tsx DuePopover.test.tsx TaskRow.test.tsx; do
  git show "tasks-page-redesign:src/components/tasks/__tests__/$f" > "src/components/tasks/__tests__/$f" 2>/dev/null || true
done
```

(Adjust the test list to whatever exists in the branch; check first with `git ls-tree tasks-page-redesign src/components/tasks/__tests__/`.)

**Port App.tsx wiring** — but *don't* swap in the new TasksView yet; we'll do that in Phase 2. For now, just add the handlers so they're available:

```bash
git show tasks-page-redesign:src/App.tsx > /tmp/App.tsx.ref
```

Open `/tmp/App.tsx.ref` and `src/App.tsx` side-by-side. Copy over only:
- `handleCreateManualTask`
- `handleUpdateTask`
- `handleDeleteTask` + undo logic
- Any `setTasks` state transitions they depend on.

Do NOT swap `<TaskListView>` for `<TasksView>` yet.

**Port CSS** — the abandoned branch added ~500 lines of CSS for tasks. Copy the whole `src/styles/app.css` from the branch, then manually diff back the note-task-panel-related rules that still need to live on (since note view is still used elsewhere).

```bash
git show tasks-page-redesign:src/styles/app.css > src/styles/app.css
```

**Verify:**
```bash
npx vitest run src/components/tasks 2>&1 | tail -15
npx tsc --noEmit 2>&1 | tail -5
npm run dev &   # smoke
# open app, confirm the OLD TaskListView still renders (we haven't swapped yet)
# kill dev
```

**Commit message:**
```
Port reusable tasks components and App wiring (no UI swap yet)
```

---

### 1.9 Phase 1 checkpoint

**Verify:**
```bash
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | tail -5
git log --oneline master..HEAD
```

Expected: all tests pass, tsc clean, ~6-8 commits on branch, Tasks view still shows old `TaskListView` (because we haven't swapped `App.tsx` to render `TasksView`).

If anything red, fix before Phase 2.

---

## Phase 2 — Tab strip + routing

**Goal:** Replace the old `TaskListView` with a new `TasksView` shell that renders a `TabStrip`, routes via URL hash, and renders a plain list body for every tab. At end of Phase 2 the app has all 5 tabs visible, switching works, URL persists, counts are correct — but every tab just shows the same flat list (filtered by its preset). No Today-special body, no NEW-special body yet.

### 2.1 Write `tabPresets.ts` + tests (TDD)

**Purpose:** Pure function `preset(tab)` returns the `ViewState` patch for a tab's default.

**Create test first** `src/components/tasks/__tests__/tabPresets.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { preset } from '../tabPresets';

describe('tabPresets', () => {
  it('new preset filters open (status=todo)', () => {
    expect(preset('new').status).toEqual(['todo']);
    expect(preset('new').sort).toBe('created-desc');
    expect(preset('new').group).toBe('none');
  });
  it('today preset uses smart sort, no group', () => {
    expect(preset('today').sort).toBe('smart');
    expect(preset('today').group).toBe('none');
  });
  it('upcoming: due-asc, group by due', () => {
    expect(preset('upcoming').sort).toBe('due-asc');
    expect(preset('upcoming').group).toBe('due');
  });
  it('all: due-asc, group by status', () => {
    expect(preset('all').group).toBe('status');
  });
  it('done: status=done, group by week', () => {
    expect(preset('done').status).toEqual(['done']);
    expect(preset('done').group).toBe('week');
  });
});
```

**Run, watch fail, implement** `src/components/tasks/tabPresets.ts`:

```ts
import type { Tab } from './useTasksViewState';
import type { SortKey, GroupKey, StatusKey } from './taskFilters';

export interface TabPreset {
  status: StatusKey[];
  sort: SortKey;
  group: GroupKey;
}

export function preset(tab: Tab): TabPreset {
  switch (tab) {
    case 'new':      return { status: ['todo'], sort: 'created-desc', group: 'none' };
    case 'today':    return { status: ['todo', 'in_progress'], sort: 'smart', group: 'none' };
    case 'upcoming': return { status: ['todo', 'in_progress'], sort: 'due-asc', group: 'due' };
    case 'all':      return { status: ['todo', 'in_progress'], sort: 'due-asc', group: 'status' };
    case 'done':     return { status: ['done'], sort: 'created-desc', group: 'week' };
  }
}
```

Add `'week'` to `GroupKey` in `taskFilters.ts`; implement week-bucket grouping as `const week = (iso) => /* ISO-8601 week like "2026-W18" */;` used in `groupTasks`.

**Commit:** `Add tabPresets pure module`

---

### 2.2 Wire preset application into `useTasksViewState`

**Modify reducer** in `useTasksViewState.ts`:

```ts
case 'setTab': {
  const p = preset(action.tab);
  return {
    ...state,
    tab: action.tab,
    status: p.status,
    sort: p.sort,
    group: p.group,
    selection: new Set(),
    focusedId: null,
  };
}
```

In the initializer (after `decodeView` returns initial state), also apply the preset for the initial tab so a cold-load into `#tasks/new` gets the right filters.

**Tests** — add to `useTasksViewState.test.ts`:
- `setTab` applies preset filters.
- `setTab` preserves `priority` and `search` refinements.
- Initial load at `#tasks/done` has `status: ['done']`.

**Commit:** `Apply tab presets on tab switch and initial load`

---

### 2.3 Build `TabStrip.tsx` + test

**Test** `src/components/tasks/__tests__/TabStrip.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabStrip } from '../TabStrip';

const counts = { new: 3, today: 5, upcoming: 12, all: 30, done: 47 };

describe('TabStrip', () => {
  it('renders all 5 tabs with counts', () => {
    render(<TabStrip active="today" counts={counts} onChange={() => {}} />);
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /today/i })).toHaveAttribute('aria-selected', 'true');
  });
  it('calls onChange on click', async () => {
    const onChange = vi.fn();
    render(<TabStrip active="today" counts={counts} onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: /upcoming/i }));
    expect(onChange).toHaveBeenCalledWith('upcoming');
  });
  it('omits count when zero', () => {
    render(<TabStrip active="today" counts={{ ...counts, new: 0 }} onChange={() => {}} />);
    const newTab = screen.getByRole('tab', { name: /new/i });
    expect(newTab.textContent?.trim()).toMatch(/^NEW$/i);
  });
  it('NEW count is accent-colored when > 0', () => {
    render(<TabStrip active="today" counts={counts} onChange={() => {}} />);
    const badge = screen.getByText('3');
    expect(badge.className).toMatch(/accent/);
  });
});
```

**Implement** `src/components/tasks/TabStrip.tsx`:

```tsx
import type { Tab } from './useTasksViewState';

export interface TabStripProps {
  active: Tab;
  counts: Record<Tab, number>;
  onChange: (t: Tab) => void;
}

const ORDER: Tab[] = ['new', 'today', 'upcoming', 'all', 'done'];

export function TabStrip({ active, counts, onChange }: TabStripProps) {
  return (
    <div className="tabstrip" role="tablist" aria-label="Task views">
      {ORDER.map((tab) => {
        const count = counts[tab];
        const isActive = tab === active;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`tabstrip__tab ${isActive ? 'tabstrip__tab--active' : ''}`}
            onClick={() => onChange(tab)}
          >
            <span className="tabstrip__label">{tab}</span>
            {count > 0 && (
              <span className={`tabstrip__count ${tab === 'new' ? 'tabstrip__count--accent' : ''}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

**Append CSS** to `src/styles/app.css`:

```css
/* Tab strip */
.tabstrip { display: flex; align-items: flex-end; gap: 18px; padding: 0 32px; border-bottom: 1px solid var(--border-soft); height: 38px; }
.tabstrip__tab { display: flex; align-items: center; gap: 6px; background: none; border: none; padding: 8px 0; color: var(--text-muted); font: 500 13px/1 'Geist', sans-serif; text-transform: uppercase; letter-spacing: 0.04em; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tabstrip__tab:hover { color: var(--text); }
.tabstrip__tab--active { color: var(--text); border-bottom-color: var(--accent); }
.tabstrip__count { font: 500 10px/1 'Geist Mono', monospace; color: var(--text-muted); }
.tabstrip__count--accent { color: var(--accent); }
```

**Commit:** `Add TabStrip component`

---

### 2.4 Build `TasksView.tsx` shell; swap in App.tsx

**Create** `src/components/tasks/TasksView.tsx`. Minimum skeleton:

```tsx
import { useMemo } from 'react';
import type { Task, Note } from '../../api';
import { useTasksViewState } from './useTasksViewState';
import { TabStrip } from './TabStrip';
import { QuickAddBar } from './QuickAddBar';
import { ControlBar } from './ControlBar';
import { TaskGroup } from './TaskGroup';
import { filterTasks, sortTasks, groupTasks } from './taskFilters';
import { isUntriaged } from './TriagedPredicate';

interface TasksViewProps {
  tasks: Task[];
  notes: Note[];
  onCreate: (data: { title: string; priority: Task['priority']; dueDate: string | null; sourceNoteId: number | null }) => Promise<Task | null>;
  onUpdate: (id: number, patch: Partial<Task>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function TasksView({ tasks, notes, onCreate, onUpdate, onDelete }: TasksViewProps) {
  const [state, dispatch] = useTasksViewState();

  const counts = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return {
      new: tasks.filter(isUntriaged).length,
      today: tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate.slice(0, 10) <= todayStr).length,
      upcoming: tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate.slice(0, 10) > todayStr).length,
      all: tasks.filter((t) => t.status !== 'done').length,
      done: tasks.filter((t) => t.status === 'done').length,
    };
  }, [tasks]);

  const groups = useMemo(() => {
    const filtered = filterTasks(tasks, state);
    const sorted = sortTasks(filtered, state.sort);
    return groupTasks(sorted, state.group);
  }, [tasks, state]);

  const hideSortGroup = state.tab === 'today' || state.tab === 'new';

  return (
    <div className="tasks-view">
      <header className="tasks-view__header">
        <h1 className="tasks-view__title">Tasks</h1>
        <div className="tasks-view__meta">{counts.all} OPEN · {counts.done} DONE</div>
      </header>
      <TabStrip active={state.tab} counts={counts} onChange={(tab) => dispatch({ type: 'setTab', tab })} />
      <QuickAddBar onCreate={onCreate} notes={notes} />
      <ControlBar state={state} dispatch={dispatch} hideSortGroup={hideSortGroup} />
      <div className="tasks-view__body">
        {groups.map((g) => (
          <TaskGroup
            key={g.key}
            group={g}
            state={state}
            dispatch={dispatch}
            notes={notes}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
```

Add a prop `hideSortGroup?: boolean` to `ControlBar` that hides those two controls when true.

**Modify** `src/App.tsx`:
- Replace `<TaskListView …/>` with `<TasksView tasks={tasks} notes={notes} onCreate={handleCreateManualTask} onUpdate={handleUpdateTask} onDelete={handleDeleteTask} />`.
- Hide the note task panel when `view === 'tasks'` (wrap the panel JSX in a condition).

**Verify:**
- `npx tsc --noEmit` clean
- `npx vitest run` all pass
- Manual smoke: open Tasks view, see 5 tabs, switch them, URL updates, quick-add works.

**Commit:** `Wire TasksView shell into App, replacing TaskListView`

---

### 2.5 Delete dead `TaskListView`

```bash
rm -f src/components/TaskListView.tsx src/components/__tests__/TaskListView.test.tsx
rg 'TaskListView' src/  # expect no hits
```

Verify tests + tsc still clean.

**Commit:** `Remove unused TaskListView`

---

### 2.6 Tab-switching keyboard shortcuts

**Modify** `src/components/tasks/useKeyboardNav.ts` — add `g` prefix handling.

```ts
const pendingG = useRef<number | null>(null);

const handler = (e: KeyboardEvent) => {
  if (isInputTarget(e.target)) return;

  if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
    if (pendingG.current) window.clearTimeout(pendingG.current);
    pendingG.current = window.setTimeout(() => { pendingG.current = null; }, 1000);
    e.preventDefault();
    return;
  }
  if (pendingG.current) {
    const map: Record<string, Tab> = { n: 'new', t: 'today', u: 'upcoming', a: 'all', d: 'done' };
    if (map[e.key]) {
      window.clearTimeout(pendingG.current);
      pendingG.current = null;
      onTabSwitch?.(map[e.key]);
      e.preventDefault();
      return;
    }
  }
  // … existing j/k/x/etc. handling …
};
```

Add `onTabSwitch?: (tab: Tab) => void` to hook props. Wire from `TasksView` to dispatch `setTab`.

**Append to** `CheatsheetOverlay.tsx`:
```
g n — NEW
g t — TODAY
g u — UPCOMING
g a — ALL
g d — DONE
```

**Test**: in `useKeyboardNav.test.ts` (if present) simulate `keydown g` then `keydown t` and assert the callback fires with `'today'`.

**Commit:** `Add g+letter tab-switch shortcuts`

---

### 2.7 Phase 2 checkpoint

Run all tests + tsc. Manual QA:
- 5 tabs render; counts correct; NEW count accent when > 0.
- Click switches tab and updates URL hash.
- Refresh keeps tab.
- `g n`/`g t` etc. work.
- Note task panel hidden on Tasks view.
- Quick-add works on every tab.

If all green, Phase 2 is shippable on its own. Continue to Phase 3.

---

## Phase 3 — NEW tab body

**Goal:** NEW tab becomes a triage inbox: flat untriaged list, optional source-note meta line, two bulk CTAs. Other tabs unaffected.

### 3.1 Filter scope: untriaged

**Purpose:** The NEW tab body should show only `isUntriaged(task)` — stricter than its base preset (`status: todo`).

**Modify** `filterTasks` in `taskFilters.ts`: add an optional `tab?: Tab` parameter. When `tab === 'new'`, apply the `isUntriaged` predicate after all other filters.

```ts
// in filterTasks:
let out = tasks.filter(/* existing filters */);
if (state.tab === 'new') out = out.filter(isUntriaged);
return out;
```

(Pass the full `state` rather than adding a separate param for forward compat.)

**Update the count computation in `TasksView.tsx`** — `counts.new` already uses `isUntriaged(t)`, so that remains correct.

**Tests** — in `taskFilters.test.ts` add:
- `tab: 'new'` filters down to untriaged only, even if fixture has triaged todos.

**Commit:** `Filter NEW tab to untriaged tasks`

---

### 3.2 NEW body renderer (inline, no new component yet)

**Purpose:** Render a plain flat list when `tab === 'new'`. Don't branch on a separate component file yet — this is just the body.

**Modify `TasksView.tsx`** — the body when `state.tab === 'new'`:

```tsx
{state.tab === 'new' ? (
  <NewTabBody
    tasks={groups.flatMap((g) => g.tasks)}
    notes={notes}
    state={state}
    dispatch={dispatch}
    onUpdate={onUpdate}
    onDelete={onDelete}
  />
) : (
  groups.map((g) => (
    <TaskGroup key={g.key} group={g} /* … */ />
  ))
)}
```

Create `src/components/tasks/NewTabBody.tsx`:

```tsx
import { useMemo } from 'react';
import type { Task, Note } from '../../api';
import { TaskRow } from './TaskRow';

interface Props {
  tasks: Task[];
  notes: Note[];
  state: ViewState;
  dispatch: Dispatch<Action>;
  onUpdate: (id: number, patch: Partial<Task>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onTriageAllToToday: () => void;
  onDismissAllToLater: () => void;
}

export function NewTabBody(props: Props) {
  const { tasks, notes } = props;
  const lastExtracted = useMemo(() => findMostRecentExtractedMeta(tasks, notes), [tasks, notes]);

  if (tasks.length === 0) {
    return (
      <div className="new-tab__empty">
        <div className="new-tab__empty-hero">Inbox zero.</div>
        <div className="new-tab__empty-sub">Nice.</div>
      </div>
    );
  }

  return (
    <section className="new-tab" aria-label="Untriaged tasks">
      <header className="new-tab__meta">
        <span className="new-tab__count">{tasks.length} UNTRIAGED</span>
        {lastExtracted && (
          <span className="new-tab__extracted">
            last extracted {lastExtracted.relative} FROM {lastExtracted.noteTitle}
          </span>
        )}
      </header>
      <ul className="new-tab__list" role="list">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} notes={notes} /* …std props… */ />
        ))}
      </ul>
      <footer className="new-tab__actions">
        <button type="button" className="btn btn--quiet" onClick={props.onTriageAllToToday}>
          Triage all → Today
        </button>
        <button type="button" className="btn btn--quiet" onClick={props.onDismissAllToLater}>
          Dismiss all → Later
        </button>
      </footer>
    </section>
  );
}

function findMostRecentExtractedMeta(tasks: Task[], notes: Note[]) {
  const withNote = tasks.filter((t) => t.sourceNoteId != null);
  if (withNote.length === 0) return null;
  const newest = withNote.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
  const note = notes.find((n) => n.id === newest.sourceNoteId);
  if (!note) return null;
  return { relative: relativeTime(newest.createdAt), noteTitle: note.title || 'untitled' };
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.round(diffMs / 60000);
  if (m < 1) return 'JUST NOW';
  if (m < 60) return `${m} MIN AGO`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}H AGO`;
  const d = Math.round(h / 24);
  return `${d}D AGO`;
}
```

**Append CSS:**

```css
/* New tab */
.new-tab { display: flex; flex-direction: column; gap: 0; padding: 0 32px 32px; }
.new-tab__meta { display: flex; justify-content: space-between; align-items: center; padding: 16px 0 12px; border-bottom: 1px solid var(--border-soft); }
.new-tab__count { font: 500 11px/1 'Geist Mono', monospace; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text); }
.new-tab__extracted { font: 400 11px/1 'Geist Mono', monospace; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
.new-tab__list { list-style: none; margin: 0; padding: 0; }
.new-tab__actions { display: flex; gap: 12px; padding: 24px 0 8px; }
.new-tab__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 120px 32px; gap: 4px; }
.new-tab__empty-hero { font: 600 42px/1 'Cabinet Grotesk', sans-serif; color: var(--text); letter-spacing: -0.02em; }
.new-tab__empty-sub { font: 400 15px/1.5 'Geist', sans-serif; color: var(--text-muted); }
```

**Handlers in App.tsx (or passed through TasksView):**

```ts
const handleTriageAllToToday = useCallback(async () => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const untriaged = tasks.filter(isUntriaged);
  await Promise.all(untriaged.map((t) => api.tasks.update(t.id, { dueDate: todayIso })));
  // Refetch or optimistically update state
}, [tasks]);

const handleDismissAllToLater = useCallback(async () => {
  const untriaged = tasks.filter(isUntriaged);
  // Touch updatedAt without other changes → marks them triaged; they flow to Upcoming/All
  await Promise.all(untriaged.map((t) => api.tasks.update(t.id, {})));
}, [tasks]);
```

Pass through `TasksView` → `NewTabBody`.

**Server check:** ensure `PATCH /api/tasks/:id` with empty body still bumps `updatedAt`. If not, modify `electron/database.ts` `updateTask` to always bump `updatedAt` even when no other fields change. Add/verify server route supports this.

**Tests** — `NewTabBody.test.tsx`:
- Renders empty state when 0 tasks.
- Shows count + meta line when tasks + sourceNoteId present.
- Clicking "Triage all → Today" fires callback.
- Clicking row interactions work (delegated to `TaskRow`).

**Commit:** `Add NEW tab body with triage CTAs and meta line`

---

### 3.3 Hide sort/group controls on NEW and Today

Confirm `hideSortGroup` in TasksView is `state.tab === 'today' || state.tab === 'new'`.

Keep: search, priority filter.

Verify manually.

**Commit:** none (should be covered by 3.2 or earlier).

---

### 3.4 Phase 3 checkpoint

Manual QA:
- [ ] NEW tab shows only untriaged tasks.
- [ ] Touching any row (edit title, change priority, set due) removes it from NEW.
- [ ] Meta line shows for AI-extracted tasks; hidden when only manual tasks are new.
- [ ] "Triage all → Today" sets dueDate on all visible and empties NEW.
- [ ] "Dismiss all → Later" empties NEW without scheduling.
- [ ] Empty state is "Inbox zero."
- [ ] Badge on tab updates in real time.

If all green, Phase 3 ships. Continue to Phase 4.

---

## Phase 4 — Today Plate + Strip + drag-to-schedule

**Goal:** The TODAY tab becomes a two-column Plate+Strip layout with drag-to-schedule against a stubbed calendar provider.

### 4.1 Calendar provider interface + stub + tests

**Create** `src/lib/calendar.ts`:

```ts
export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
}

export interface CalendarProvider {
  getEvents(dayStartIso: string, dayEndIso: string): Promise<CalendarEvent[]>;
}

export const stubCalendarProvider: CalendarProvider = {
  async getEvents(dayStartIso, dayEndIso) {
    const dayStart = new Date(dayStartIso);
    const at = (h: number, m = 0) => {
      const d = new Date(dayStart);
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
```

**Test** `src/lib/__tests__/calendar.test.ts`:
- Returns 4 events for a typical day.
- Filters out events entirely outside the window.
- Each event has start < end.

**Commit:** `Add CalendarProvider interface + deterministic stub`

---

### 4.2 `computeFreeSlots` pure function + tests

**Create** `src/lib/timeSlots.ts`:

```ts
export interface TimeBlock { start: string; end: string; }
export interface FreeSlot extends TimeBlock { durationMin: number; }

const MINUTE_MS = 60_000;

export function computeFreeSlots(
  dayStart: string,
  dayEnd: string,
  blockers: TimeBlock[],
  minSlotMin = 15,
): FreeSlot[] {
  // Sort blockers by start; merge overlaps; produce gaps.
  const sorted = [...blockers].filter((b) => b.end > dayStart && b.start < dayEnd).sort((a, b) => a.start.localeCompare(b.start));
  const merged: TimeBlock[] = [];
  for (const b of sorted) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) {
      if (b.end > last.end) last.end = b.end;
    } else {
      merged.push({ start: b.start < dayStart ? dayStart : b.start, end: b.end > dayEnd ? dayEnd : b.end });
    }
  }
  const slots: FreeSlot[] = [];
  let cursor = dayStart;
  for (const m of merged) {
    if (m.start > cursor) slots.push(slot(cursor, m.start));
    cursor = m.end > cursor ? m.end : cursor;
  }
  if (cursor < dayEnd) slots.push(slot(cursor, dayEnd));
  return slots.filter((s) => s.durationMin >= minSlotMin);
}

function slot(start: string, end: string): FreeSlot {
  const durationMin = Math.round((new Date(end).getTime() - new Date(start).getTime()) / MINUTE_MS);
  return { start, end, durationMin };
}
```

**Tests** `src/lib/__tests__/timeSlots.test.ts` — 10 cases:
- Empty blockers → one slot spanning day.
- Single event in middle → two slots.
- Adjacent events → no gap between them.
- Overlapping events → merged.
- Event at day start → no slot before.
- Event at day end → no slot after.
- Event outside window → ignored.
- minSlot rejection: 10-min gap when minSlotMin=15 → dropped.
- Event exactly minSlot duration → slot kept.
- Order-insensitive blockers input.

**Commit:** `Add computeFreeSlots pure function with tests`

---

### 4.3 `useNow` hook

**Create** `src/components/tasks/useNow.ts`:

```ts
import { useEffect, useState } from 'react';

export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
```

No formal test — trivial. Smoke-test via TodayStrip.

**Commit:** `Add useNow hook`

---

### 4.4 `TodayPlate.tsx`

**Purpose:** Left column of the Today view. Three sections (OVERDUE / SCHEDULED / TODAY), section headers, uses `TaskRow`, respects smart sort within each section.

**Create** `src/components/tasks/TodayPlate.tsx`:

```tsx
import { useMemo } from 'react';
import type { Task, Note } from '../../api';
import { TaskRow } from './TaskRow';

interface Props {
  tasks: Task[]; // already filtered by preset
  notes: Note[];
  /* ...standard row-level callback props... */
}

function hasTime(dueDate: string | null): boolean {
  return !!dueDate && dueDate.length > 10; // heuristic: date-only is 10 chars
}

export function TodayPlate(props: Props) {
  const { tasks } = props;
  const todayStr = new Date().toISOString().slice(0, 10);

  const { overdue, scheduled, today } = useMemo(() => {
    const overdue: Task[] = [];
    const scheduled: Task[] = [];
    const today: Task[] = [];
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const d = t.dueDate.slice(0, 10);
      if (d < todayStr) overdue.push(t);
      else if (d === todayStr && hasTime(t.dueDate)) scheduled.push(t);
      else if (d === todayStr) today.push(t);
    }
    overdue.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    scheduled.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
    today.sort((a, b) => priorityRank(a) - priorityRank(b) || a.title.localeCompare(b.title));
    return { overdue, scheduled, today };
  }, [tasks, todayStr]);

  return (
    <div className="today-plate">
      {overdue.length > 0 && <Section label="OVERDUE" count={overdue.length} variant="overdue">{overdue.map((t) => <TaskRow key={t.id} task={t} draggable {...props} />)}</Section>}
      {scheduled.length > 0 && <Section label="SCHEDULED" count={scheduled.length}>{scheduled.map((t) => <TaskRow key={t.id} task={t} draggable {...props} />)}</Section>}
      {today.length > 0 && <Section label="TODAY" count={today.length}>{today.map((t) => <TaskRow key={t.id} task={t} draggable {...props} />)}</Section>}
      {overdue.length === 0 && scheduled.length === 0 && today.length === 0 && (
        <div className="today-plate__empty">Nothing today.</div>
      )}
    </div>
  );
}
```

Add `priorityRank(t: Task)`: high=0, medium=1, low=2.

Add `draggable` prop to `TaskRow` — sets `draggable` attribute and fires `onDragStart` setting `dataTransfer.setData('application/x-task-id', String(task.id))`. Visible drag handle `⋮⋮` at row start when `draggable`.

**Tests** `__tests__/TodayPlate.test.tsx`:
- Three sections show correctly for a fixture.
- Empty sections hidden.
- Scheduled ordered chronologically.
- Today ordered by priority desc.
- "Nothing today" when empty.

**Commit:** `Add TodayPlate with Overdue/Scheduled/Today sections`

---

### 4.5 `TodayStrip.tsx`

**Purpose:** 280px right column: hour rails, event blocks, scheduled-task blocks, free slots (drop zones), NOW line.

**Create** `src/components/tasks/TodayStrip.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { Task } from '../../api';
import { type CalendarProvider, type CalendarEvent } from '../../lib/calendar';
import { computeFreeSlots, type FreeSlot } from '../../lib/timeSlots';
import { useNow } from './useNow';

interface Props {
  tasks: Task[];
  calendar: CalendarProvider;
  onScheduleTask: (taskId: number, slotStart: string) => void;
}

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;
const HOUR_HEIGHT_PX = 48;
const MIN_SLOT_MIN = 15;

export function TodayStrip({ tasks, calendar, onScheduleTask }: Props) {
  const now = useNow();
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const { dayStartIso, dayEndIso } = useMemo(() => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    const ds = new Date(day); ds.setHours(DAY_START_HOUR);
    const de = new Date(day); de.setHours(DAY_END_HOUR);
    return { dayStartIso: ds.toISOString(), dayEndIso: de.toISOString() };
  }, [now]);

  useEffect(() => {
    let cancelled = false;
    calendar.getEvents(dayStartIso, dayEndIso).then((e) => !cancelled && setEvents(e));
    return () => { cancelled = true; };
  }, [calendar, dayStartIso, dayEndIso]);

  const scheduledTasks = tasks.filter((t) => t.dueDate && t.dueDate.slice(0, 10) === dayStartIso.slice(0, 10) && t.dueDate.length > 10);

  const blockers = [
    ...events.map((e) => ({ start: e.start, end: e.end })),
    ...scheduledTasks.map((t) => ({ start: t.dueDate!, end: addMin(t.dueDate!, 30) })),
  ];

  const freeSlots = computeFreeSlots(dayStartIso, dayEndIso, blockers, MIN_SLOT_MIN);

  return (
    <aside className="today-strip" aria-label="Your day timeline">
      <div className="today-strip__header">YOUR DAY</div>
      <div className="today-strip__canvas" style={{ height: `${(DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT_PX}px` }}>
        {/* Hour grid */}
        {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i).map((h) => (
          <div key={h} className="today-strip__hour" style={{ top: `${(h - DAY_START_HOUR) * HOUR_HEIGHT_PX}px` }}>
            <span className="today-strip__hour-label">{h}:00</span>
          </div>
        ))}
        {/* Events */}
        {events.map((e) => (
          <Block key={e.id} start={e.start} end={e.end} label={e.title} dayStartIso={dayStartIso} kind="event" />
        ))}
        {/* Scheduled tasks */}
        {scheduledTasks.map((t) => (
          <Block key={t.id} start={t.dueDate!} end={addMin(t.dueDate!, 30)} label={t.title} dayStartIso={dayStartIso} kind="task" />
        ))}
        {/* Free slots */}
        {freeSlots.map((slot) => (
          <DropSlot key={slot.start} slot={slot} dayStartIso={dayStartIso} onDropTask={onScheduleTask} />
        ))}
        {/* NOW line */}
        {isToday(now, dayStartIso) && <NowLine now={now} dayStartIso={dayStartIso} />}
      </div>
    </aside>
  );
}
```

Helpers `Block`, `DropSlot`, `NowLine`, `addMin`, `isToday`, `pxFromIso` in same file or a `today-strip.helpers.ts`. Each computes `top`/`height` in px from ISO start/end using `HOUR_HEIGHT_PX`.

`DropSlot` implements the drop target:
```tsx
function DropSlot({ slot, onDropTask, dayStartIso }: DropSlotProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className={`today-strip__slot ${hover ? 'today-strip__slot--hover' : ''}`}
      style={{ top: `${pxFromIso(slot.start, dayStartIso)}px`, height: `${pxFromIso(slot.end, dayStartIso) - pxFromIso(slot.start, dayStartIso)}px` }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('application/x-task-id')) { e.preventDefault(); setHover(true); } }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault(); setHover(false);
        const id = Number(e.dataTransfer.getData('application/x-task-id'));
        if (Number.isFinite(id)) onDropTask(id, slot.start);
      }}
    >
      <span className="today-strip__slot-label">◌ {formatDuration(slot.durationMin)}</span>
    </div>
  );
}
```

**Append CSS:**

```css
/* Today Plate + Strip */
.today-layout { display: grid; grid-template-columns: 1fr 280px; gap: 24px; padding: 16px 32px 32px; }
.today-plate { display: flex; flex-direction: column; gap: 24px; }
.today-plate__section { display: flex; flex-direction: column; }
.today-plate__section-header { display: flex; align-items: baseline; gap: 8px; font: 500 11px/1 'Geist Mono', monospace; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); padding: 8px 0; }
.today-plate__section-header--overdue { color: var(--danger); }
.today-plate__empty { padding: 64px 0; text-align: center; font: 400 16px/1.5 'Geist', sans-serif; color: var(--text-muted); }

.today-strip { background: var(--surface); border-left: 1px solid var(--border-soft); padding: 8px 0; }
.today-strip__header { font: 500 11px/1 'Geist Mono', monospace; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); padding: 8px 16px; }
.today-strip__canvas { position: relative; margin: 8px 16px; }
.today-strip__hour { position: absolute; left: 0; right: 0; border-top: 1px solid var(--border-soft); }
.today-strip__hour-label { position: absolute; left: -48px; top: -6px; font: 400 10px/1 'Geist Mono', monospace; color: var(--text-muted); }
.today-strip__block { position: absolute; left: 0; right: 0; padding: 4px 8px; background: var(--surface-alt); border-left: 2px solid var(--accent-ink); font: 500 12px/1.3 'Geist', sans-serif; color: var(--text); overflow: hidden; }
.today-strip__block--task { border-left-color: var(--accent); }
.today-strip__slot { position: absolute; left: 0; right: 0; border: 1px dashed var(--border-soft); border-radius: 4px; display: flex; align-items: center; padding: 0 8px; pointer-events: all; }
.today-strip__slot--hover { border-color: var(--accent); background: var(--accent-tint); }
.today-strip__slot--reject { border-color: var(--danger); }
.today-strip__slot-label { font: 400 10px/1 'Geist Mono', monospace; text-transform: uppercase; color: var(--text-muted); }
.today-strip__now { position: absolute; left: 0; right: 0; height: 1px; background: var(--accent); z-index: 2; }
.today-strip__now-label { position: absolute; right: 4px; top: -14px; font: 500 10px/1 'Geist Mono', monospace; color: var(--accent); text-transform: uppercase; }
```

(Verify/add `--danger`, `--accent-ink`, `--accent-tint`, `--surface-alt` in the palette — probably already present.)

**Tests** `__tests__/TodayStrip.test.tsx`:
- Renders hour labels.
- Renders event blocks from stub provider.
- Renders a scheduled task as task-kind block.
- NOW line rendered.
- Drop on a free slot fires `onScheduleTask` with correct args. (Use `fireEvent.dragStart`, `fireEvent.drop` with a DataTransfer shim.)

**Commit:** `Add TodayStrip with events, free slots, drag-drop, NOW line`

---

### 4.6 Today layout integration

**Modify `TasksView.tsx`:**

When `state.tab === 'today'`, render:

```tsx
<div className="today-layout">
  <TodayPlate tasks={filteredTasks} {...props} />
  <TodayStrip
    tasks={filteredTasks}
    calendar={stubCalendarProvider}
    onScheduleTask={(taskId, slotStart) => onUpdate(taskId, { dueDate: slotStart })}
  />
</div>
```

The Today filter (preset) must include `scheduled today` tasks too. Double-check the filter in `taskFilters.ts` handles that — if preset filters are `status: todo/in_progress`, filtering by due-bucket is not applied unless chip is on. This is fine: the Plate does its own sectioning, and the Strip does its own filtering.

**Optional:** When a task is dropped, bump its status from `todo` → `in_progress`? **No.** Scheduling shouldn't change status. Leave as-is.

**Commit:** `Wire TodayPlate + TodayStrip into TasksView when tab=today`

---

### 4.7 Drag-to-schedule undo toast

Reuse the delete-undo toast pattern from Phase 5.5 of the abandoned branch. Add a new variant:

```ts
showUndo({
  message: `Scheduled "${task.title}" at ${formatTime(slot.start)}. Undo`,
  onUndo: () => onUpdate(task.id, { dueDate: previousDueDate }),
});
```

Capture `previousDueDate` in the handler before the update.

**Commit:** `Add undo toast for drag-to-schedule`

---

### 4.8 Keyboard alternative: `s` opens Schedule popover

Add a menu item to the task-row's overflow menu (or direct keyboard binding when row is focused): press `s` on focused row → opens a popover listing available 15-min free slots. Enter confirms, Esc cancels.

**Create** `src/components/tasks/SchedulePopover.tsx`:

```tsx
// Props: anchorEl, freeSlots, onSelect(slotStart), onClose
// Renders a list of slots: "9:00 (30 min)", "10:30 (2h)" etc.
// Enter picks first or currently-focused option.
```

Wire: in `useKeyboardNav`, when `s` pressed on focused row and tab === 'today', emit `openSchedulePopover(taskId)`. TasksView owns the popover state; on select, call `onUpdate` with the `dueDate: slot.start`.

**Commit:** `Add 's' key and Schedule popover for keyboard-driven scheduling`

---

### 4.9 Phase 4 checkpoint + manual QA

Run all tests + tsc.

Manual QA checklist:
- [ ] Today tab shows Plate (left) + Strip (right 280px).
- [ ] Plate has Overdue / Scheduled / Today sections; empty ones hide.
- [ ] Strip shows 4 stub events at correct times with correct durations.
- [ ] Free slots appear as dashed boxes with "◌ 30 min" labels.
- [ ] NOW line appears at current time (within the day window), updates every minute.
- [ ] Dragging a task row from the Plate over a free slot highlights the slot.
- [ ] Dropping schedules the task at the slot start (task moves from TODAY → SCHEDULED section; block appears in Strip).
- [ ] Undo toast appears; Undo reverts.
- [ ] Dropping over an event shows reject feedback; no change.
- [ ] Pressing `s` on a focused row opens Schedule popover; Enter schedules.
- [ ] Reduced-motion: `prefers-reduced-motion` disables drag-over transitions.
- [ ] Accessibility: Strip has `aria-label`, blocks have readable text, NOW line has a label.

If all green, **Phase 4 (and the whole Approach C redesign) ships.**

---

## Definition of done

- All phases 1–4 complete with commits on `tasks-page-c`.
- `npx vitest run` green (expected ~150+ tests including ported ones).
- `npx tsc --noEmit` clean.
- Manual QA of all phase checklists passing.
- Final commit: `Approach C — tasks page redesign complete`.
- PR opened against `master`, titled `Tasks page redesign: smart views + calendar stub (Approach C)`. PR body summarizes the five tabs, Plate+Strip, drag-to-schedule, and notes that Google Calendar is stubbed and will be a follow-up project.

## Follow-ups explicitly out of scope

1. Real Google Calendar integration (replaces `stubCalendarProvider`).
2. Fix `ScheduleView` nav item — it still relies on EventKit; when real GCal lands, the view will adopt the same provider.
3. Explicit `triagedAt` column if heuristic proves wrong.
4. Drag-block resize, reschedule within Strip (drag block itself).
5. Multi-day Upcoming timeline.
6. Write-back to calendar on drop (creates a calendar event for time blocks).
7. All-day events in Strip.

## Review hand-off notes for the implementer

- If porting from the branch reveals a module has diverged beyond recognition (unlikely but possible), stop and ask for guidance rather than rewriting.
- The abandoned branch's tests are the source of truth for the ported modules' behavior. Do NOT delete or rewrite those tests during port — they guard against regressions.
- `tsconfig.json`'s `"ignoreDeprecations": "6.0"` line MUST remain — TS 6 treats `baseUrl` as a hard error without it.
- If `updateTask` with empty patch doesn't bump `updatedAt`, that needs to be fixed for "Dismiss all → Later" to work. Check `electron/database.ts` behavior; most likely the `UPDATE tasks SET updatedAt = datetime('now') WHERE id = ?` always runs.
- Drag-drop tests are notoriously flaky in jsdom — rely on unit-level handler tests and the manual QA checklist. Don't burn time on full integration DnD tests in vitest.
- Keep the CSS organized: a clear comment header for each new block (`/* Tab strip */`, `/* New tab */`, `/* Today Plate + Strip */`). Don't interleave with existing rules.
- Every commit message should start with a verb (`Add`, `Port`, `Wire`, `Remove`, `Fix`) and describe the change's intent, not its mechanics.


```
src/components/tasks/
  (ported from tasks-page-redesign)
  TasksView.tsx            — rewritten shell, routes tabs
  TaskRow.tsx              — ported, + drag handle
  TaskGroup.tsx            — ported
  ControlBar.tsx           — ported, + per-tab variants
  QuickAddBar.tsx          — ported verbatim
  Popover.tsx              — ported verbatim
  DuePopover.tsx           — ported, + "Schedule at…"
  SourceNotePeek.tsx       — ported verbatim
  BulkActionBar.tsx        — ported, + "Triage to Today"
  CheatsheetOverlay.tsx    — ported, + new shortcuts
  (new in v2)
  TabStrip.tsx
  TodayPlate.tsx
  TodayStrip.tsx
  TriagedPredicate.ts
  tabPresets.ts
  useDragToSchedule.ts
  useNow.ts
  (ported)
  taskFilters.ts           — + triaged predicate + smart sort
  useTasksViewState.ts     — + `tab` field
  parseQuickAdd.ts         — verbatim
  useKeyboardNav.ts        — + tab-switching keys
  __tests__/ …
src/lib/
  calendar.ts              — CalendarProvider interface + stub
  timeSlots.ts             — pure computeFreeSlots
  __tests__/ …
electron/
  database.ts              — Phase 1 migration (ported)
  __tests__/database.test.ts — migration tests (ported)
```

---
