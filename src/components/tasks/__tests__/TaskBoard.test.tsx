import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskBoard, resolveDrop } from '../TaskBoard';
import { partitionForBoard } from '../boardPartition';
import type { Task, Note } from '../../../api';

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

describe('TaskBoard.resolveDrop — drop dispatcher', () => {
  const part = partitionForBoard([
    T({ id: 1, status: 'todo', updatedAt: '2026-04-01T00:00:00Z' }), // NEW
    T({ id: 2, status: 'todo', updatedAt: '2026-04-02T00:00:00Z' }), // UPCOMING
    T({ id: 3, status: 'done', updatedAt: '2026-04-03T00:00:00Z' }), // DONE
  ]);

  it('returns null when there is no drop target', () => {
    expect(resolveDrop('card:1', null, part)).toBeNull();
  });

  it('returns null when the active id is not a card', () => {
    expect(resolveDrop('col:upcoming', 'col:done', part)).toBeNull();
  });

  it('routes col: drops to a column action', () => {
    expect(resolveDrop('card:1', 'col:upcoming', part)).toEqual({
      type: 'column',
      taskId: 1,
      target: 'upcoming',
    });
  });

  it('routes col: drops onto DONE for any source', () => {
    expect(resolveDrop('card:2', 'col:done', part)).toEqual({
      type: 'column',
      taskId: 2,
      target: 'done',
    });
  });

  it('returns null when dropping a card onto its own column (no-op)', () => {
    expect(resolveDrop('card:2', 'col:upcoming', part)).toBeNull();
    expect(resolveDrop('card:3', 'col:done', part)).toBeNull();
  });

  it('routes card: drops to the dropped-on card\'s column', () => {
    // Drop card 1 (NEW) onto card 3 (DONE) → DONE drop
    expect(resolveDrop('card:1', 'card:3', part)).toEqual({
      type: 'column',
      taskId: 1,
      target: 'done',
    });
  });

  it('returns null when card-on-card drop resolves to the same column', () => {
    // Cards 2 and a hypothetical 22 both in UPCOMING — but 22 doesn't exist
    // in this partition. Instead test card-on-self.
    expect(resolveDrop('card:2', 'card:2', part)).toBeNull();
  });

  it('routes slot: drops to a slot action with parsed start/end', () => {
    expect(
      resolveDrop('card:1', 'slot:2026-05-04T11:00:00Z|2026-05-04T12:00:00Z', part),
    ).toEqual({
      type: 'slot',
      taskId: 1,
      start: '2026-05-04T11:00:00Z',
      end: '2026-05-04T12:00:00Z',
    });
  });

  it('handles slot: ids without an end time (forward compat)', () => {
    expect(resolveDrop('card:1', 'slot:2026-05-04T11:00:00Z', part)).toEqual({
      type: 'slot',
      taskId: 1,
      start: '2026-05-04T11:00:00Z',
      end: '',
    });
  });

  it('returns null for malformed slot ids (no payload)', () => {
    expect(resolveDrop('card:1', 'slot:', part)).toBeNull();
  });

  it('returns null for unknown col: targets', () => {
    expect(resolveDrop('card:1', 'col:bogus', part)).toBeNull();
  });

  it('returns null for unknown drop-zone prefixes', () => {
    expect(resolveDrop('card:1', 'mystery:zone', part)).toBeNull();
  });
});

describe('TaskBoard — render', () => {
  const NOTES: Note[] = [];
  const baseProps = {
    notes: NOTES,
    onColumnDrop: vi.fn(),
    onSlotDrop: vi.fn(),
    onUpdateStatus: vi.fn(),
    onUpdateTask: vi.fn().mockResolvedValue(undefined),
    onDeleteTask: vi.fn().mockResolvedValue(undefined),
    onCreateTask: vi.fn().mockResolvedValue(null),
    onNavigateToNote: vi.fn(),
  };

  it('renders three columns with the correct labels', () => {
    render(<TaskBoard tasks={[]} {...baseProps} />);
    expect(screen.getByLabelText('New column')).toBeInTheDocument();
    expect(screen.getByLabelText('Upcoming column')).toBeInTheDocument();
    expect(screen.getByLabelText('Done column')).toBeInTheDocument();
  });

  it('partitions tasks into the right columns by default', () => {
    const tasks = [
      T({ id: 1, title: 'Untouched', status: 'todo', updatedAt: '2026-04-01T00:00:00Z' }),
      T({ id: 2, title: 'In flight', status: 'todo', updatedAt: '2026-04-05T00:00:00Z' }),
      T({ id: 3, title: 'Shipped', status: 'done', updatedAt: '2026-04-10T00:00:00Z' }),
    ];
    render(<TaskBoard tasks={tasks} {...baseProps} />);
    expect(screen.getByText('Untouched')).toBeInTheDocument();
    expect(screen.getByText('In flight')).toBeInTheDocument();
    expect(screen.getByText('Shipped')).toBeInTheDocument();
  });

  it('renders the rail slot when a rail node is provided', () => {
    render(
      <TaskBoard
        tasks={[]}
        {...baseProps}
        rail={<div data-testid="rail-content">My rail</div>}
      />,
    );
    expect(screen.getByTestId('rail-content')).toBeInTheDocument();
  });

  it('shows the count next to each column label', () => {
    const tasks = [
      T({ id: 1, status: 'todo', updatedAt: '2026-04-01T00:00:00Z' }), // NEW
      T({ id: 2, status: 'todo', updatedAt: '2026-04-01T00:00:00Z' }), // NEW
      T({ id: 3, status: 'done', updatedAt: '2026-04-03T00:00:00Z' }), // DONE
    ];
    const { container } = render(<TaskBoard tasks={tasks} {...baseProps} />);
    const newCol = container.querySelector('.task-column--new');
    expect(newCol?.textContent).toContain('2');
    const doneCol = container.querySelector('.task-column--done');
    expect(doneCol?.textContent).toContain('1');
  });
});
