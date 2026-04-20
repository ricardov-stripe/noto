import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../Sidebar';

describe('Sidebar', () => {
  const mockFolders = [
    { id: 1, name: 'Work', parentId: null },
    { id: 2, name: 'Personal', parentId: null },
  ];

  const mockNotes = [
    { id: 1, title: 'Meeting notes', content: '', folderId: 1, createdAt: '', updatedAt: '' },
  ];

  const mockTasks: never[] = [];

  const defaults = {
    folders: mockFolders,
    notes: mockNotes,
    tasks: mockTasks,
    activeNoteId: null,
    activeView: 'notes' as const,
    onSelectNote: vi.fn(),
    onSelectView: vi.fn(),
    onCreateNote: vi.fn(),
  };

  it('renders folder list', () => {
    render(<Sidebar {...defaults} />);
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('renders navigation items', () => {
    render(<Sidebar {...defaults} />);
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
  });

  it('calls onSelectView when Tasks clicked', () => {
    const onSelectView = vi.fn();
    render(<Sidebar {...defaults} onSelectView={onSelectView} />);
    fireEvent.click(screen.getByText('Tasks'));
    expect(onSelectView).toHaveBeenCalledWith('tasks');
  });

  it('renders recent notes', () => {
    render(<Sidebar {...defaults} />);
    expect(screen.getByText('Meeting notes')).toBeInTheDocument();
  });

  it('calls onCreateNote when "New note" clicked', () => {
    const onCreateNote = vi.fn();
    render(<Sidebar {...defaults} onCreateNote={onCreateNote} />);
    fireEvent.click(screen.getByText('New note'));
    expect(onCreateNote).toHaveBeenCalled();
  });
});
