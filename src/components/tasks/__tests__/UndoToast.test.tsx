import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UndoToast } from '../UndoToast';

describe('UndoToast', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('renders the message', () => {
    render(<UndoToast message="Scheduled X" onUndo={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText('Scheduled X')).toBeInTheDocument();
  });

  it('fires onUndo when Undo is clicked', () => {
    const onUndo = vi.fn();
    render(<UndoToast message="m" onUndo={onUndo} onDismiss={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('fires onDismiss when × is clicked', () => {
    const onDismiss = vi.fn();
    render(<UndoToast message="m" onUndo={() => {}} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after durationMs', () => {
    const onDismiss = vi.fn();
    render(<UndoToast message="m" onUndo={() => {}} onDismiss={onDismiss} durationMs={3000} />);
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(3100); });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses on Escape', () => {
    const onDismiss = vi.fn();
    render(<UndoToast message="m" onUndo={() => {}} onDismiss={onDismiss} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
