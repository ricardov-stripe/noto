import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoteEditor } from '../NoteEditor';

const baseProps = {
  noteId: 1,
  title: '',
  content: '',
  folderName: null,
  updatedAt: '2026-04-19T10:00:00.000Z',
  isExtracting: false,
  onTitleChange: vi.fn(),
  onContentChange: vi.fn(),
};

describe('NoteEditor', () => {
  it('renders the title input with the supplied title', () => {
    render(<NoteEditor {...baseProps} title="Hello" />);
    const input = screen.getByPlaceholderText('Untitled') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Hello');
  });

  it('shows the AI status', () => {
    render(<NoteEditor {...baseProps} isExtracting />);
    expect(screen.getByText(/Extracting/)).toBeInTheDocument();
  });

  it('renders the AI-watching status when idle', () => {
    render(<NoteEditor {...baseProps} />);
    expect(screen.getByText('AI watching')).toBeInTheDocument();
  });

  it('renders ProseMirror editor body', () => {
    const { container } = render(<NoteEditor {...baseProps} content="<p>Hello world</p>" />);
    const pm = container.querySelector('.ProseMirror');
    expect(pm).toBeInTheDocument();
  });
});
