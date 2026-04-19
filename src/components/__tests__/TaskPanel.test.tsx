import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskPanel } from '../TaskPanel';

describe('TaskPanel', () => {
  const suggestions = [
    { title: 'Send report', priority: 'high' as const, suggestedDueDate: '2026-04-21', sourceText: 'send report by friday', reasoning: 'Explicit deadline' },
    { title: 'Review budget', priority: 'medium' as const, suggestedDueDate: null, sourceText: 'review the budget', reasoning: 'Action verb' },
  ];

  it('renders suggestions', () => {
    render(<TaskPanel suggestions={suggestions} isLoading={false}
      onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Send report')).toBeInTheDocument();
    expect(screen.getByText('Review budget')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<TaskPanel suggestions={[]} isLoading={true}
      onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Extracting tasks...')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    render(<TaskPanel suggestions={[]} isLoading={false}
      onAccept={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText('No action items found')).toBeInTheDocument();
  });

  it('calls onAccept with suggestion index', () => {
    const onAccept = vi.fn();
    render(<TaskPanel suggestions={suggestions} isLoading={false}
      onAccept={onAccept} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getAllByLabelText('Accept')[0]);
    expect(onAccept).toHaveBeenCalledWith(0);
  });

  it('calls onDismiss with suggestion index', () => {
    const onDismiss = vi.fn();
    render(<TaskPanel suggestions={suggestions} isLoading={false}
      onAccept={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getAllByLabelText('Dismiss')[0]);
    expect(onDismiss).toHaveBeenCalledWith(0);
  });
});
