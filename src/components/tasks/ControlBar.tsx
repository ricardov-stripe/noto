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
  /** Hide sort + group + status popovers on tabs where the preset is the answer (Today, NEW). Default false. */
  hideSortGroup?: boolean;
}

const SORT_LABEL: Record<SortKey, string> = {
  'due-asc': 'Due ↑', 'due-desc': 'Due ↓',
  'prio-asc': 'Priority ↑', 'prio-desc': 'Priority ↓',
  'created-asc': 'Created ↑', 'created-desc': 'Created ↓',
  'title-asc': 'Title A→Z',
  smart: 'smart',
};
const GROUP_LABEL: Record<GroupKey, string> = {
  status: 'status', due: 'due', priority: 'priority', note: 'note', week: 'week', none: 'none',
};

function toggle<T>(arr: T[], v: T): T[] { return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]; }

export function ControlBar({ view, setSearch, setStatus, setPriority, setDue, setSort, setGroup, hideSortGroup = false }: Props) {
  return (
    <div className="control-bar">
      <input
        id="tasks-search"
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

      {!hideSortGroup && (
        <>
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
        </>
      )}
    </div>
  );
}
