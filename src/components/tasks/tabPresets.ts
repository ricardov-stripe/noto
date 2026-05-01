import type { Tab, StatusKey, SortKey, GroupKey } from './taskFilters';

/**
 * Default view-state patch applied when the user switches to a tab.
 * Does not include refinements (search, priority, noteIds) — those persist
 * across tab changes so the user can carry a filter with them.
 */
export interface TabPreset {
  status: StatusKey[];
  sort: SortKey;
  group: GroupKey;
}

export function preset(tab: Tab): TabPreset {
  switch (tab) {
    case 'new':
      return { status: ['todo'], sort: 'created-desc', group: 'none' };
    case 'today':
      return { status: ['todo', 'in_progress'], sort: 'smart', group: 'none' };
    case 'upcoming':
      return { status: ['todo', 'in_progress'], sort: 'due-asc', group: 'due' };
    case 'all':
      return { status: ['todo', 'in_progress'], sort: 'due-asc', group: 'status' };
    case 'done':
      return { status: ['done'], sort: 'created-desc', group: 'week' };
  }
}
