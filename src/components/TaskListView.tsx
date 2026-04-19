import type { Task } from '../api';

interface TaskListViewProps {
  tasks: Task[];
  onUpdateStatus: (id: number, status: Task['status']) => void;
  onNavigateToNote: (noteId: number) => void;
}

const statusLabels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const statusOrder: Task['status'][] = ['todo', 'in_progress', 'done'];
const priorityColors = { high: '#e53e3e', medium: '#dd6b20', low: '#38a169' };

export function TaskListView({ tasks, onUpdateStatus, onNavigateToNote }: TaskListViewProps) {
  const grouped = statusOrder.map(status => ({
    status,
    label: statusLabels[status],
    items: tasks.filter(t => t.status === status),
  }));

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Tasks</h2>
      {grouped.map(group => (
        <div key={group.status} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, color: '#555', marginBottom: 8 }}>
            {group.label} ({group.items.length})
          </h3>
          {group.items.map(task => (
            <div key={task.id} style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <select value={task.status} onChange={e => onUpdateStatus(task.id, e.target.value as Task['status'])}
                style={{ fontSize: 12, padding: 2 }}>
                {statusOrder.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
              </select>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{task.title}</div>
                <div style={{ fontSize: 11, color: '#666' }}>
                  <span style={{ color: priorityColors[task.priority] }}>{task.priority}</span>
                  {task.dueDate && <span> · Due {task.dueDate}</span>}
                </div>
              </div>
              <button onClick={() => onNavigateToNote(task.sourceNoteId)}
                style={{ fontSize: 11, cursor: 'pointer', background: 'none', border: '1px solid #ccc', borderRadius: 4, padding: '2px 8px' }}>
                View Note
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
