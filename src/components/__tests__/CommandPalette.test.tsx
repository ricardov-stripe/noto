import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from '../CommandPalette';

const notes = [
  { id: 1, title: 'Meeting notes', content: '<p>Sync with Cathay about rewards</p>', folderId: null, createdAt: '', updatedAt: '2026-04-19T10:00:00Z' },
  { id: 2, title: 'Reading list', content: '<p>Books to read this quarter</p>', folderId: null, createdAt: '', updatedAt: '2026-04-18T10:00:00Z' },
];

const tasks = [
  { id: 10, title: 'Send report', description: '', priority: 'high' as const, status: 'todo' as const, dueDate: null, sourceNoteId: 1, sourceText: '', createdAt: '', updatedAt: '' },
];

const defaults = {
  open: true,
  notes,
  tasks,
  onClose: vi.fn(),
  onOpenNote: vi.fn(),
  onSelectView: vi.fn(),
  onCreateNote: vi.fn(),
};

describe('CommandPalette', () => {
  it('returns null when closed', () => {
    const { container } = render(<CommandPalette {...defaults} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows recent notes when query is empty', () => {
    render(<CommandPalette {...defaults} />);
    expect(screen.getByText('Meeting notes')).toBeInTheDocument();
    expect(screen.getByText('Reading list')).toBeInTheDocument();
  });

  it('filters notes by content match', () => {
    render(<CommandPalette {...defaults} />);
    const input = screen.getByPlaceholderText(/Search notes/);
    fireEvent.change(input, { target: { value: 'cathay' } });
    expect(screen.getByText('Meeting notes')).toBeInTheDocument();
    expect(screen.queryByText('Reading list')).not.toBeInTheDocument();
  });

  it('filters tasks by title', () => {
    render(<CommandPalette {...defaults} />);
    const input = screen.getByPlaceholderText(/Search notes/);
    fireEvent.change(input, { target: { value: 'send report' } });
    expect(screen.getByText('Send report')).toBeInTheDocument();
  });

  it('opens a note on click', () => {
    const onOpenNote = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette {...defaults} onOpenNote={onOpenNote} onClose={onClose} />);
    fireEvent.click(screen.getByText('Meeting notes'));
    expect(onOpenNote).toHaveBeenCalledWith(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows empty-state when no matches', () => {
    render(<CommandPalette {...defaults} />);
    const input = screen.getByPlaceholderText(/Search notes/);
    fireEvent.change(input, { target: { value: 'zxqv-no-match' } });
    expect(screen.getByText('No matches.')).toBeInTheDocument();
  });
});
