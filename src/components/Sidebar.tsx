import type { Note, Folder } from '../api';

type View = 'notes' | 'tasks' | 'schedule';

interface SidebarProps {
  folders: Folder[];
  notes: Note[];
  activeView: View;
  onSelectNote: (id: number) => void;
  onSelectView: (view: View) => void;
  onCreateNote: () => void;
}

export function Sidebar({ folders, notes, activeView, onSelectNote, onSelectView, onCreateNote }: SidebarProps) {
  return (
    <aside style={{ width: 220, borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', padding: 12 }}>
      <button onClick={onCreateNote} style={{ marginBottom: 12, padding: '8px 12px', cursor: 'pointer' }}>
        + New Note
      </button>

      <div style={{ marginBottom: 16 }}>
        {folders.map(f => (
          <div key={f.id} style={{ padding: '4px 8px', fontWeight: 600 }}>{f.name}</div>
        ))}
      </div>

      <div style={{ marginBottom: 8 }}>
        {notes.map(n => (
          <div key={n.id} onClick={() => onSelectNote(n.id)}
            style={{ padding: '4px 8px', cursor: 'pointer', borderRadius: 4 }}>
            {n.title || 'Untitled'}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 12, marginTop: 'auto' }}>
        <div onClick={() => onSelectView('tasks')}
          style={{ padding: '6px 8px', cursor: 'pointer', fontWeight: activeView === 'tasks' ? 700 : 400 }}>
          Tasks
        </div>
        <div onClick={() => onSelectView('schedule')}
          style={{ padding: '6px 8px', cursor: 'pointer', fontWeight: activeView === 'schedule' ? 700 : 400 }}>
          Schedule
        </div>
      </div>
    </aside>
  );
}
