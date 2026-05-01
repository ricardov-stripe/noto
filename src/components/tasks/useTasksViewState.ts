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
