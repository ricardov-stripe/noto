import type { Tab } from './taskFilters';

export interface TabStripProps {
  active: Tab;
  counts: Record<Tab, number>;
  onChange: (tab: Tab) => void;
}

const ORDER: Tab[] = ['new', 'today', 'upcoming', 'all', 'done'];
const LABEL: Record<Tab, string> = {
  new: 'NEW',
  today: 'TODAY',
  upcoming: 'UPCOMING',
  all: 'ALL',
  done: 'DONE',
};

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
            className={`tabstrip__tab${isActive ? ' tabstrip__tab--active' : ''}`}
            onClick={() => onChange(tab)}
          >
            <span className="tabstrip__label">{LABEL[tab]}</span>
            {count > 0 && (
              <span
                className={`tabstrip__count${tab === 'new' ? ' tabstrip__count--accent' : ''}`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
