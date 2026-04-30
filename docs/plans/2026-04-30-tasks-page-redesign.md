# Tasks Page Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current flat-list `TaskListView` with a power-user Tasks page (Linear-style): quick-add bar with NL parsing, search/filter/sort/group controls, inline-editable rows, multi-select + bulk actions, keyboard-first navigation, source-note hover peek, and first-class manual (non-extracted) tasks.

**Architecture:** New `src/components/tasks/` module hosts a `TasksView` shell + 13 subcomponents/utilities. View state lives in a single reducer hydrated from URL hash and `localStorage`. Tasks list ownership stays in `App.tsx`; mutations flow through existing `api.tasks.*` with optimistic local updates and rollback. One backend change: a SQLite migration to drop `NOT NULL` from `tasks.sourceNoteId` (manual tasks have no source note).

**Tech Stack:** React 19 + TypeScript + Vite (renderer); Express + better-sqlite3 (server); Vitest + @testing-library/react (tests). No new runtime dependencies.

**Design source of truth:** `docs/plans/2026-04-30-tasks-page-redesign-design.md` and `DESIGN.md`. Visual specs in this plan are summaries — defer to design doc on conflict.

**Phasing:** Five phases, each independently shippable.
1. **Backend** — schema migration + manual tasks (≈1 day).
2. **Foundation** — `TasksView` shell + view-state reducer + filters/sort/group, replacing `TaskListView` with feature parity (≈1.5 days).
3. **Quick-add + manual tasks** — bar, NL parser, optimistic create (≈1 day).
4. **Row power** — inline edit, popovers, hover peek, overflow menu (≈1.5 days).
5. **Multi-select + keyboard + cheatsheet + first-run tip** (≈1 day).

---

## Phase 1 — Backend: nullable `sourceNoteId` and manual tasks

### Task 1.1: Update `Task` types to allow `sourceNoteId: number | null`

**Files:**
- Modify: `electron/database.ts:12-23` (the local `Task` interface)
- Modify: `src/api.ts:10-21` (the exported `Task` interface)

**Step 1: Change the type in `electron/database.ts`**

Edit `electron/database.ts:19` from:

```ts
sourceNoteId: number;
```

to:

```ts
sourceNoteId: number | null;
```

**Step 2: Change the type in `src/api.ts`**

Edit `src/api.ts:17` from:

```ts
sourceNoteId: number;
```

to:

```ts
sourceNoteId: number | null;
```

**Step 3: Run typecheck — expect failures**

Run: `npx tsc --noEmit`
Expected: errors in `src/components/TaskListView.tsx` (it passes `task.sourceNoteId` to `onNavigateToNote(noteId: number)`), and possibly in `src/App.tsx`. Note them but **do not fix yet** — Phase 2 replaces `TaskListView` and Phase 1 only fixes the immediate render path.

**Step 4: Fix only the existing `TaskListView` to compile**

In `src/components/TaskListView.tsx:124`, guard the source link:

```tsx
{task.sourceNoteId != null && (
  <button
    type="button"
    className="task-source-link"
    onClick={() => onNavigateToNote(task.sourceNoteId!)}
  >
    View note
  </button>
)}
```

Run `npx tsc --noEmit` again — expected: clean.

**Step 5: Commit**

```bash
git add electron/database.ts src/api.ts src/components/TaskListView.tsx
git commit -m "feat(tasks): allow null sourceNoteId for manual tasks (types)"
```

### Task 1.2: Write the failing migration test

**Files:**
- Create: `electron/__tests__/database.test.ts`

**Step 1: Write the test**

Create `electron/__tests__/database.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { Database } from '../database';

function tmpDb(): string {
  return path.join(os.tmpdir(), `noto-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
}

describe('Database migration: nullable sourceNoteId', () => {
  let dbPath: string;

  beforeEach(() => { dbPath = tmpDb(); });
  afterEach(() => { try { fs.unlinkSync(dbPath); } catch {} });

  it('migrates an existing tasks table with NOT NULL sourceNoteId to nullable', () => {
    // Simulate a pre-migration database.
    const raw = new BetterSqlite3(dbPath);
    raw.exec(`
      CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', folderId INTEGER, createdAt TEXT NOT NULL DEFAULT (datetime('now')), updatedAt TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL CHECK(priority IN ('high','medium','low')),
        status TEXT NOT NULL CHECK(status IN ('todo','in_progress','done')),
        dueDate TEXT,
        sourceNoteId INTEGER NOT NULL REFERENCES notes(id),
        sourceText TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    raw.prepare('INSERT INTO notes (title) VALUES (?)').run('A note');
    raw.prepare("INSERT INTO tasks (title, priority, status, sourceNoteId) VALUES (?, ?, ?, ?)")
      .run('Existing', 'medium', 'todo', 1);
    raw.close();

    // Open via Database — migration should run.
    const db = new Database(dbPath);
    const tasks = db.listTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Existing');
    expect(tasks[0].sourceNoteId).toBe(1);

    // Insert a manual task (sourceNoteId null) — should succeed now.
    const manual = db.createTask({
      title: 'Manual task',
      description: '',
      priority: 'medium',
      status: 'todo',
      dueDate: null,
      sourceNoteId: null,
      sourceText: '',
    });
    expect(manual.sourceNoteId).toBeNull();
    db.close();
  });

  it('is idempotent — running migration twice does not double-migrate or corrupt rows', () => {
    const db1 = new Database(dbPath);
    db1.close();
    const db2 = new Database(dbPath);
    // Should still allow null sourceNoteId.
    const t = db2.createTask({
      title: 'X', description: '', priority: 'low', status: 'todo',
      dueDate: null, sourceNoteId: null, sourceText: '',
    });
    expect(t.sourceNoteId).toBeNull();
    db2.close();
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run electron/__tests__/database.test.ts`
Expected: FAIL — first test fails with `NOT NULL constraint failed: tasks.sourceNoteId` when the manual task insert runs.

**Step 3: Commit the failing test**

```bash
git add electron/__tests__/database.test.ts
git commit -m "test(database): failing test for nullable sourceNoteId migration"
```

### Task 1.3: Implement the migration

**Files:**
- Modify: `electron/database.ts:58-100` (`migrate` method)

**Step 1: Replace the `migrate` method**

Replace the entire `migrate()` method body (lines 58–100) with:

```ts
private migrate() {
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parentId INTEGER REFERENCES folders(id)
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      folderId INTEGER REFERENCES folders(id),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL CHECK(priority IN ('high','medium','low')),
      status TEXT NOT NULL CHECK(status IN ('todo','in_progress','done')),
      dueDate TEXT,
      sourceNoteId INTEGER REFERENCES notes(id),
      sourceText TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dismissed_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      noteId INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      titleNorm TEXT NOT NULL,
      sourceText TEXT NOT NULL DEFAULT '',
      sourceTextNorm TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_dismissed_note ON dismissed_suggestions(noteId);
  `);

  // Migration: drop NOT NULL on tasks.sourceNoteId for manual tasks.
  // SQLite cannot ALTER a column's nullability — rebuild the table if needed.
  const cols = this.db.prepare('PRAGMA table_info(tasks)').all() as Array<{
    name: string; notnull: number;
  }>;
  const sourceCol = cols.find((c) => c.name === 'sourceNoteId');
  if (sourceCol && sourceCol.notnull === 1) {
    this.db.exec(`
      BEGIN;
      CREATE TABLE tasks_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL CHECK(priority IN ('high','medium','low')),
        status TEXT NOT NULL CHECK(status IN ('todo','in_progress','done')),
        dueDate TEXT,
        sourceNoteId INTEGER REFERENCES notes(id),
        sourceText TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO tasks_new (id, title, description, priority, status, dueDate, sourceNoteId, sourceText, createdAt, updatedAt)
        SELECT id, title, description, priority, status, dueDate, sourceNoteId, sourceText, createdAt, updatedAt FROM tasks;
      DROP TABLE tasks;
      ALTER TABLE tasks_new RENAME TO tasks;
      COMMIT;
    `);
  }
}
```

Note: the `CREATE TABLE IF NOT EXISTS tasks` already drops `NOT NULL` for fresh DBs. The migration block only runs on existing DBs that were created with the old schema.

**Step 2: Run the test to verify it passes**

Run: `npx vitest run electron/__tests__/database.test.ts`
Expected: PASS — both tests green.

**Step 3: Run all backend tests to make sure nothing else broke**

Run: `npx vitest run electron/`
Expected: all PASS.

**Step 4: Commit**

```bash
git add electron/database.ts
git commit -m "feat(database): migrate tasks.sourceNoteId to nullable for manual tasks"
```

### Task 1.4: Backup `noto.db` before first migration

**Files:**
- Modify: `electron/database.ts` constructor

**Step 1: Add a one-shot backup before migration**

Before the `this.migrate()` call in the constructor (currently `database.ts:55`), insert:

```ts
import * as fs from 'node:fs';
// ... in constructor, after pragma:
try {
  const cols = this.db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string; notnull: number }>;
  const sourceCol = cols.find((c) => c.name === 'sourceNoteId');
  if (sourceCol && sourceCol.notnull === 1 && fs.existsSync(dbPath)) {
    const backup = `${dbPath}.bak.${Date.now()}`;
    fs.copyFileSync(dbPath, backup);
  }
} catch {
  // best-effort backup; do not block migration
}
```

Add `import * as fs from 'node:fs';` to the top of the file if not already present.

**Step 2: Verify all tests still pass**

Run: `npx vitest run electron/`
Expected: PASS.

**Step 3: Commit**

```bash
git add electron/database.ts
git commit -m "feat(database): back up DB before first tasks-table migration"
```

### Task 1.5: Verify server route accepts manual tasks (no code change expected)

**Files:**
- Inspect only: `server/server.js:106-109` (`POST /api/tasks`)

**Step 1: Confirm the route**

The route currently does `db.createTask(req.body)` directly — it already passes `sourceNoteId: null` through. No code change.

**Step 2: Manual sanity check**

Run: `npm run build:server && node -e "const {Database} = require('./electron-dist/database'); const d = new Database('/tmp/noto-sanity.db'); const n = d.createNote({title:'n', content:'', folderId:null}); const t = d.createTask({title:'manual', description:'', priority:'medium', status:'todo', dueDate:null, sourceNoteId:null, sourceText:''}); console.log(t); d.close();"`
Expected: prints the task with `sourceNoteId: null`.

Cleanup: `rm -f /tmp/noto-sanity.db /tmp/noto-sanity.db-*`.

**Step 3: No commit needed.** Phase 1 ships. Move to Phase 2.

---

## Phase 2 — Foundation: `TasksView` shell, view-state reducer, filters/sort/group (feature parity)

This phase replaces `TaskListView` with `TasksView` and ships the structural rewrite. No new interactions yet — keep current behavior (status cycle, navigate to note) intact.

### Task 2.1: Create the directory and write pure filter/sort/group logic with tests

**Files:**
- Create: `src/components/tasks/taskFilters.ts`
- Create: `src/components/tasks/__tests__/taskFilters.test.ts`

**Step 1: Write the failing tests**

Create `src/components/tasks/__tests__/taskFilters.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyView, type ViewState, dueBucket } from '../taskFilters';
import type { Task } from '../../../api';

const T = (overrides: Partial<Task>): Task => ({
  id: 0,
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  dueDate: null,
  sourceNoteId: 1,
  sourceText: '',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
  ...overrides,
});

const DEFAULT_VIEW: ViewState = {
  search: '',
  status: ['todo', 'in_progress'],
  priority: [],
  due: [],
  noteIds: [],
  sort: 'due-asc',
  group: 'status',
  collapsed: {},
  selection: new Set(),
};

describe('taskFilters', () => {
  it('default view: open statuses only', () => {
    const tasks = [T({ id: 1, status: 'todo' }), T({ id: 2, status: 'done' })];
    const groups = applyView(tasks, DEFAULT_VIEW);
    const ids = groups.flatMap((g) => g.tasks.map((t) => t.id));
    expect(ids).toEqual([1]);
  });

  it('search matches title case-insensitively', () => {
    const tasks = [T({ id: 1, title: 'Send Q2 report' }), T({ id: 2, title: 'unrelated' })];
    const groups = applyView(tasks, { ...DEFAULT_VIEW, search: 'q2' });
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual([1]);
  });

  it('priority filter narrows', () => {
    const tasks = [T({ id: 1, priority: 'high' }), T({ id: 2, priority: 'low' })];
    const groups = applyView(tasks, { ...DEFAULT_VIEW, priority: ['high'] });
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual([1]);
  });

  it('due bucket: overdue includes past, today is today, none is null', () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86_400_000).toISOString();
    const tomorrow = new Date(today.getTime() + 86_400_000).toISOString();
    expect(dueBucket(yesterday)).toBe('overdue');
    expect(dueBucket(today.toISOString())).toBe('today');
    expect(dueBucket(tomorrow)).toBe('this-week');
    expect(dueBucket(null)).toBe('none');
  });

  it('group by status produces ordered groups Todo / In Progress / Done', () => {
    const tasks = [T({ id: 1, status: 'done' }), T({ id: 2, status: 'todo' }), T({ id: 3, status: 'in_progress' })];
    const groups = applyView(tasks, { ...DEFAULT_VIEW, status: ['todo', 'in_progress', 'done'] });
    expect(groups.map((g) => g.key)).toEqual(['todo', 'in_progress', 'done']);
  });

  it('sort due-asc: nulls last, overdue earliest first', () => {
    const tasks = [
      T({ id: 1, dueDate: null }),
      T({ id: 2, dueDate: '2026-05-15T00:00:00Z' }),
      T({ id: 3, dueDate: '2026-05-01T00:00:00Z' }),
    ];
    const groups = applyView(tasks, { ...DEFAULT_VIEW, group: 'none' });
    expect(groups[0].tasks.map((t) => t.id)).toEqual([3, 2, 1]);
  });

  it('group by note: tasks without sourceNoteId collect under "manual"', () => {
    const tasks = [T({ id: 1, sourceNoteId: null }), T({ id: 2, sourceNoteId: 5 })];
    const groups = applyView(tasks, { ...DEFAULT_VIEW, group: 'note' });
    expect(groups.find((g) => g.key === 'manual')?.tasks.map((t) => t.id)).toEqual([1]);
  });

  it('noteIds filter with null included matches manual tasks only', () => {
    const tasks = [T({ id: 1, sourceNoteId: null }), T({ id: 2, sourceNoteId: 5 })];
    const groups = applyView(tasks, { ...DEFAULT_VIEW, noteIds: [null] });
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).toEqual([1]);
  });
});
```

**Step 2: Run tests — expect failure**

Run: `npx vitest run src/components/tasks/__tests__/taskFilters.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement `taskFilters.ts`**

