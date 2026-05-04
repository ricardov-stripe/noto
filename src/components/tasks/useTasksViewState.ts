import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { ViewState, StatusKey, PriorityKey, DueBucket, SortKey, GroupKey, Tab } from './taskFilters';
import { preset } from './tabPresets';

export type { Tab } from './taskFilters';

export type ViewMode = 'list' | 'board';

const STORAGE_KEY = 'noto:tasks:view-state';
// Independent key for the layout choice. Keeping it separate from the filter
// state means we never need a schema migration for the existing JSON blob,
// and PR2 (where this becomes the only mode) can delete the key entirely.
const VIEW_MODE_STORAGE_KEY = 'noto:tasks:view-mode';
const VIEW_MODE_DEFAULT: ViewMode = 'list';
const VALID_VIEW_MODE: ViewMode[] = ['list', 'board'];

const VALID_TAB: Tab[] = ['new', 'today', 'upcoming', 'all', 'done'];
const VALID_SORT: SortKey[] = ['due-asc', 'due-desc', 'prio-asc', 'prio-desc', 'created-asc', 'created-desc', 'title-asc', 'smart'];
const VALID_GROUP: GroupKey[] = ['status', 'due', 'priority', 'note', 'week', 'none'];
const VALID_STATUS: StatusKey[] = ['todo', 'in_progress', 'done'];
const VALID_PRIO: PriorityKey[] = ['high', 'medium', 'low'];
const VALID_DUE: DueBucket[] = ['overdue', 'today', 'this-week', 'later', 'none'];

export const DEFAULT_VIEW: ViewState = {
  tab: 'today',
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
  const tabSegment = v.tab && v.tab !== 'today' ? `/${v.tab}` : '';
  return qs ? `#tasks${tabSegment}?${qs}` : `#tasks${tabSegment}`;
}

export function decodeView(hash: string): Partial<ViewState> {
  const out: Partial<ViewState> = {};
  // Parse tab segment: #tasks[/<tab>][?<params>]
  const match = hash.match(/^#tasks(?:\/([a-z]+))?(?:\?(.*))?$/);
  if (!match) return out;
  const [, rawTab, rawQuery] = match;
  if (rawTab) {
    if (VALID_TAB.includes(rawTab as Tab)) out.tab = rawTab as Tab;
    else out.tab = 'today';
  }
  if (!rawQuery) return out;
  const p = new URLSearchParams(rawQuery);
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

function applyPreset(view: ViewState, tab: Tab, explicit: Partial<ViewState>): ViewState {
  const p = preset(tab);
  return {
    ...view,
    status: explicit.status == null ? p.status : view.status,
    sort: explicit.sort == null ? p.sort : view.sort,
    group: explicit.group == null ? p.group : view.group,
  };
}

type TabSource = 'url' | 'storage' | 'default';

function loadInitial(): { view: ViewState; tabSource: TabSource } {
  try {
    const fromUrl = decodeView(window.location.hash);
    if (Object.keys(fromUrl).length > 0) {
      const base: ViewState = { ...DEFAULT_VIEW, ...fromUrl, selection: new Set(), collapsed: DEFAULT_VIEW.collapsed };
      const withPreset = fromUrl.tab ? applyPreset(base, fromUrl.tab, fromUrl) : base;
      return { view: withPreset, tabSource: fromUrl.tab ? 'url' : 'default' };
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ViewState>;
      const tab = parsed.tab ?? DEFAULT_VIEW.tab;
      const hydrated: ViewState = {
        ...DEFAULT_VIEW,
        ...parsed,
        selection: new Set(),
        collapsed: { ...DEFAULT_VIEW.collapsed, ...(parsed.collapsed ?? {}) },
      };
      return {
        view: applyPreset(hydrated, tab, parsed),
        tabSource: parsed.tab ? 'storage' : 'default',
      };
    }
  } catch { /* fall through */ }
  return {
    view: applyPreset({ ...DEFAULT_VIEW, selection: new Set() }, DEFAULT_VIEW.tab, {}),
    tabSource: 'default',
  };
}

function loadInitialViewMode(): ViewMode {
  try {
    const raw = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (raw && VALID_VIEW_MODE.includes(raw as ViewMode)) {
      return raw as ViewMode;
    }
  } catch {
    /* localStorage unavailable — fall through to default. */
  }
  return VIEW_MODE_DEFAULT;
}

export function useTasksViewState() {
  const initial = useRef(loadInitial()).current;
  const [view, dispatch] = useReducer(reducer, initial.view);
  const [viewMode, setViewModeState] = useState<ViewMode>(loadInitialViewMode);
  const urlTimer = useRef<number | null>(null);
  const initialTabSource: TabSource = initial.tabSource;

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      /* noop */
    }
  }, [viewMode]);

  const setViewMode = useCallback((next: ViewMode) => {
    setViewModeState(next);
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewModeState((m) => (m === 'list' ? 'board' : 'list'));
  }, []);

  useEffect(() => {
    const persisted = { ...view, selection: undefined };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)); } catch { /* noop */ }
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
    initialTabSource,
    viewMode,
    setViewMode,
    toggleViewMode,
    setSearch: useCallback((s: string) => dispatch({ type: 'set', patch: { search: s } }), []),
    setStatus: useCallback((status: StatusKey[]) => dispatch({ type: 'set', patch: { status } }), []),
    setPriority: useCallback((priority: PriorityKey[]) => dispatch({ type: 'set', patch: { priority } }), []),
    setDue: useCallback((due: DueBucket[]) => dispatch({ type: 'set', patch: { due } }), []),
    setNoteIds: useCallback((noteIds: (number | null)[]) => dispatch({ type: 'set', patch: { noteIds } }), []),
    setSort: useCallback((sort: SortKey) => dispatch({ type: 'set', patch: { sort } }), []),
    setGroup: useCallback((group: GroupKey) => dispatch({ type: 'set', patch: { group } }), []),
    setTab: useCallback((tab: Tab) => {
      const p = preset(tab);
      dispatch({
        type: 'set',
        patch: {
          tab,
          status: p.status,
          sort: p.sort,
          group: p.group,
          selection: new Set<number>(),
        },
      });
    }, []),
    toggleCollapsed: useCallback((key: string) => dispatch({ type: 'toggle-collapsed', key }), []),
    select: useCallback((ids: number[], mode: 'replace' | 'add' | 'toggle' = 'replace') => dispatch({ type: 'select', ids, mode }), []),
    clearSelection: useCallback(() => dispatch({ type: 'clear-selection' }), []),
    resetFilters: useCallback(() => dispatch({ type: 'set', patch: { search: '', status: ['todo', 'in_progress'], priority: [], due: [], noteIds: [] } }), []),
  };
}
