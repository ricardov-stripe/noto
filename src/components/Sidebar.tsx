import { useMemo } from 'react';
import type { Note, Folder, Task } from '../api';
import { IconCalendar, IconFolder, IconNote, IconPlus, IconSettings, IconTask } from './Icons';

export type View = 'notes' | 'tasks' | 'schedule';

interface SidebarProps {
  folders: Folder[];
  notes: Note[];
  tasks: Task[];
  activeNoteId: number | null;
  activeView: View;
  onSelectNote: (id: number) => void;
  onSelectView: (view: View) => void;
  onCreateNote: () => void;
}

/**
 * Three-section sidebar:
 *   1. Brand mark + sync indicator
 *   2. New-note CTA + Views nav (counts) + Folders nav (counts)
 *   3. Recent notes list (most-recently-updated first, stamped with a
 *      humanized timestamp)
 *
 * Counts are derived from the same data that drives the views, so they
 * stay correct without any extra fetch.
 */
export function Sidebar({
  folders,
  notes,
  tasks,
  activeNoteId,
  activeView,
  onSelectNote,
  onSelectView,
  onCreateNote,
}: SidebarProps) {
  const recents = useMemo(
    () =>
      [...notes]
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
        .slice(0, 12),
    [notes]
  );

  const counts = useMemo(
    () => ({
      notes: notes.length,
      tasks: tasks.filter((t) => t.status !== 'done').length,
      schedule: tasks.filter((t) => t.dueDate && t.status !== 'done').length,
    }),
    [notes, tasks]
  );

  const folderCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const n of notes) {
      if (n.folderId == null) continue;
      map.set(n.folderId, (map.get(n.folderId) ?? 0) + 1);
    }
    return map;
  }, [notes]);

  return (
    <aside className="sidebar" aria-label="Navigation">
      <div className="brand">
        <span className="mark">
          Noto<span className="dot">.</span>
        </span>
        <span className="sync" title="Local-first">SYNCED</span>
      </div>

      <button className="new-note-btn" type="button" onClick={onCreateNote}>
        <span className="label">
          <IconPlus />
          <span className="text">New note</span>
        </span>
        <span className="kbd">⌘N</span>
      </button>

      <nav className="nav-section" aria-label="Views">
        <div className="label">VIEWS</div>
        <NavItem
          active={activeView === 'notes'}
          onClick={() => onSelectView('notes')}
          icon={<IconNote />}
          label="Notes"
          count={counts.notes}
        />
        <NavItem
          active={activeView === 'tasks'}
          onClick={() => onSelectView('tasks')}
          icon={<IconTask />}
          label="Tasks"
          count={counts.tasks}
        />
        <NavItem
          active={activeView === 'schedule'}
          onClick={() => onSelectView('schedule')}
          icon={<IconCalendar />}
          label="Schedule"
          count={counts.schedule}
        />
      </nav>

      {folders.length > 0 && (
        <nav className="nav-section" aria-label="Folders">
          <div className="label">FOLDERS</div>
          {folders.map((f) => (
            <NavItem
              key={f.id}
              icon={<IconFolder />}
              label={f.name}
              count={folderCounts.get(f.id) ?? 0}
              onClick={() => onSelectView('notes')}
            />
          ))}
        </nav>
      )}

      <div className="recent-list">
        <div className="label">RECENT</div>
        {recents.length === 0 && (
          <div className="empty-section" style={{ padding: '8px 0' }}>
            Nothing yet — create your first note.
          </div>
        )}
        {recents.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`recent-item${n.id === activeNoteId ? ' active' : ''}`}
            onClick={() => onSelectNote(n.id)}
          >
            <span className="title">{n.title?.trim() || 'Untitled'}</span>
            <span className="when">{formatWhen(n.updatedAt)}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="avatar" aria-hidden="true">R</div>
        <div className="who"><strong>ricardo</strong></div>
        <button className="icon-btn" type="button" title="Settings" aria-label="Settings">
          <IconSettings />
        </button>
      </div>
    </aside>
  );
}

interface NavItemProps {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  count?: number;
  onClick?: () => void;
}

function NavItem({ active, icon, label, count, onClick }: NavItemProps) {
  return (
    <div
      className={`nav-item${active ? ' active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <span className="left">
        {icon}
        <span className="text">{label}</span>
      </span>
      {count != null && <span className="count">{count}</span>}
    </div>
  );
}

/**
 * Humanize an ISO timestamp into the same format the design uses:
 * today  → "2:14 PM"
 * yesterday → "YESTERDAY"
 * within 7 days → "MON" / "TUE" etc.
 * older  → "APR 17"
 */
function formatWhen(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return 'YESTERDAY';

  const ageDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (ageDays >= 0 && ageDays < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  }
  return d
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase();
}