Create `src/components/tasks/taskFilters.ts`:

```ts
import type { Task } from '../../api';

export type StatusKey = Task['status'];
export type PriorityKey = Task['priority'];
export type DueBucket = 'overdue' | 'today' | 'this-week' | 'later' | 'none';
export type GroupKey = 'status' | 'due' | 'priority' | 'note' | 'none';
export type SortKey =
  | 'due-asc' | 'due-desc'
  | 'prio-asc' | 'prio-desc'
  | 'created-asc' | 'created-desc'
  | 'title-asc';

export interface ViewState {
  search: string;
  status: StatusKey[];
  priority: PriorityKey[];
  due: DueBucket[];
  noteIds: (number | null)[];
  sort: SortKey;
  group: GroupKey;
  collapsed: Record<string, boolean>;
  selection: Set<number>;
}

export interface Group {
  key: string;
  label: string;
  tasks: Task[];
}

const STATUS_ORDER: StatusKey[] = ['todo', 'in_progress', 'done'];
const STATUS_LABEL: Record<StatusKey, string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const PRIO_RANK: Record<PriorityKey, number> = { high: 0, medium: 1, low: 2 };
const PRIO_ORDER: PriorityKey[] = ['high', 'medium', 'low'];
const DUE_ORDER: DueBucket[] = ['overdue', 'today', 'this-week', 'later', 'none'];
const DUE_LABEL: Record<DueBucket, string> = {
  overdue: 'Overdue', today: 'Today', 'this-week': 'This week', later: 'Later', none: 'No date',
};

function startOfToday(): number {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
}

export function dueBucket(dueDate: string | null): DueBucket {
  if (!dueDate) return 'none';
  const t = new Date(dueDate).getTime();
  if (isNaN(t)) return 'none';
  const today = startOfToday();
  const diff = t - today;
  if (diff < 0) return 'overdue';
  if (diff < 86_400_000) return 'today';
  if (diff < 7 * 86_400_000) return 'this-week';
  return 'later';
}

function passesFilters(t: Task, v: ViewState): boolean {
  if (v.status.length > 0 && !v.status.includes(t.status)) return false;
  if (v.priority.length > 0 && !v.priority.includes(t.priority)) return false;
  if (v.due.length > 0 && !v.due.includes(dueBucket(t.dueDate))) return false;
  if (v.noteIds.length > 0 && !v.noteIds.includes(t.sourceNoteId)) return false;
  if (v.search.trim().length > 0) {
    const q = v.search.toLowerCase();
    if (!t.title.toLowerCase().includes(q) && !t.sourceText.toLowerCase().includes(q)) return false;
  }
  return true;
}

function compare(a: Task, b: Task, sort: SortKey): number {
  switch (sort) {
    case 'due-asc':
    case 'due-desc': {
      const aT = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bT = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const cmp = aT - bT;
      return sort === 'due-asc' ? cmp : -cmp;
    }
    case 'prio-asc':
    case 'prio-desc': {
      const cmp = PRIO_RANK[a.priority] - PRIO_RANK[b.priority];
      return sort === 'prio-asc' ? cmp : -cmp;
    }
    case 'created-asc':
    case 'created-desc': {
      const cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === 'created-asc' ? cmp : -cmp;
    }
    case 'title-asc':
      return a.title.localeCompare(b.title);
  }
}

function groupKeyFor(t: Task, group: GroupKey): { key: string; label: string; order: number } {
  switch (group) {
    case 'status':
      return { key: t.status, label: STATUS_LABEL[t.status], order: STATUS_ORDER.indexOf(t.status) };
    case 'due': {
      const b = dueBucket(t.dueDate);
      return { key: b, label: DUE_LABEL[b], order: DUE_ORDER.indexOf(b) };
    }
    case 'priority':
      return { key: t.priority, label: t.priority[0].toUpperCase() + t.priority.slice(1), order: PRIO_ORDER.indexOf(t.priority) };
    case 'note':
      return t.sourceNoteId == null
        ? { key: 'manual', label: 'Manual', order: Number.POSITIVE_INFINITY }
        : { key: `note:${t.sourceNoteId}`, label: `Note ${t.sourceNoteId}`, order: t.sourceNoteId };
    case 'none':
      return { key: 'all', label: 'All', order: 0 };
  }
}

export function applyView(tasks: Task[], view: ViewState): Group[] {
  const filtered = tasks.filter((t) => passesFilters(t, view));
  const sorted = [...filtered].sort((a, b) => compare(a, b, view.sort));
  const groups = new Map<string, { label: string; order: number; tasks: Task[] }>();
  for (const t of sorted) {
    const { key, label, order } = groupKeyFor(t, view.group);
    if (!groups.has(key)) groups.set(key, { label, order, tasks: [] });
    groups.get(key)!.tasks.push(t);
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, g]) => ({ key, label: g.label, tasks: g.tasks }));
}
```

