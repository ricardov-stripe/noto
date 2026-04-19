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

  it('renders folder list', () => {
    render(<Sidebar folders={mockFolders} notes={mockNotes} activeView="notes"
      onSelectNote={vi.fn()} onSelectView={vi.fn()} onCreateNote={vi.fn()} />);
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });

  it('renders navigation items', () => {
    render(<Sidebar folders={mockFolders} notes={mockNotes} activeView="notes"
      onSelectNote={vi.fn()} onSelectView={vi.fn()} onCreateNote={vi.fn()} />);
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
  });

  it('calls onSelectView when Tasks clicked', () => {
    const onSelectView = vi.fn();
    render(<Sidebar folders={mockFolders} notes={mockNotes} activeView="notes"
      onSelectNote={vi.fn()} onSelectView={onSelectView} onCreateNote={vi.fn()} />);
    fireEvent.click(screen.getByText('Tasks'));
    expect(onSelectView).toHaveBeenCalledWith('tasks');
  });
});
