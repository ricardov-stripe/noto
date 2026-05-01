import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewTabBody } from '../NewTabBody';
import type { Note, Task } from '../../../api';

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

const N = (overrides: Partial<Note>): Note => ({
  id: 0,
  title: 'Untitled',
  content: '',
  folderId: null,
  createdAt: '2026-05-01T10:00:00Z',
  updatedAt: '2026-05-01T10:00:00Z',
  ...overrides,
});

describe('NewTabBody', () => {
  it('renders empty state when no tasks', () => {
    render(
      <NewTabBody
        tasks={[]}
        notes={[]}
        onTriageAllToToday={() => {}}
        onDismissAllToLater={() => {}}
      >
        <div />
      </NewTabBody>,
    );
    expect(screen.getByText('Inbox zero.')).toBeInTheDocument();
  });

  it('shows untriaged count in header', () => {
    render(
      <NewTabBody
        tasks={[T({ id: 1 }), T({ id: 2 }), T({ id: 3 })]}
        notes={[]}
        onTriageAllToToday={() => {}}
        onDismissAllToLater={() => {}}
      >
        <div>items</div>
      </NewTabBody>,
    );
    expect(screen.getByText(/3 UNTRIAGED/)).toBeInTheDocument();
  });

  it('shows last-extracted meta when a task has a source note', () => {
    const tasks = [
      T({ id: 1, sourceNoteId: 10, createdAt: new Date(Date.now() - 12 * 60_000).toISOString() }),
    ];
    const notes = [N({ id: 10, title: 'meeting-notes' })];
    render(
      <NewTabBody
        tasks={tasks}
        notes={notes}
        onTriageAllToToday={() => {}}
        onDismissAllToLater={() => {}}
      >
        <div />
      </NewTabBody>,
    );
    expect(screen.getByText(/last extracted/)).toBeInTheDocument();
    expect(screen.getByText(/meeting-notes/)).toBeInTheDocument();
  });

  it('omits extracted meta when no task has a source note', () => {
    render(
      <NewTabBody
        tasks={[T({ id: 1, sourceNoteId: null })]}
        notes={[]}
        onTriageAllToToday={() => {}}
        onDismissAllToLater={() => {}}
      >
        <div />
      </NewTabBody>,
    );
    expect(screen.queryByText(/last extracted/)).not.toBeInTheDocument();
  });

  it('fires onTriageAllToToday when the button is clicked', () => {
    const onTriage = vi.fn();
    render(
      <NewTabBody
        tasks={[T({ id: 1 })]}
        notes={[]}
        onTriageAllToToday={onTriage}
        onDismissAllToLater={() => {}}
      >
        <div />
      </NewTabBody>,
    );
    fireEvent.click(screen.getByRole('button', { name: /triage all/i }));
    expect(onTriage).toHaveBeenCalledTimes(1);
  });

  it('fires onDismissAllToLater when the button is clicked', () => {
    const onDismiss = vi.fn();
    render(
      <NewTabBody
        tasks={[T({ id: 1 })]}
        notes={[]}
        onTriageAllToToday={() => {}}
        onDismissAllToLater={onDismiss}
      >
        <div />
      </NewTabBody>,
    );
    fireEvent.click(screen.getByRole('button', { name: /dismiss all/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders children in the list slot', () => {
    render(
      <NewTabBody
        tasks={[T({ id: 1 })]}
        notes={[]}
        onTriageAllToToday={() => {}}
        onDismissAllToLater={() => {}}
      >
        <div data-testid="injected-children">hello</div>
      </NewTabBody>,
    );
    expect(screen.getByTestId('injected-children')).toBeInTheDocument();
  });
});