**Step 4: Run tests — expect pass**

Run: `npx vitest run src/components/tasks/__tests__/taskFilters.test.ts`
Expected: PASS (all 8 cases).

**Step 5: Commit**

```bash
git add src/components/tasks/
git commit -m "feat(tasks): pure filter/sort/group logic with tests"
```

### Task 2.2: Write `useTasksViewState` reducer hook with URL + localStorage tests

**Files:**
- Create: `src/components/tasks/useTasksViewState.ts`
- Create: `src/components/tasks/__tests__/useTasksViewState.test.ts`

**Step 1: Write the failing test**

Create `src/components/tasks/__tests__/useTasksViewState.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTasksViewState, encodeView, decodeView, DEFAULT_VIEW } from '../useTasksViewState';

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  window.localStorage.clear();
});

describe('useTasksViewState', () => {
  it('starts with defaults when no URL hash and no localStorage', () => {
    const { result } = renderHook(() => useTasksViewState());
    expect(result.current.view.status).toEqual(['todo', 'in_progress']);
    expect(result.current.view.sort).toBe('due-asc');
    expect(result.current.view.group).toBe('status');
  });

  it('hydrates from URL hash', () => {
    window.location.hash = encodeView({ ...DEFAULT_VIEW, search: 'foo', priority: ['high'] });
    const { result } = renderHook(() => useTasksViewState());
    expect(result.current.view.search).toBe('foo');
    expect(result.current.view.priority).toEqual(['high']);
  });

  it('hydrates from localStorage when no URL hash', () => {
    localStorage.setItem('noto:tasks:view-state', JSON.stringify({ ...DEFAULT_VIEW, sort: 'title-asc' }));
    const { result } = renderHook(() => useTasksViewState());
    expect(result.current.view.sort).toBe('title-asc');
  });

  it('URL beats localStorage', () => {
    localStorage.setItem('noto:tasks:view-state', JSON.stringify({ ...DEFAULT_VIEW, sort: 'title-asc' }));
    window.location.hash = encodeView({ ...DEFAULT_VIEW, sort: 'created-desc' });
    const { result } = renderHook(() => useTasksViewState());
    expect(result.current.view.sort).toBe('created-desc');
  });

  it('encode/decode round-trip preserves all fields', () => {
    const v = {
      ...DEFAULT_VIEW,
      search: 'q', status: ['done'] as const, priority: ['high', 'low'] as const,
      due: ['overdue', 'today'] as const, noteIds: [1, null],
      sort: 'prio-desc' as const, group: 'due' as const,
    };
    expect(decodeView(encodeView(v as any))).toMatchObject({
      search: 'q', status: ['done'], priority: ['high', 'low'],
      due: ['overdue', 'today'], noteIds: [1, null], sort: 'prio-desc', group: 'due',
    });
  });

  it('invalid URL params silently fall back to defaults', () => {
    window.location.hash = '#tasks?sort=BOGUS&priority=garbage';
    const { result } = renderHook(() => useTasksViewState());
    expect(result.current.view.sort).toBe('due-asc');
    expect(result.current.view.priority).toEqual([]);
  });

  it('mutating view writes to localStorage', () => {
    const { result } = renderHook(() => useTasksViewState());
    act(() => { result.current.setSort('title-asc'); });
    expect(JSON.parse(localStorage.getItem('noto:tasks:view-state') || '{}').sort).toBe('title-asc');
  });
});
```

**Step 2: Run — expect failure**

Run: `npx vitest run src/components/tasks/__tests__/useTasksViewState.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement the hook**

Create `src/components/tasks/useTasksViewState.ts`:

```ts
import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { ViewState, StatusKey, PriorityKey, DueBucket, SortKey, GroupKey } from './taskFilters';

const STORAGE_KEY = 'noto:tasks:view-state';

const VALID_SORT: SortKey[] = ['due-asc', 'due-desc', 'prio-asc', 'prio-desc', 'created-asc', 'created-desc', 'title-asc'];
const VALID_GROUP: GroupKey[] = ['status', 'due', 'priority', 'note', 'none'];
const VALID_STATUS: StatusKey[] = ['todo', 'in_progress', 'done'];
const VALID_PRIO: PriorityKey[] = ['high', 'medium', 'low'];
const VALID_DUE: DueBucket[] = ['overdue', 'today', 'this-week', 'later', 'none'];

export const DEFAULT_VIEW: ViewState = {
  search: '',
  status: ['todo', 'in_progress'],
  priority: [],
  due: [],
  noteIds: [],
  sort: 'due-asc',
  group: 'status',
  collapsed: { done: true },
  selection: new Set(),
};

export function encodeView(v: ViewState): string {
  const p = new URLSearchParams();
  if (v.search) p.set('q', v.search);
  if (v.status.length > 0 && v.status.join(',') !== 'todo,in_progress') p.set('status', v.status.join(','));
  if (v.priority.length > 0) p.set('prio', v.priority.join(','));
  if (v.due.length > 0) p.set('due', v.due.join(','));
  if (v.noteIds.length > 0) p.set('note', v.noteIds.map((n) => n == null ? 'manual' : String(n)).join(','));
  if (v.sort !== 'due-asc') p.set('sort', v.sort);
  if (v.group !== 'status') p.set('group', v.group);
  const qs = p.toString();
  return qs ? `#tasks?${qs}` : '#tasks';
}

export function decodeView(hash: string): Partial<ViewState> {
  const i = hash.indexOf('?');
  if (i < 0) return {};
  const p = new URLSearchParams(hash.slice(i + 1));
  const out: Partial<ViewState> = {};
  const q = p.get('q'); if (q != null) out.search = q;
  const status = p.get('status')?.split(',').filter((s) => VALID_STATUS.includes(s as StatusKey)) as StatusKey[] | undefined;
  if (status?.length) out.status = status;
  const prio = p.get('prio')?.split(',').filter((s) => VALID_PRIO.includes(s as PriorityKey)) as PriorityKey[] | undefined;
  if (prio?.length) out.priority = prio;
  const due = p.get('due')?.split(',').filter((s) => VALID_DUE.includes(s as DueBucket)) as DueBucket[] | undefined;
  if (due?.length) out.due = due;
  const note = p.get('note')?.split(',').map((s) => s === 'manual' ? null : Number(s)).filter((n) => n === null || Number.isFinite(n));
  if (note?.length) out.noteIds = note as (number | null)[];
  const sort = p.get('sort'); if (sort && VALID_SORT.includes(sort as SortKey)) out.sort = sort as SortKey;
  const group = p.get('group'); if (group && VALID_GROUP.includes(group as GroupKey)) out.group = group as GroupKey;
  return out;
}

type Action =
  | { type: 'set'; patch: Partial<ViewState> }
  | { type: 'toggle-collapsed'; key: string }
  | { type: 'select'; ids: number[]; mode: 'replace' | 'add' | 'toggle' }
  | { type: 'clear-selection' };

function reducer(state: ViewState, action: Action): ViewState {
  switch (action.type) {
    case 'set': return { ...state, ...action.patch };
    case 'toggle-collapsed': return { ...state, collapsed: { ...state.collapsed, [action.key]: !state.collapsed[action.key] } };
    case 'select': {
      const next = new Set(action.mode === 'replace' ? [] : state.selection);
      for (const id of action.ids) {
        if (action.mode === 'toggle' && next.has(id)) next.delete(id);
        else next.add(id);
      }
      return { ...state, selection: next };
    }
    case 'clear-selection': return { ...state, selection: new Set() };
  }
}

function loadInitial(): ViewState {
  try {
    const fromUrl = decodeView(window.location.hash);
    if (Object.keys(fromUrl).length > 0) return { ...DEFAULT_VIEW, ...fromUrl, selection: new Set(), collapsed: DEFAULT_VIEW.collapsed };
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ViewState>;
      return { ...DEFAULT_VIEW, ...parsed, selection: new Set(), collapsed: { ...DEFAULT_VIEW.collapsed, ...(parsed.collapsed ?? {}) } };
    }
  } catch { /* fall through */ }
  return { ...DEFAULT_VIEW, selection: new Set() };
}

