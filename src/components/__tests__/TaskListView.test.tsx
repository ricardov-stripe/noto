import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskListView } from '../TaskListView';

describe('TaskListView', () => {
  const tasks = [
    { id: 1, title: 'Write report', description: '', priority: 'high' as const, status: 'todo' as const, dueDate: '2026-04-21', sourceNoteId: 1, sourceText: '', createdAt: '', updatedAt: '' },
    { id: 2, title: 'Review PR', description: '', priority: 'medium' as const, status: 'in_progress' as const, dueDate: null, sourceNoteId: 1, sourceText: '', createdAt: '', updatedAt: '' },
    { id: 3, title: 'Deploy v1', description: '', priority: 'low' as const, status: 'done' as const, dueDate: null, sourceNoteId: 2, sourceText: '', createdAt: '', updatedAt: '' },
  ];

  it('groups tasks by status', () => {
    render(<TaskListView tasks={tasks} onUpdateStatus={vi.fn()} onNavigateToNote={vi.fn()} />);
    expect(screen.getByText('To Do (1)')).toBeInTheDocument();
    expect(screen.getByText('In Progress (1)')).toBeInTheDocument();
    expect(screen.getByText('Done (1)')).toBeInTheDocument();
  });

  it('shows task titles', () => {
    render(<TaskListView tasks={tasks} onUpdateStatus={vi.fn()} onNavigateToNote={vi.fn()} />);
    expect(screen.getByText('Write report')).toBeInTheDocument();
    expect(screen.getByText('Review PR')).toBeInTheDocument();
  });
});
