import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoteEditor } from '../NoteEditor';

describe('NoteEditor', () => {
  it('renders with placeholder when empty', () => {
    const { container } = render(<NoteEditor content="" onChange={vi.fn()} />);
    const placeholder = container.querySelector('[data-placeholder="Start writing..."]');
    expect(placeholder).toBeInTheDocument();
  });

  it('renders provided content', () => {
    render(<NoteEditor content="<p>Hello world</p>" onChange={vi.fn()} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });
});
