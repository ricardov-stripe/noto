import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TabStrip } from '../TabStrip';
import type { Tab } from '../taskFilters';

const counts: Record<Tab, number> = { new: 3, today: 5, upcoming: 12, all: 30, done: 47 };

describe('TabStrip', () => {
  it('renders all 5 tabs in the expected order', () => {
    render(<TabStrip active="today" counts={counts} onChange={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);
    expect(tabs.map((t) => t.textContent?.toLowerCase().replace(/\d/g, '').trim())).toEqual([
      'new', 'today', 'upcoming', 'all', 'done',
    ]);
  });

  it('marks the active tab with aria-selected=true', () => {
    render(<TabStrip active="upcoming" counts={counts} onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /upcoming/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /today/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange with the tab id on click', () => {
    const onChange = vi.fn();
    render(<TabStrip active="today" counts={counts} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /upcoming/i }));
    expect(onChange).toHaveBeenCalledWith('upcoming');
  });

  it('shows the count when non-zero', () => {
    render(<TabStrip active="today" counts={counts} onChange={() => {}} />);
    expect(screen.getByText('3')).toBeInTheDocument(); // new
    expect(screen.getByText('5')).toBeInTheDocument(); // today
  });

  it('omits count when zero', () => {
    render(<TabStrip active="today" counts={{ ...counts, new: 0 }} onChange={() => {}} />);
    const newTab = screen.getByRole('tab', { name: /new/i });
    expect(newTab.textContent?.replace(/\s/g, '')).toMatch(/^new$/i);
  });

  it('NEW count has accent modifier class when > 0', () => {
    render(<TabStrip active="today" counts={counts} onChange={() => {}} />);
    const badge = screen.getByText('3');
    expect(badge.className).toMatch(/accent/);
  });

  it('non-NEW counts do not have accent modifier class', () => {
    render(<TabStrip active="today" counts={counts} onChange={() => {}} />);
    const todayBadge = screen.getByText('5');
    expect(todayBadge.className).not.toMatch(/accent/);
  });
});
