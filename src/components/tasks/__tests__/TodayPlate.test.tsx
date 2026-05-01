import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TodayPlate, localDateYmd } from '../TodayPlate';
import type { Task } from '../../../api';

const T = (overrides: Partial<Task>): Task => ({
  id: 0,
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  dueDate: null,
  sourceNoteId: null,
  sourceText: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('TodayPlate', () => {
  const anchor = new Date(2026, 4, 1, 12, 0, 0, 0);
  const ymd = localDateYmd(anchor);
  const prevDay = localDateYmd(new Date(2026, 3, 30));

  it('renders empty state when tasks is empty', () => {
    render(
      <TodayPlate tasks={[]} now={anchor}>
        {() => null}
      </TodayPlate>,
    );
    expect(screen.getByText('Nothing queued for today.')).toBeInTheDocument();
  });

  it('renders all three section headers when each has tasks', () => {
    const tasks = [
      T({ id: 1, title: 'old', dueDate: `${prevDay}T00:00:00.000Z` }),
      T({ id: 2, title: 'at two', dueDate: `${ymd}T14:00:00.000Z` }),
      T({ id: 3, title: 'z-day', priority: 'low', dueDate: ymd }),
      T({ id: 4, title: 'a-day', priority: 'high', dueDate: ymd }),
    ];
    render(
      <TodayPlate tasks={tasks} now={anchor}>
        {() => null}
      </TodayPlate>,
    );
    expect(screen.getByText(`OVERDUE · 1`)).toBeInTheDocument();
    expect(screen.getByText(`SCHEDULED · 1`)).toBeInTheDocument();
    expect(screen.getByText(`TODAY · 2`)).toBeInTheDocument();
  });

  it('skips a section whose task list is empty', () => {
    render(
      <TodayPlate tasks={[T({ id: 1, title: 'o', dueDate: `${prevDay}` })]} now={anchor}>
        {() => null}
      </TodayPlate>,
    );
    expect(screen.getByText('OVERDUE · 1')).toBeInTheDocument();
    expect(screen.queryByText(/SCHEDULED ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^TODAY ·/)).not.toBeInTheDocument();
  });

  it('includes overdue when dueDate day is before today', () => {
    render(
      <TodayPlate tasks={[T({ id: 9, title: 'late', dueDate: prevDay })]} now={anchor}>
        {(section) => <span data-section={section} />}
      </TodayPlate>,
    );
    expect(screen.getByText('OVERDUE · 1')).toBeInTheDocument();
  });

  it('scheduled includes only timed due today, not date-only today', () => {
    const tasks = [
      T({ id: 1, title: 'timed', dueDate: `${ymd}T09:30:00.000Z` }),
      T({ id: 2, title: 'dateonly', dueDate: ymd }),
    ];
    render(
      <TodayPlate tasks={tasks} now={anchor}>
        {(section, list) => (
          <div key={section} data-testid={`plate-${section}`} data-ids={list.map((x) => x.id).join(',')} />
        )}
      </TodayPlate>,
    );
    expect(screen.getByText('SCHEDULED · 1')).toBeInTheDocument();
    expect(screen.getByText('TODAY · 1')).toBeInTheDocument();
    expect(screen.getByTestId('plate-scheduled')).toHaveAttribute('data-ids', '1');
    expect(screen.getByTestId('plate-today')).toHaveAttribute('data-ids', '2');
  });

  it('today section lists date-only today, not timed today', () => {
    const tasks = [
      T({ id: 1, title: 'timed', dueDate: `${ymd}T10:00:00.000Z` }),
      T({ id: 2, title: 'plain', dueDate: ymd }),
    ];
    render(
      <TodayPlate tasks={tasks} now={anchor}>
        {(section, list) => (
          <div key={section} data-testid={`sec-${section}`} data-ids={list.map((x) => x.id).join(',')} />
        )}
      </TodayPlate>,
    );
    expect(screen.getByText('SCHEDULED · 1')).toBeInTheDocument();
    expect(screen.getByText('TODAY · 1')).toBeInTheDocument();
    expect(screen.getByTestId('sec-today')).toHaveAttribute('data-ids', '2');
  });

  it('excludes done tasks from every section', () => {
    const tasks = [
      T({ id: 1, status: 'done', dueDate: prevDay }),
      T({ id: 2, status: 'done', dueDate: `${ymd}T10:00:00.000Z` }),
      T({ id: 3, status: 'done', dueDate: ymd }),
    ];
    render(
      <TodayPlate tasks={tasks} now={anchor}>
        {() => null}
      </TodayPlate>,
    );
    expect(screen.getByText('Nothing queued for today.')).toBeInTheDocument();
  });

  it('section headers include counts with · separator', () => {
    render(
      <TodayPlate
        tasks={[
          T({ id: 1, dueDate: prevDay }),
          T({ id: 2, dueDate: prevDay }),
          T({ id: 3, dueDate: `${ymd}T11:00:00.000Z` }),
        ]}
        now={anchor}
      >
        {() => null}
      </TodayPlate>,
    );
    expect(screen.getByText('OVERDUE · 2')).toBeInTheDocument();
    expect(screen.getByText('SCHEDULED · 1')).toBeInTheDocument();
  });

  it('calls children render prop once per non-empty section with matching tasks', () => {
    const fn = vi.fn();
    const tasks = [
      T({ id: 1, dueDate: prevDay }),
      T({ id: 2, dueDate: `${ymd}T09:00:00.000Z` }),
      T({ id: 3, dueDate: ymd }),
    ];
    render(
      <TodayPlate tasks={tasks} now={anchor}>
        {(section, list) => {
          fn(section, list.map((x) => x.id));
          return null;
        }}
      </TodayPlate>,
    );
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn.mock.calls).toEqual(
      expect.arrayContaining([
        ['overdue', [1]],
        ['scheduled', [2]],
        ['today', [3]],
      ]),
    );
  });
});
