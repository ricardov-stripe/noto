import { useEffect } from 'react';

export interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * A single-slot "you did X. Undo?" toast anchored to the bottom of the view.
 * Auto-dismisses after `durationMs` (default 5s). Closes on ESC.
 */
export function UndoToast({ message, onUndo, onDismiss, durationMs = 5000 }: UndoToastProps) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [onDismiss, durationMs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span className="undo-toast__message">{message}</span>
      <button type="button" className="undo-toast__action" onClick={onUndo}>
        Undo
      </button>
      <button
        type="button"
        className="undo-toast__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