export function useTasksViewState() {
  const [view, dispatch] = useReducer(reducer, undefined, loadInitial);
  const urlTimer = useRef<number | null>(null);

  useEffect(() => {
    const persisted = { ...view, selection: undefined };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)); } catch {}
    if (urlTimer.current) window.clearTimeout(urlTimer.current);
    urlTimer.current = window.setTimeout(() => {
      const target = encodeView(view);
      if (window.location.hash !== target && window.location.hash !== '') {
        window.history.replaceState({}, '', target);
      } else if (window.location.hash === '' && target !== '#tasks') {
        window.history.replaceState({}, '', target);
      }
    }, 100);
    return () => { if (urlTimer.current) window.clearTimeout(urlTimer.current); };
  }, [view]);

  return {
    view,
    setSearch: useCallback((s: string) => dispatch({ type: 'set', patch: { search: s } }), []),
    setStatus: useCallback((status: StatusKey[]) => dispatch({ type: 'set', patch: { status } }), []),
    setPriority: useCallback((priority: PriorityKey[]) => dispatch({ type: 'set', patch: { priority } }), []),
    setDue: useCallback((due: DueBucket[]) => dispatch({ type: 'set', patch: { due } }), []),
    setNoteIds: useCallback((noteIds: (number | null)[]) => dispatch({ type: 'set', patch: { noteIds } }), []),
    setSort: useCallback((sort: SortKey) => dispatch({ type: 'set', patch: { sort } }), []),
    setGroup: useCallback((group: GroupKey) => dispatch({ type: 'set', patch: { group } }), []),
    toggleCollapsed: useCallback((key: string) => dispatch({ type: 'toggle-collapsed', key }), []),
    select: useCallback((ids: number[], mode: 'replace' | 'add' | 'toggle' = 'replace') => dispatch({ type: 'select', ids, mode }), []),
    clearSelection: useCallback(() => dispatch({ type: 'clear-selection' }), []),
    resetFilters: useCallback(() => dispatch({ type: 'set', patch: { search: '', status: ['todo', 'in_progress'], priority: [], due: [], noteIds: [] } }), []),
  };
}
```

**Step 4: Run — expect pass**

Run: `npx vitest run src/components/tasks/__tests__/useTasksViewState.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/tasks/useTasksViewState.ts src/components/tasks/__tests__/useTasksViewState.test.ts
git commit -m "feat(tasks): view-state reducer hook with URL + localStorage persistence"
```

### Task 2.3: Build `TasksView` shell with feature parity to current `TaskListView`

**Files:**
- Create: `src/components/tasks/TasksView.tsx`
- Create: `src/components/tasks/TaskGroup.tsx`
- Create: `src/components/tasks/TaskRow.tsx`
- Modify: `src/App.tsx` (swap import + render line)

**Step 1: Write a parity component test**

Create `src/components/tasks/__tests__/TasksView.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TasksView } from '../TasksView';
import type { Task } from '../../../api';

const T = (over: Partial<Task>): Task => ({
  id: 0, title: '', description: '', priority: 'medium', status: 'todo',
  dueDate: null, sourceNoteId: 1, sourceText: '',
  createdAt: '2026-04-01T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z', ...over,
});

