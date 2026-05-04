import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from '../TaskCard';
import type { Task, Note } from '../../../api';

const T = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  title: 'Reply to Sarah',
  description: '',
  priority: 'medium',
  status: 'todo',
  dueDate: null,
  sourceNoteId: 10,
  sourceText: '',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
  ...overrides,
});

const NOTES: Note[] = [
  { id: 10, title: 'Mon 1:1 with Sarah', content: '', folderId: null, createdAt: '', updatedAt: '' } as Note,
];

function renderCard(task: Task, overrides: Partial<React.ComponentProps<typeof TaskCard>> = {}) {
  const props = {
    task,
    onUpdateStatus: vi.fn(),
    onUpdateTask: vi.fn().mockResolvedValue(undefined),
    onDeleteTask: vi.fn().mockResolvedValue(undefined),
    onCreateTask: vi.fn().mockResolvedValue(null),
    onNavigateToNote: vi.fn(),
    notes: NOTES,
    ...overrides,
  };
  return { ...render(<TaskCard {...props} />), props };
}

describe('TaskCard — render', () => {
  it('renders the title', () => {
    renderCard(T({ title: 'Buy oat milk' }));
    expect(screen.getByText('Buy oat milk')).toBeInTheDocument();
  });

  it('applies priority class for visual styling', () => {
    const { container } = renderCard(T({ priority: 'high' }));
    expect(container.querySelector('.task-card')?.className).toMatch(/task-card--prio-high/);
  });

  it('applies the done class when status is done', () => {
    const { container } = renderCard(T({ status: 'done' }));
    expect(container.querySelector('.task-card')?.className).toMatch(/task-card--done/);
  });

  it('applies the overdue class when dueDate is in the past and not done', () => {
    const { container } = renderCard(T({ dueDate: '2020-01-01T00:00:00Z' }));
    expect(container.querySelector('.task-card')?.className).toMatch(/task-card--overdue/);
  });

  it('does NOT apply overdue class when status is done, even if dueDate is past', () => {
    const { container } = renderCard(T({ dueDate: '2020-01-01T00:00:00Z', status: 'done' }));
    expect(container.querySelector('.task-card')?.className).not.toMatch(/task-card--overdue/);
  });

  it('renders a fallback for an empty title', () => {
    renderCard(T({ title: '' }));
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });
});

describe('TaskCard — interactions', () => {
  it('cycles status when the check button is clicked', () => {
    const onUpdateStatus = vi.fn();
    renderCard(T({ status: 'todo' }), { onUpdateStatus });
    fireEvent.click(screen.getByLabelText('Cycle status'));
    expect(onUpdateStatus).toHaveBeenCalledWith(1, 'in_progress');
  });

  it('cycles done → todo on the check button', () => {
    const onUpdateStatus = vi.fn();
    renderCard(T({ status: 'done' }), { onUpdateStatus });
    fireEvent.click(screen.getByLabelText('Cycle status'));
    expect(onUpdateStatus).toHaveBeenCalledWith(1, 'todo');
  });

  it('opens the priority popover when the priority chip is clicked', () => {
    renderCard(T({ priority: 'medium' }));
    const trigger = screen.getByLabelText('Set priority');
    fireEvent.click(trigger);
    expect(screen.getByRole('menuitem', { name: 'High' })).toBeInTheDocument();
  });

  it('opens the overflow menu and exposes Delete', () => {
    renderCard(T());
    fireEvent.click(screen.getByLabelText('Card actions'));
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('exposes a data-task-id attribute for keyboard navigation', () => {
    const { container } = renderCard(T({ id: 42 }));
    expect(container.querySelector('[data-task-id="42"]')).not.toBeNull();
  });
});
