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

const priorityColors = { high: '#e53e3e', medium: '#dd6b20', low: '#38a169' };

export function TaskPanel({ suggestions, isLoading, onAccept, onDismiss }: TaskPanelProps) {
  return (
    <aside style={{ width: 280, borderLeft: '1px solid #e0e0e0', padding: 12, overflowY: 'auto' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Suggested Tasks</h3>

      {isLoading && <div style={{ color: '#888', fontSize: 13 }}>Extracting tasks...</div>}

      {!isLoading && suggestions.length === 0 && (
        <div style={{ color: '#888', fontSize: 13 }}>No action items found</div>
      )}

      {suggestions.map((s, i) => (
        <div key={i} style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{s.title}</div>
          <div style={{ fontSize: 11, color: priorityColors[s.priority], marginBottom: 4 }}>
            {s.priority}{s.suggestedDueDate ? ` · ${s.suggestedDueDate}` : ''}
          </div>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>{s.reasoning}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button aria-label="Accept" onClick={() => onAccept(i)}
              style={{ flex: 1, padding: '4px 8px', cursor: 'pointer', background: '#38a169', color: '#fff', border: 'none', borderRadius: 4 }}>
              Accept
            </button>
            <button aria-label="Dismiss" onClick={() => onDismiss(i)}
              style={{ flex: 1, padding: '4px 8px', cursor: 'pointer', background: '#e0e0e0', border: 'none', borderRadius: 4 }}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </aside>
  );
}
