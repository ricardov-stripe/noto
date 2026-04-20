export interface TaskSuggestion {
  title: string;
  priority: 'high' | 'medium' | 'low';
  suggestedDueDate: string | null;
  sourceText: string;
  reasoning: string;
}

interface TaskPanelProps {
  suggestions: TaskSuggestion[];
  isLoading: boolean;
  onAccept: (index: number) => void;
  onDismiss: (index: number) => void;
}

const PRIORITY_LABEL: Record<TaskSuggestion['priority'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};
const PRIORITY_CLASS: Record<TaskSuggestion['priority'], 'high' | 'med' | 'low'> = {
  high: 'high',
  medium: 'med',
  low: 'low',
};

/**
 * AI-extracted task suggestions panel. Three states:
 *   - loading    → small "Extracting tasks..." line under the header
 *   - empty      → quiet copy explaining the AI is reading along
 *   - populated  → suggestion cards with quote + accept/dismiss
 *
 * `onAccept`/`onDismiss` are unchanged from the previous version so App.tsx
 * doesn't need to know we redesigned the surface. Buttons keep their
 * aria-labels ("Accept" / "Dismiss") for screen reader consistency, even
 * though the visible labels are now "Add task" and "Skip".
 */
export function TaskPanel({ suggestions, isLoading, onAccept, onDismiss }: TaskPanelProps) {
  const sourceLabel =
    isLoading ? 'EXTRACTING…'
      : suggestions.length === 0 ? '0 SUGGESTED'
      : `${suggestions.length} SUGGESTED`;

  return (
    <aside className="task-panel" aria-label="Extracted tasks">
      <div className="panel-head">
        <div className="title">
          <span className="ai-pulse" aria-hidden="true" />
          AI Tasks
        </div>
        <div className="source">{sourceLabel}</div>
      </div>

      <div className="panel-body">
        {isLoading && suggestions.length === 0 && (
          <div className="empty-section">Extracting tasks...</div>
        )}

        {!isLoading && suggestions.length === 0 && (
          <div className="empty-section">No action items found</div>
        )}

        {suggestions.map((s, i) => (
          <article className="suggestion" key={`${s.title}-${i}`}>
            <div className="row">
              <span className={`priority-pill ${PRIORITY_CLASS[s.priority]}`}>
                {PRIORITY_LABEL[s.priority]}
              </span>
              <span className="due">{s.suggestedDueDate ?? 'NO DUE DATE'}</span>
            </div>
            <div className="what" data-pretext="">{s.title}</div>
            {s.sourceText && (
              <div className="from" data-pretext="">{`"${s.sourceText}"`}</div>
            )}
            {s.reasoning && (
              <div className="reasoning" style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 11,
                color: 'var(--text-soft)',
                fontStyle: 'normal',
              }}>
                {s.reasoning}
              </div>
            )}
            <div className="actions">
              <button
                className="btn primary"
                type="button"
                aria-label="Accept"
                onClick={() => onAccept(i)}
              >
                Add task
              </button>
              <button
                className="btn ghost"
                type="button"
                aria-label="Dismiss"
                onClick={() => onDismiss(i)}
              >
                Skip
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="panel-foot">
        <span className="hint">Extracted from this note</span>
        <button className="toggle" type="button">PAUSE</button>
      </div>
    </aside>
  );
}