describe('TasksView (parity)', () => {
  beforeEach(() => { window.history.replaceState({}, '', '/'); window.localStorage.clear(); });

  it('renders three status groups by default and shows To Do tasks', () => {
    const tasks = [T({ id: 1, title: 'Alpha', status: 'todo' }), T({ id: 2, title: 'Beta', status: 'done' })];
    render(<TasksView tasks={tasks} notes={[]} onUpdateStatus={() => {}} onNavigateToNote={() => {}} onCreateTask={async () => null} onUpdateTask={async () => {}} onDeleteTask={async () => {}} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    // Beta is in 'done', filtered out by default 'open' status filter.
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });

  it('clicking the checkbox calls onUpdateStatus with the next status', () => {
    const handler = vi.fn();
    const tasks = [T({ id: 1, title: 'Alpha', status: 'todo' })];
    render(<TasksView tasks={tasks} notes={[]} onUpdateStatus={handler} onNavigateToNote={() => {}} onCreateTask={async () => null} onUpdateTask={async () => {}} onDeleteTask={async () => {}} />);
    fireEvent.click(screen.getByLabelText(/cycle status/i));
    expect(handler).toHaveBeenCalledWith(1, 'in_progress');
  });

  it('shows "No tasks yet." empty state when there are zero tasks', () => {
    render(<TasksView tasks={[]} notes={[]} onUpdateStatus={() => {}} onNavigateToNote={() => {}} onCreateTask={async () => null} onUpdateTask={async () => {}} onDeleteTask={async () => {}} />);
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run — expect failure**

Run: `npx vitest run src/components/tasks/__tests__/TasksView.test.tsx`
Expected: FAIL — module not found.

**Step 3: Implement `TaskRow.tsx`**

Create `src/components/tasks/TaskRow.tsx`. Rough skeleton (full code in design doc spec — keep this implementation minimal for Phase 2; popovers and inline edit come in Phase 4):

```tsx
import { memo } from 'react';
import type { Task } from '../../api';
import { IconCheck } from '../Icons';

interface Props {
  task: Task;
  selected: boolean;
  focused: boolean;
  onUpdateStatus: (id: number, status: Task['status']) => void;
  onNavigateToNote: (noteId: number) => void;
}

const NEXT: Record<Task['status'], Task['status']> = {
  todo: 'in_progress', in_progress: 'done', done: 'todo',
};
const STATUS_LABEL: Record<Task['status'], string> = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };

function startOfToday(): number { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }

function formatDue(due: string | null): string {
  if (!due) return '';
  const d = new Date(due); if (isNaN(d.getTime())) return due;
  const today = startOfToday();
  const diff = Math.floor((d.getTime() - today) / 86_400_000);
  if (diff < 0) return `OVERDUE · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}`;
  if (diff === 0) return 'TODAY'; if (diff === 1) return 'TOMORROW';
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

export const TaskRow = memo(function TaskRow({ task, selected, focused, onUpdateStatus, onNavigateToNote }: Props) {
  const overdue = task.status !== 'done' && task.dueDate && new Date(task.dueDate).getTime() < startOfToday();
  return (
    <div
      role="listitem"
      aria-selected={selected}
      className={`task-row${task.status === 'done' ? ' done' : ''}${overdue ? ' overdue' : ''}${selected ? ' selected' : ''}${focused ? ' focused' : ''}`}
    >
      <button
        type="button"
        className="task-checkbox"
        title={`Mark ${STATUS_LABEL[task.status]} → ${STATUS_LABEL[NEXT[task.status]]}`}
        aria-label="Cycle status"
        onClick={() => onUpdateStatus(task.id, NEXT[task.status])}
      >
        {task.status === 'done' && <IconCheck />}
      </button>

      <span className={`prio-dot prio-${task.priority}`} aria-label={`priority ${task.priority}`} />

      <div className="task-title">{task.title}</div>

      {task.dueDate && <span className="task-due">{formatDue(task.dueDate)}</span>}

      {task.sourceNoteId != null ? (
        <button
          type="button"
          className="source-pill"
          onClick={() => onNavigateToNote(task.sourceNoteId!)}
        >
          note {task.sourceNoteId}
        </button>
      ) : (
        <span className="source-pill manual">manual</span>
      )}
    </div>
  );
});
```

**Step 4: Implement `TaskGroup.tsx`**

Create `src/components/tasks/TaskGroup.tsx`:

```tsx
import type { Group } from './taskFilters';
import type { Task } from '../../api';
import { TaskRow } from './TaskRow';

interface Props {
  group: Group;
  collapsed: boolean;
  selection: Set<number>;
  focusedId: number | null;
  onToggleCollapsed: (key: string) => void;
  onUpdateStatus: (id: number, status: Task['status']) => void;
  onNavigateToNote: (noteId: number) => void;
}

export function TaskGroup({ group, collapsed, selection, focusedId, onToggleCollapsed, onUpdateStatus, onNavigateToNote }: Props) {
  return (
    <div className="task-group">
      <button
        type="button"
        className="group-label"
        aria-expanded={!collapsed}
        onClick={() => onToggleCollapsed(group.key)}
      >
        <span className={`group-caret${collapsed ? ' collapsed' : ''}`}>▾</span>
        <span>{group.label.toUpperCase()}</span>
        <span className="group-count">· {group.tasks.length}</span>
      </button>
      {!collapsed && group.tasks.length === 0 && <div className="empty-section group-empty">Empty</div>}
      {!collapsed && group.tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          selected={selection.has(t.id)}
          focused={focusedId === t.id}
          onUpdateStatus={onUpdateStatus}
          onNavigateToNote={onNavigateToNote}
        />
      ))}
    </div>
  );
}
```

**Step 5: Implement `TasksView.tsx` (Phase 2 minimal)**

Create `src/components/tasks/TasksView.tsx`:

```tsx
import { useMemo } from 'react';
import type { Task, Note } from '../../api';
import { applyView } from './taskFilters';
import { useTasksViewState } from './useTasksViewState';
import { TaskGroup } from './TaskGroup';

interface Props {
  tasks: Task[];
  notes: Note[];
  onUpdateStatus: (id: number, status: Task['status']) => void;
  onNavigateToNote: (noteId: number) => void;
  onCreateTask: (data: { title: string; priority: Task['priority']; dueDate: string | null; sourceNoteId: number | null }) => Promise<Task | null>;
  onUpdateTask: (id: number, patch: Partial<Pick<Task, 'title' | 'priority' | 'dueDate' | 'description'>>) => Promise<void>;
  onDeleteTask: (id: number) => Promise<void>;
}

export function TasksView({ tasks, onUpdateStatus, onNavigateToNote }: Props) {
  const vs = useTasksViewState();
  const groups = useMemo(() => applyView(tasks, vs.view), [tasks, vs.view]);
  const openCount = tasks.filter((t) => t.status !== 'done').length;
  const doneCount = tasks.length - openCount;

  return (
    <section className="view tasks-view" aria-label="Tasks">
      <div className="view-head">
        <h1 className="view-title">Tasks</h1>
        <div className="view-meta">{openCount} OPEN · {doneCount} DONE</div>
      </div>

      <div className="view-body">
        {tasks.length === 0 && (
          <div className="empty-section">
            No tasks yet. Write a note and Noto will find them. Or press <kbd>c</kbd> to add one.
          </div>
        )}
        {groups.map((g) => (
          <TaskGroup
            key={g.key}
            group={g}
            collapsed={!!vs.view.collapsed[g.key]}
            selection={vs.view.selection}
            focusedId={null}
            onToggleCollapsed={vs.toggleCollapsed}
            onUpdateStatus={onUpdateStatus}
            onNavigateToNote={onNavigateToNote}
          />
        ))}
      </div>
    </section>
  );
}
```

**Step 6: Wire into `App.tsx`**

In `src/App.tsx`:
- Replace `import { TaskListView } from './components/TaskListView';` with `import { TasksView } from './components/tasks/TasksView';`.
- Replace the `<TaskListView … />` block (around line 540) with:

```tsx
<TasksView
  tasks={tasks}
  notes={notes}
  onUpdateStatus={handleUpdateTaskStatus}
  onNavigateToNote={handleNavigateToNote}
  onCreateTask={async () => null}    // wired in Phase 3
  onUpdateTask={async () => {}}      // wired in Phase 4
  onDeleteTask={async () => {}}      // wired in Phase 4
/>
```

**Step 7: Add minimum CSS so it renders sanely**

Add to `src/styles/app.css` (find an appropriate section near existing `task-row`, `view`, `task-group` rules and adapt them — many already exist). For Phase 2 you only need new rules:

```css
.tasks-view { padding: var(--s-lg) var(--s-xl); max-width: 880px; margin: 0 auto; }
.task-row.selected { background: var(--accent-soft); }
.task-row.focused { box-shadow: inset 0 0 0 1px var(--accent); }
.prio-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; }
.prio-dot.prio-high { background: var(--error); }
.prio-dot.prio-medium { background: var(--warning); }
.prio-dot.prio-low { background: var(--text-soft); }
.source-pill { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 10px; color: var(--text-muted); background: var(--surface-alt); border-radius: 9999px; padding: 1px 6px; border: none; cursor: pointer; }
.source-pill.manual { color: var(--text-soft); cursor: default; }
.group-label { display: flex; gap: 4px; align-items: baseline; background: none; border: none; padding: 0; cursor: pointer; color: var(--text-muted); font-family: 'Geist Mono', ui-monospace, monospace; font-size: 10px; letter-spacing: 0.12em; }
.group-caret { transition: transform var(--motion-fast); }
.group-caret.collapsed { transform: rotate(-90deg); }
.group-empty { color: var(--text-soft); font-style: italic; padding-left: var(--s-md); }
```

**Step 8: Run all tests**

Run: `npx vitest run`
Expected: PASS — including the new `TasksView` parity tests and existing `TaskListView` tests (until removal in step 9).

Run: `npx tsc --noEmit`
Expected: clean.

**Step 9: Delete old `TaskListView` and its test**

Run: `git rm src/components/TaskListView.tsx src/components/__tests__/TaskListView.test.tsx`

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean / PASS.

**Step 10: Commit**

```bash
git add -A
git commit -m "feat(tasks): TasksView shell with view-state, replaces TaskListView (parity)"
```

### Task 2.4: Build `ControlBar.tsx` with search, filter chips, sort, group-by

**Files:**
- Create: `src/components/tasks/ControlBar.tsx`
- Create: `src/components/tasks/Popover.tsx` (small reusable popover primitive)
- Modify: `src/components/tasks/TasksView.tsx` (mount the control bar)
- Add: CSS in `src/styles/app.css`
- Test: `src/components/tasks/__tests__/TasksView.test.tsx` (extend)

**Step 1: Add a failing test for the control bar behavior**

Append to `src/components/tasks/__tests__/TasksView.test.tsx`:

```tsx
import { fireEvent } from '@testing-library/react';

it('typing in search filters the list live', async () => {
  const tasks = [
    T({ id: 1, title: 'Send Q2 report', status: 'todo' }),
    T({ id: 2, title: 'Refactor extraction', status: 'todo' }),
  ];
  render(<TasksView tasks={tasks} notes={[]} onUpdateStatus={() => {}} onNavigateToNote={() => {}} onCreateTask={async () => null} onUpdateTask={async () => {}} onDeleteTask={async () => {}} />);
  fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'q2' } });
  expect(screen.getByText('Send Q2 report')).toBeInTheDocument();
  expect(screen.queryByText('Refactor extraction')).not.toBeInTheDocument();
});

it('changing group-by to "none" produces a single flat group', () => {
  const tasks = [T({ id: 1, title: 'A', status: 'todo' }), T({ id: 2, title: 'B', status: 'in_progress' })];
  render(<TasksView tasks={tasks} notes={[]} onUpdateStatus={() => {}} onNavigateToNote={() => {}} onCreateTask={async () => null} onUpdateTask={async () => {}} onDeleteTask={async () => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /group: status/i }));
  fireEvent.click(screen.getByRole('menuitem', { name: /none/i }));
  expect(screen.queryByText('TO DO')).not.toBeInTheDocument();
  expect(screen.queryByText('IN PROGRESS')).not.toBeInTheDocument();
});
```

**Step 2: Run — expect failure**

Run: `npx vitest run src/components/tasks/__tests__/TasksView.test.tsx`
Expected: FAIL — search input not present, group button not present.

**Step 3: Implement `Popover.tsx`**

Create `src/components/tasks/Popover.tsx`:

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
}

export function Popover({ trigger, children, align = 'left' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  return (
    <div className="popover-wrap" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div className={`popover popover-${align}`} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Implement `ControlBar.tsx`**

Create `src/components/tasks/ControlBar.tsx`:

```tsx
import type { ViewState, StatusKey, PriorityKey, DueBucket, SortKey, GroupKey } from './taskFilters';
import { Popover } from './Popover';

interface Props {
  view: ViewState;
  setSearch: (s: string) => void;
  setStatus: (s: StatusKey[]) => void;
  setPriority: (s: PriorityKey[]) => void;
  setDue: (s: DueBucket[]) => void;
  setSort: (s: SortKey) => void;
  setGroup: (s: GroupKey) => void;
}

const SORT_LABEL: Record<SortKey, string> = {
  'due-asc': 'Due ↑', 'due-desc': 'Due ↓',
  'prio-asc': 'Priority ↑', 'prio-desc': 'Priority ↓',
  'created-asc': 'Created ↑', 'created-desc': 'Created ↓',
  'title-asc': 'Title A→Z',
};
const GROUP_LABEL: Record<GroupKey, string> = {
  status: 'status', due: 'due', priority: 'priority', note: 'note', none: 'none',
};

function toggle<T>(arr: T[], v: T): T[] { return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]; }

export function ControlBar({ view, setSearch, setStatus, setPriority, setDue, setSort, setGroup }: Props) {
  return (
    <div className="control-bar">
      <input
        type="search"
        className="control-search"
        placeholder="/search…"
        value={view.search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Popover
        trigger={(_, t) => (
          <button type="button" className={`control-chip${view.status.join(',') !== 'todo,in_progress' ? ' active' : ''}`} onClick={t}>
            status: {view.status.length === 2 && view.status.includes('todo') && view.status.includes('in_progress') ? 'open' : view.status.length ? view.status.join(',') : 'any'} ▾
          </button>
        )}
      >
        {() => (
          <>
            {(['todo', 'in_progress', 'done'] as StatusKey[]).map((s) => (
              <label key={s} className="popover-item" role="menuitem">
                <input type="checkbox" checked={view.status.includes(s)} onChange={() => setStatus(toggle(view.status, s))} /> {s.replace('_', ' ')}
              </label>
            ))}
          </>
        )}
      </Popover>

      <Popover
        trigger={(_, t) => (
          <button type="button" className={`control-chip${view.priority.length ? ' active' : ''}`} onClick={t}>
            priority: {view.priority.length ? view.priority.join(',') : 'any'} ▾
          </button>
        )}
      >
        {() => (
          <>
            {(['high', 'medium', 'low'] as PriorityKey[]).map((p) => (
              <label key={p} className="popover-item" role="menuitem">
                <input type="checkbox" checked={view.priority.includes(p)} onChange={() => setPriority(toggle(view.priority, p))} /> {p}
              </label>
            ))}
          </>
        )}
      </Popover>

      <Popover
        trigger={(_, t) => (
          <button type="button" className={`control-chip${view.due.length ? ' active' : ''}`} onClick={t}>
            due: {view.due.length ? view.due.join(',') : 'any'} ▾
          </button>
        )}
      >
        {() => (
          <>
            {(['overdue', 'today', 'this-week', 'later', 'none'] as DueBucket[]).map((d) => (
              <label key={d} className="popover-item" role="menuitem">
                <input type="checkbox" checked={view.due.includes(d)} onChange={() => setDue(toggle(view.due, d))} /> {d.replace('-', ' ')}
              </label>
            ))}
          </>
        )}
      </Popover>

      <span className="control-spacer" />

      <Popover
        trigger={(_, t) => (
          <button type="button" className="control-chip" onClick={t} aria-label={`sort: ${SORT_LABEL[view.sort]}`}>
            sort: {SORT_LABEL[view.sort]} ▾
          </button>
        )}
      >
        {(close) => (
          <>
            {(Object.keys(SORT_LABEL) as SortKey[]).map((s) => (
              <button key={s} type="button" className={`popover-item${s === view.sort ? ' selected' : ''}`} role="menuitem" onClick={() => { setSort(s); close(); }}>
                {SORT_LABEL[s]}
              </button>
            ))}
          </>
        )}
      </Popover>

      <Popover
        trigger={(_, t) => (
          <button type="button" className="control-chip" onClick={t} aria-label={`group: ${GROUP_LABEL[view.group]}`}>
            group: {GROUP_LABEL[view.group]} ▾
          </button>
        )}
      >
        {(close) => (
          <>
            {(Object.keys(GROUP_LABEL) as GroupKey[]).map((g) => (
              <button key={g} type="button" className={`popover-item${g === view.group ? ' selected' : ''}`} role="menuitem" onClick={() => { setGroup(g); close(); }}>
                {GROUP_LABEL[g]}
              </button>
            ))}
          </>
        )}
      </Popover>
    </div>
  );
}
```

**Step 5: Mount the control bar in `TasksView.tsx`**

In `TasksView.tsx`, add `import { ControlBar } from './ControlBar';` and render it between the head and body:

```tsx
<ControlBar
  view={vs.view}
  setSearch={vs.setSearch}
  setStatus={vs.setStatus}
  setPriority={vs.setPriority}
  setDue={vs.setDue}
  setSort={vs.setSort}
  setGroup={vs.setGroup}
/>
```

**Step 6: Add CSS**

Append to `src/styles/app.css`:

```css
.control-bar { display: flex; flex-wrap: wrap; gap: var(--s-sm); align-items: center; padding: var(--s-sm) 0; border-bottom: 1px solid var(--border-soft); margin-bottom: var(--s-md); }
.control-search { height: 28px; width: 220px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0 var(--s-sm); font: 13px/1 'Geist', system-ui, sans-serif; color: var(--text); }
.control-chip { height: 28px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0 var(--s-sm); font: 500 13px/1 'Geist', system-ui, sans-serif; color: var(--text); cursor: pointer; }
.control-chip.active { border-left-width: 2px; border-left-color: var(--accent); }
.control-spacer { flex: 1; }
.popover-wrap { position: relative; }
.popover { position: absolute; top: calc(100% + 4px); left: 0; min-width: 160px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); box-shadow: 0 8px 24px rgba(31,27,22,0.08); padding: 6px; z-index: 100; }
.popover-right { left: auto; right: 0; }
.popover-item { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 6px; font: 13px/1 'Geist', system-ui, sans-serif; color: var(--text); border: none; background: none; width: 100%; text-align: left; cursor: pointer; border-radius: var(--radius-sm); }
.popover-item:hover { background: var(--surface-alt); }
.popover-item.selected { color: var(--accent-ink); font-weight: 500; }
```

**Step 7: Run tests**

Run: `npx vitest run` and `npx tsc --noEmit`
Expected: PASS / clean.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat(tasks): control bar with search, filter, sort, group-by"
```

### Task 2.5: Phase 2 manual smoke test and ship checkpoint

**Step 1: Run the app**

Run: `npm run dev` (or however the dev server starts in this project — check `package.json` `scripts.dev` if needed).

Open Tasks page and verify:
- Default view shows To Do + In Progress groups; Done collapsed.
- Search filters live.
- Sort and group-by popovers change layout.
- Hash updates as you change state. Reload the page — state restored.
- "View note" pill still navigates to the source note.
- Status checkbox still cycles.

**Step 2: If anything is off, file as bugs and fix before moving on. Otherwise commit a checkpoint message.**

```bash
git commit --allow-empty -m "chore(tasks): phase 2 ships — TasksView with controls (parity + filters/sort/group)"
```

---

## Phase 3 — Quick-add bar with NL parser and manual tasks

### Task 3.1: Implement `parseQuickAdd` (pure function) with tests

**Files:**
- Create: `src/components/tasks/parseQuickAdd.ts`
- Create: `src/components/tasks/__tests__/parseQuickAdd.test.ts`

**Step 1: Write failing tests**

Create `src/components/tasks/__tests__/parseQuickAdd.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { parseQuickAdd } from '../parseQuickAdd';

const NOTES = [
  { id: 1, title: 'Meeting Notes' },
  { id: 2, title: 'Client Emails' },
];

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-04-30T12:00:00Z')); }); // Thu
afterEach(() => { vi.useRealTimers(); });

describe('parseQuickAdd', () => {
  it('parses title only → defaults', () => {
    expect(parseQuickAdd('Buy milk', NOTES)).toEqual({
      title: 'Buy milk', priority: 'medium', dueDate: null, sourceNoteId: null,
    });
  });

  it('parses !high priority', () => {
    expect(parseQuickAdd('Urgent task !high', NOTES).priority).toBe('high');
  });

  it('parses !h short form', () => {
    expect(parseQuickAdd('!h Urgent', NOTES).priority).toBe('high');
  });

  it('parses tomorrow', () => {
    const r = parseQuickAdd('Call vendor tomorrow', NOTES);
    expect(r.dueDate?.slice(0, 10)).toBe('2026-05-01');
    expect(r.title).toBe('Call vendor');
  });

  it('parses weekday name (forward only)', () => {
    // Today is Thursday; "mon" → next Monday (May 4).
    const r = parseQuickAdd('Email team mon', NOTES);
    expect(r.dueDate?.slice(0, 10)).toBe('2026-05-04');
  });

  it('parses MM/DD', () => {
    const r = parseQuickAdd('Submit form 5/15', NOTES);
    expect(r.dueDate?.slice(0, 10)).toBe('2026-05-15');
  });

  it('parses #note slug', () => {
    const r = parseQuickAdd('Reply #meeting-notes', NOTES);
    expect(r.sourceNoteId).toBe(1);
    expect(r.title).toBe('Reply');
  });

  it('strips all tokens from title', () => {
    const r = parseQuickAdd('Send Q2 report !h fri #meeting-notes', NOTES);
    expect(r.title).toBe('Send Q2 report');
    expect(r.priority).toBe('high');
    expect(r.dueDate?.slice(0, 10)).toBe('2026-05-01');
    expect(r.sourceNoteId).toBe(1);
  });

  it('multiple priorities: last wins', () => {
    expect(parseQuickAdd('!l !h test', NOTES).priority).toBe('high');
  });

  it('empty input returns null', () => {
    expect(parseQuickAdd('   ', NOTES)).toBeNull();
  });

  it('unknown #slug → no source note, slug is preserved in title (so user notices)', () => {
    const r = parseQuickAdd('foo #nonexistent', NOTES);
    expect(r.sourceNoteId).toBeNull();
    expect(r.title).toBe('foo #nonexistent');
  });
});
```

**Step 2: Run — expect failure**

Run: `npx vitest run src/components/tasks/__tests__/parseQuickAdd.test.ts`
Expected: FAIL.

**Step 3: Implement `parseQuickAdd.ts`**

Create `src/components/tasks/parseQuickAdd.ts`:

```ts
import type { Task } from '../../api';

export interface ParsedQuickAdd {
  title: string;
  priority: Task['priority'];
  dueDate: string | null;
  sourceNoteId: number | null;
}

export interface NoteRef { id: number; title: string; }

const PRIORITY_TOKENS: Record<string, Task['priority']> = {
  '!high': 'high', '!h': 'high',
  '!med': 'medium', '!medium': 'medium', '!m': 'medium',
  '!low': 'low', '!l': 'low',
};

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function startOfToday(): Date { const d = new Date(); d.setHours(0,0,0,0); return d; }
function iso(d: Date): string { return d.toISOString(); }

function parseDateToken(tok: string, base: Date): string | null {
  const t = tok.toLowerCase();
  if (t === 'today') return iso(new Date(base));
  if (t === 'tomorrow' || t === 'tmrw') { const d = new Date(base); d.setDate(d.getDate() + 1); return iso(d); }
  if (t === 'next' || t === 'this') return null; // handled by multi-token below

  const wd = WEEKDAYS.indexOf(t.slice(0, 3));
  if (wd >= 0) {
    const d = new Date(base);
    const today = d.getDay();
    let delta = (wd - today + 7) % 7;
    if (delta === 0) delta = 7;
    d.setDate(d.getDate() + delta);
    return iso(d);
  }

  const slash = /^(\d{1,2})\/(\d{1,2})$/.exec(tok);
  if (slash) {
    const m = Number(slash[1]); const day = Number(slash[2]);
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      const d = new Date(base.getFullYear(), m - 1, day);
      if (d.getTime() < base.getTime()) d.setFullYear(d.getFullYear() + 1);
      return iso(d);
    }
  }

  return null;
}

function parseMultiTokenDate(tokens: string[], i: number, base: Date): { dueDate: string; consumed: number } | null {
  const t0 = tokens[i].toLowerCase();
  // "next mon", "next week"
  if (t0 === 'next') {
    const t1 = tokens[i + 1]?.toLowerCase();
    if (t1 === 'week') { const d = new Date(base); d.setDate(d.getDate() + 7); return { dueDate: iso(d), consumed: 2 }; }
    const wd = t1 ? WEEKDAYS.indexOf(t1.slice(0, 3)) : -1;
    if (wd >= 0) {
      const d = new Date(base); const delta = ((wd - d.getDay() + 7) % 7) || 7;
      d.setDate(d.getDate() + delta + 7);
      return { dueDate: iso(d), consumed: 2 };
    }
  }
  // "MMM d" e.g. "dec 3"
  const m = MONTHS.indexOf(t0.slice(0, 3));
  const dayN = Number(tokens[i + 1]);
  if (m >= 0 && Number.isFinite(dayN) && dayN >= 1 && dayN <= 31) {
    const d = new Date(base.getFullYear(), m, dayN);
    if (d.getTime() < base.getTime()) d.setFullYear(d.getFullYear() + 1);
    return { dueDate: iso(d), consumed: 2 };
  }
  return null;
}

export function parseQuickAdd(input: string, notes: NoteRef[]): ParsedQuickAdd | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);
  const titleParts: string[] = [];
  let priority: Task['priority'] = 'medium';
  let dueDate: string | null = null;
  let sourceNoteId: number | null = null;
  const base = startOfToday();
  const slugMap = new Map(notes.map((n) => [slugify(n.title), n.id]));

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const lower = tok.toLowerCase();

    if (PRIORITY_TOKENS[lower]) { priority = PRIORITY_TOKENS[lower]; continue; }

    const multi = parseMultiTokenDate(tokens, i, base);
    if (multi) { dueDate = multi.dueDate; i += multi.consumed - 1; continue; }

    const single = parseDateToken(tok, base);
    if (single) { dueDate = single; continue; }

    if (tok.startsWith('#')) {
      const id = slugMap.get(tok.slice(1).toLowerCase());
      if (id != null) { sourceNoteId = id; continue; }
      // unknown slug — keep in title so user notices
    }

    titleParts.push(tok);
  }

  const title = titleParts.join(' ').trim();
  if (!title) return null;
  return { title, priority, dueDate, sourceNoteId };
}
```

**Step 4: Run — expect pass**

Run: `npx vitest run src/components/tasks/__tests__/parseQuickAdd.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(tasks): NL parser for quick-add (priority, dates, #note slug)"
```

### Task 3.2: Build `QuickAddBar.tsx` with optimistic create and ghost preview

**Files:**
- Create: `src/components/tasks/QuickAddBar.tsx`
- Modify: `src/components/tasks/TasksView.tsx`
- Modify: `src/App.tsx` (wire `onCreateTask` to `api.tasks.create`)

**Step 1: Failing test**

Add to `src/components/tasks/__tests__/TasksView.test.tsx`:

```tsx
it('quick-add: typing and Enter creates a task', async () => {
  const onCreate = vi.fn(async (data: any) => ({ ...T({ id: 99 }), ...data }));
  render(<TasksView tasks={[]} notes={[{ id: 1, title: 'meeting notes', content: '', folderId: null, createdAt: '', updatedAt: '' }]} onUpdateStatus={() => {}} onNavigateToNote={() => {}} onCreateTask={onCreate} onUpdateTask={async () => {}} onDeleteTask={async () => {}} />);
  const input = screen.getByPlaceholderText(/add task/i);
  fireEvent.change(input, { target: { value: 'Reply !h #meeting-notes' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reply', priority: 'high', sourceNoteId: 1 }));
});

it('quick-add: ghost preview shows parsed result', () => {
  render(<TasksView tasks={[]} notes={[]} onUpdateStatus={() => {}} onNavigateToNote={() => {}} onCreateTask={async () => null} onUpdateTask={async () => {}} onDeleteTask={async () => {}} />);
  fireEvent.change(screen.getByPlaceholderText(/add task/i), { target: { value: 'Buy milk !h' } });
  expect(screen.getByText(/buy milk/i)).toBeInTheDocument();
  expect(screen.getByText(/●high/i)).toBeInTheDocument();
});
```

**Step 2: Run — expect failure**

Run: `npx vitest run src/components/tasks/__tests__/TasksView.test.tsx`
Expected: FAIL.

**Step 3: Implement `QuickAddBar.tsx`**

Create `src/components/tasks/QuickAddBar.tsx`:

```tsx
import { useMemo, useState, type KeyboardEvent } from 'react';
import { parseQuickAdd, type NoteRef } from './parseQuickAdd';
import type { Task } from '../../api';

interface Props {
  notes: NoteRef[];
  onCreate: (data: { title: string; priority: Task['priority']; dueDate: string | null; sourceNoteId: number | null }) => Promise<Task | null>;
  onArrowDown?: () => void;
}

function fmtDue(due: string | null): string {
  if (!due) return '—';
  const d = new Date(due);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

export function QuickAddBar({ notes, onCreate, onArrowDown }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const parsed = useMemo(() => parseQuickAdd(value, notes), [value, notes]);

  const submit = async (literal: boolean) => {
    setError(null);
    const data = literal
      ? { title: value.trim(), priority: 'medium' as const, dueDate: null, sourceNoteId: null }
      : parsed;
    if (!data || !data.title) return;
    const prevValue = value;
    setValue('');
    try {
      const result = await onCreate(data);
      if (!result) throw new Error('create returned null');
    } catch {
      setValue(prevValue);
      setError('Couldn’t add task. Try again.');
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(true); return; }
    if (e.key === 'Enter') { e.preventDefault(); void submit(false); return; }
    if (e.key === 'Escape') { setValue(''); return; }
    if (e.key === 'ArrowDown' && onArrowDown) { e.preventDefault(); onArrowDown(); }
  };

  return (
    <div className="quick-add">
      <input
        id="quick-add-input"
        className="quick-add-input"
        placeholder='+ Add task… (try "Send Q2 report Fri !high")'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        aria-label="Add task"
      />
      {parsed && (
        <div className="quick-add-ghost" aria-live="polite">
          → "{parsed.title}"  ●{parsed.priority} · {fmtDue(parsed.dueDate)}{parsed.sourceNoteId != null ? ` · note ${parsed.sourceNoteId}` : ''}
        </div>
      )}
      {error && <div className="quick-add-error" role="alert">{error}</div>}
    </div>
  );
}
```

**Step 4: Mount in `TasksView.tsx`**

Add import and render above the `ControlBar`:

```tsx
<QuickAddBar
  notes={notes}
  onCreate={onCreateTask}
/>
```

**Step 5: Wire `onCreateTask` in `App.tsx`**

Replace the placeholder with a real handler that calls `api.tasks.create` and refreshes the tasks list (follow the pattern of existing handlers in `App.tsx` — likely `setTasks((prev) => [...prev, created])` or refetch). Locate the existing tasks-creation pattern (probably in `handleAcceptSuggestion`) and mirror it:

```tsx
const handleCreateManualTask = useCallback(async (data: { title: string; priority: Task['priority']; dueDate: string | null; sourceNoteId: number | null }): Promise<Task | null> => {
  try {
    const created = await api.tasks.create({
      title: data.title,
      description: '',
      priority: data.priority,
      status: 'todo',
      dueDate: data.dueDate,
      sourceNoteId: data.sourceNoteId,
      sourceText: '',
    });
    setTasks((prev) => [created, ...prev]);
    return created;
  } catch (e) {
    console.error('create task failed', e);
    return null;
  }
}, []);
```

Pass it as `onCreateTask` to `<TasksView />`.

**Step 6: Add CSS**

Append:

```css
.quick-add { padding: var(--s-sm) 0 var(--s-md); }
.quick-add-input { display: block; width: 100%; height: 40px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0 var(--s-md); font: 14px/1 'Geist', system-ui, sans-serif; color: var(--text); }
.quick-add-input:focus { outline: none; border-color: var(--accent); }
.quick-add-ghost { font: 11px/1.4 'Geist Mono', ui-monospace, monospace; color: var(--text-muted); padding: 4px 0 0 var(--s-md); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.quick-add-error { font: 12px/1.4 'Geist', system-ui, sans-serif; color: var(--error); padding: 4px 0 0 var(--s-md); }
```

**Step 7: Run all tests + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS / clean.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat(tasks): quick-add bar with NL parser, optimistic create, manual tasks"
```

---

## Phase 4 — Row power: inline edit, popovers, hover peek, overflow menu

### Task 4.1: Inline title editing

**Files:**
- Modify: `src/components/tasks/TaskRow.tsx`
- Modify: `src/components/tasks/__tests__/TasksView.test.tsx` (add test)

**Step 1: Failing test**

```tsx
it('double-click on title enters edit mode and Enter saves', async () => {
  const onUpdate = vi.fn(async () => {});
  const tasks = [T({ id: 1, title: 'Old', status: 'todo' })];
  render(<TasksView tasks={tasks} notes={[]} onUpdateStatus={() => {}} onNavigateToNote={() => {}} onCreateTask={async () => null} onUpdateTask={onUpdate} onDeleteTask={async () => {}} />);
  fireEvent.doubleClick(screen.getByText('Old'));
  const input = screen.getByDisplayValue('Old');
  fireEvent.change(input, { target: { value: 'New' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onUpdate).toHaveBeenCalledWith(1, { title: 'New' });
});

it('Escape cancels and reverts', async () => {
  const onUpdate = vi.fn(async () => {});
  const tasks = [T({ id: 1, title: 'Original', status: 'todo' })];
  render(<TasksView tasks={tasks} notes={[]} onUpdateStatus={() => {}} onNavigateToNote={() => {}} onCreateTask={async () => null} onUpdateTask={onUpdate} onDeleteTask={async () => {}} />);
  fireEvent.doubleClick(screen.getByText('Original'));
  const input = screen.getByDisplayValue('Original');
  fireEvent.change(input, { target: { value: 'Discard' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(onUpdate).not.toHaveBeenCalled();
  expect(screen.getByText('Original')).toBeInTheDocument();
});
```

**Step 2-4:** Run failing → modify `TaskRow.tsx` to accept `onUpdateTask` prop and replace `<div className="task-title">` with a controlled input toggled by local `editing` state. Wire `Enter`/`Escape`/`Tab` per design doc. Pass `onUpdateTask` from `TasksView` (which receives it as a prop).

**Step 5: Commit**

```bash
git commit -am "feat(tasks): inline title editing on rows"
```

### Task 4.2: Priority popover on dot click

**Files:** Modify `TaskRow.tsx` to wrap `.prio-dot` in a `<Popover>` with high/medium/low/clear menu items. Wire to `onUpdateTask({ priority })`. Add a focused test that clicks the dot, picks "high", and asserts the call.

Commit: `feat(tasks): priority popover on row dot`

### Task 4.3: Due-date popover

**Files:** Create `src/components/tasks/DuePopover.tsx`. Quick options (Today, Tomorrow, This weekend, Next week, No date) + native `<input type="date">` for custom. Wire to `onUpdateTask({ dueDate })`. Test the quick options.

Commit: `feat(tasks): due-date popover with quick options + custom`

### Task 4.4: Source-note hover peek

**Files:** Create `src/components/tasks/SourceNotePeek.tsx`. Mount on `.source-pill` hover (300ms delay). Fetch the note via existing `notes` prop (already loaded in `App.tsx`); show title + 4-line excerpt around `sourceText`, with the source phrase wrapped in a span styled `--accent-soft`. Test: hover the pill, advance fake timers 300ms, assert peek contents render.

Commit: `feat(tasks): source-note hover peek with sourceText highlight`

### Task 4.5: Overflow menu (`⋯`)

**Files:** Modify `TaskRow.tsx` to render a `.row-overflow` button on hover. Open a `<Popover>` with `Edit description`, `Duplicate`, `Copy as markdown`, `Delete`. Wire `Delete` to `onDeleteTask` with an undo toast (reuse the toast pattern from `App.tsx`'s suggestion-dismiss). `Duplicate` calls `onCreateTask` with the source task's data (sets new id implicitly via API). `Copy as markdown` uses `navigator.clipboard.writeText` of `- [ ] {title} (due {dueDate}) — from note {sourceNoteId}`. `Edit description` toggles a textarea expansion below the row in `iA Writer Quattro 14px`.

Test: click `Delete`, assert `onDeleteTask` called, undo toast appears, click Undo → row re-creates (or use a softer undelete that re-inserts the previous task).

Commit: `feat(tasks): overflow menu with delete/duplicate/copy/description`

---

## Phase 5 — Multi-select, keyboard, cheatsheet, first-run tip

### Task 5.1: Selection model and bulk-action bar

**Files:**
- Create: `src/components/tasks/BulkActionBar.tsx`
- Modify: `src/components/tasks/TasksView.tsx`, `TaskRow.tsx`

**Step 1: Failing test** — render with 3 tasks; ⌘-click 2 of them; bulk bar shows "2 SELECTED" with Complete button; click Complete → `onUpdateStatus` called twice with `done`.

**Step 2-4:** Implement click handlers in `TaskRow.tsx` for click / shift+click / ⌘+click. Track `lastAnchorId` in `TasksView` local state for shift-range. Render `BulkActionBar` when `view.selection.size > 0`. Each bulk button iterates the selection and calls the appropriate handler; awaits all; clears selection on success.

`BulkActionBar.tsx` skeleton:

```tsx
interface Props {
  count: number;
  allDone: boolean;
  onComplete: () => void;
  onReopen: () => void;
  onSetDue: (date: string | null) => void;
  onSetPriority: (p: Task['priority']) => void;
  onDelete: () => void;
  onClear: () => void;
}
```

Use `DuePopover` and `PriorityPopover` from Phase 4.

Commit: `feat(tasks): multi-select with bulk-action bar`

### Task 5.2: Keyboard navigation

**Files:**
- Create: `src/components/tasks/useKeyboardNav.ts`
- Modify: `src/components/tasks/TasksView.tsx`

**Step 1: Failing test** — render with 3 tasks; fire `keydown` `j` twice on the view container; assert the third task has the `focused` class. Then `x` toggles selection on focused row. `Space` cycles status. `1`/`2`/`3` set priority.

**Step 2-4:** Implement `useKeyboardNav({ tasks, viewState, onUpdateStatus, onUpdateTask, onDeleteTask, onSelect, onClearSelection })` returning `{ focusedId, handleKeyDown }`. Wire `handleKeyDown` to the `TasksView` root container with `tabIndex={0}`. Maintain focused row index in local state. Skip rows in collapsed groups. Handle: `j/k`, `J/K`, `Home/End`, `Space` (status cycle), `1/2/3/0` (priority), `t/T/w/n/d/r` (due), `o` (open note), `e` (edit description), `Enter` (edit title — programmatically focus title input via callback), `x` (toggle selection), `⌘A` (select all visible), `Esc` (clear selection or exit edit), `⌘D` (duplicate), `Backspace`/`Delete` (delete with undo toast), `c` (focus quick-add via `document.getElementById('quick-add-input')?.focus()`), `/` (focus search), `?` (open cheatsheet).

Edge cases: do not handle keys when an `<input>`/`<textarea>` has focus (delegate); use `event.target instanceof HTMLElement && event.target.matches('input, textarea, [contenteditable]')` early return.

Commit: `feat(tasks): keyboard navigation (j/k/x/space/digits/letters)`

### Task 5.3: Cheatsheet overlay (`?`)

**Files:**
- Create: `src/components/tasks/CheatsheetOverlay.tsx`
- Modify: `src/components/tasks/TasksView.tsx` (state: `cheatsheetOpen`)

Static modal with two columns of `key → action` pairs, Geist Mono. Sections: Global / Navigation / Per-row / Edit mode / Quick-add. `Esc` or `?` closes. Test: `?` opens; `Esc` closes; clicking backdrop closes.

Commit: `feat(tasks): cheatsheet overlay (?) with all shortcuts`

### Task 5.4: First-run tip

**Files:** Modify `TasksView.tsx`. Render a one-line tip strip above the body if `localStorage.getItem('noto:tasks:tip-dismissed') !== '1'`. `✕` and `Esc` (when no row focused) dismiss and persist. Test: render fresh → tip shows; click `✕` → tip gone; reload (re-render with `localStorage` set) → tip absent.

Commit: `feat(tasks): first-run tip strip`

### Task 5.5: Final polish, accessibility audit, manual QA

**Step 1: Accessibility sweep**

- Confirm every chip and popover button has `aria-label` and `aria-expanded`.
- Confirm `<h2>` group headers; list `role="list"`; rows `role="listitem"` with `aria-selected`.
- Add a visually-hidden live region in `TasksView` (`<div aria-live="polite" className="sr-only" id="tasks-announcer" />`) and update its text in bulk handlers (`"3 tasks completed"`, `"5 tasks deleted"`).
- Confirm reduced-motion: wrap the bulk-bar slide-in CSS in `@media (prefers-reduced-motion: no-preference)`.

**Step 2: 500-row perf check**

Run a manual perf test: in dev tools console, push 500 fake tasks into local state and scroll. If frame rate drops below 60fps consistently on a modern Mac, file a follow-up issue to add `@tanstack/react-virtual`.

**Step 3: Visual diff against design doc**

Open `docs/plans/2026-04-30-tasks-page-redesign-design.md` Section 7 and walk through the page checking each visual spec value. Fix any drift in `app.css`.

**Step 4: Final smoke test**

- Quick-add 5 tasks of different shapes.
- Filter by priority + due.
- Sort, group-by changes.
- Multi-select 3 → Complete; 2 → Set due → tomorrow; 1 → Delete + Undo.
- All keyboard shortcuts.
- Reload → state restored.
- DB shows manual tasks with `sourceNoteId IS NULL`.

**Step 5: Commit**

```bash
git commit --allow-empty -m "chore(tasks): phase 5 ships — full power-list redesign complete"
```

---

## Definition of done

- [ ] All 5 phases shipped, each with green tests and a clean checkpoint commit.
- [ ] `npx vitest run` is fully green.
- [ ] `npx tsc --noEmit` is clean.
- [ ] `TaskListView.tsx` and its test are deleted.
- [ ] DESIGN.md anti-pattern audit (Section 7 of design doc) passes — no purple, no spinners, no sparkles, no toasts for routine saves, no shadows on rows.
- [ ] Manual smoke test passes on a fresh `noto.db` (Phase 1 migration is no-op).
- [ ] Manual smoke test passes on an existing `noto.db` (Phase 1 migration runs once, backup file present, manual task creates after).

## Notes for the implementer

- Reuse existing patterns wherever possible: the toast pattern in `App.tsx` for undo; the icons in `src/components/Icons.tsx`; the existing `view`, `view-head`, `view-meta`, `view-body`, `task-group`, `group-label`, `group-count`, `task-row`, `task-checkbox`, `task-title`, `task-due`, `priority-pill`, `empty-section` CSS classes — many can be reused as-is, others will need restyling per the design doc.
- The optimistic-update pattern: snapshot the previous task object → call mutation → on rejection, restore it. Keep these helpers tight; do not invent a state library.
- The NL parser is intentionally conservative. Resist adding fuzzy date parsing (`"in 3 days"`, `"end of month"`); they break trust faster than they help. The escape valve is `⌘↵`.
- This plan does not include the calendar slot strip from Approach C. If the user later wants it, layer it on top of `TasksView` as a side panel that reuses `api.calendar.freeSlots` and a HTML5 drag-drop with `tasks.update({ dueDate })`.
