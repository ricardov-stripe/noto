import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import type { Note, Task, Folder, CalendarEvent, FreeSlot } from './api';
import { Sidebar, type View } from './components/Sidebar';
import { Titlebar } from './components/Titlebar';
import { NoteEditor } from './components/NoteEditor';
import { TaskPanel, type TaskSuggestion } from './components/TaskPanel';
import { TaskListView } from './components/TaskListView';
import { ScheduleView } from './components/ScheduleView';
import { SetupScreen } from './components/SetupScreen';

const THEME_STORAGE_KEY = 'noto.theme';

export default function App() {
  /* ------------------------------ data state ------------------------------ */
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<View>('notes');
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [freeSlots, setFreeSlots] = useState<FreeSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);

  /* ------------------------------ theme ------------------------------ */
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('theme-dark', theme === 'dark');
    root.classList.toggle('theme-light', theme === 'light');
    try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* noop */ }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  /* ------------------------------ debounce ref ------------------------------ */
  const extractDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) ?? null,
    [notes, activeNoteId]
  );
  const activeFolder = useMemo(
    () => (activeNote ? folders.find((f) => f.id === activeNote.folderId) ?? null : null),
    [activeNote, folders]
  );

  /* ------------------------------ initial load ------------------------------ */
  useEffect(() => {
    Promise.all([api.notes.list(), api.tasks.list(), api.folders.list()])
      .then(([n, t, f]) => {
        setNotes(n);
        setTasks(t);
        setFolders(f);
        if (n.length > 0) setActiveNoteId(n[0].id);
      })
      .catch(() => { /* server may be down — stay quiet, render empty */ });
  }, []);

  useEffect(() => {
    api.config.getApiKey()
      .then((key) => {
        if (key) setApiKey(key);
        setApiKeyLoaded(true);
      })
      .catch(() => setApiKeyLoaded(true));
  }, []);

  useEffect(() => {
    api.calendar.events(7).then(setCalendarEvents).catch(() => setCalendarEvents([]));
  }, []);

  useEffect(() => {
    api.calendar.freeSlots(selectedDate, 9, 17).then(setFreeSlots).catch(() => setFreeSlots([]));
  }, [selectedDate]);

  /* ------------------------------ data ops ------------------------------ */
  const refreshNotes = useCallback(async () => setNotes(await api.notes.list()), []);
  const refreshTasks = useCallback(async () => setTasks(await api.tasks.list()), []);

  const handleCreateNote = useCallback(async () => {
    const note = await api.notes.create({ title: 'Untitled', content: '', folderId: null });
    await refreshNotes();
    setActiveNoteId(note.id);
    setActiveView('notes');
  }, [refreshNotes]);

  /**
   * Title and content are saved separately — coalesced via a 600ms
   * debounce so we don't pummel the server on every keystroke.
   * AI extraction runs on top of that with a longer 2s settling window.
   */
  const scheduleSave = useCallback(
    (id: number, patch: { title?: string; content?: string }) => {
      // Optimistic local update so the recent list / sidebar reflects edits.
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n
        )
      );

      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(async () => {
        try {
          await api.notes.update(id, patch);
          // Reconcile with server (gets canonical updatedAt).
          await refreshNotes();
        } catch {
          /* swallow — UI is optimistic; user sees no jank on transient errors */
        }
      }, 600);

      if (patch.content !== undefined) {
        if (extractDebounceRef.current) clearTimeout(extractDebounceRef.current);
        extractDebounceRef.current = setTimeout(async () => {
          if (!apiKey) return;
          const note = (await api.notes.get(id)) ?? null;
          if (!note) return;
          setIsExtracting(true);
          try {
            const existingTitles = tasks
              .filter((t) => t.sourceNoteId === id)
              .map((t) => t.title);
            const extracted = await api.ai.extract(note.content, note.title, existingTitles);
            setSuggestions(extracted);
          } catch {
            /* keep current suggestions — extraction is best-effort */
          } finally {
            setIsExtracting(false);
          }
        }, 2000);
      }
    },
    [apiKey, refreshNotes, tasks]
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!activeNoteId) return;
      scheduleSave(activeNoteId, { title: title || 'Untitled' });
    },
    [activeNoteId, scheduleSave]
  );

  const handleContentChange = useCallback(
    (content: string) => {
      if (!activeNoteId) return;
      scheduleSave(activeNoteId, { content });
    },
    [activeNoteId, scheduleSave]
  );

  const handleAcceptSuggestion = useCallback(
    async (index: number) => {
      if (!activeNoteId) return;
      const suggestion = suggestions[index];
      if (!suggestion) return;
      await api.tasks.create({
        title: suggestion.title,
        description: '',
        priority: suggestion.priority,
        status: 'todo',
        dueDate: suggestion.suggestedDueDate,
        sourceNoteId: activeNoteId,
        sourceText: suggestion.sourceText,
      });
      setSuggestions((prev) => prev.filter((_, i) => i !== index));
      await refreshTasks();
    },
    [activeNoteId, suggestions, refreshTasks]
  );

  const handleDismissSuggestion = useCallback((index: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateTaskStatus = useCallback(
    async (id: number, status: Task['status']) => {
      // Optimistic.
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
      try {
        await api.tasks.update(id, { status });
        await refreshTasks();
      } catch {
        await refreshTasks();
      }
    },
    [refreshTasks]
  );

  const handleNavigateToNote = useCallback((noteId: number) => {
    setActiveNoteId(noteId);
    setActiveView('notes');
  }, []);

  /* ------------------------------ rendering ------------------------------ */

  if (apiKeyLoaded && !apiKey) {
    return (
      <>
        <Titlebar theme={theme} onToggleTheme={toggleTheme} crumb={{ folder: 'Setup' }} />
        <SetupScreen
          onSave={(key) => {
            setApiKey(key);
          }}
        />
      </>
    );
  }

  const noteSuggestionsActive = activeView === 'notes' && activeNote != null;

  return (
    <div className="app">
      <Titlebar
        theme={theme}
        onToggleTheme={toggleTheme}
        crumb={{
          folder:
            activeView === 'notes'
              ? activeFolder?.name ?? 'Notes'
              : activeView === 'tasks'
                ? 'Tasks'
                : 'Schedule',
          note: activeView === 'notes' ? activeNote?.title : undefined,
        }}
      />

      <div className="shell">
        <Sidebar
          folders={folders}
          notes={notes}
          tasks={tasks}
          activeNoteId={activeNoteId}
          activeView={activeView}
          onSelectNote={(id) => {
            setActiveNoteId(id);
            setActiveView('notes');
          }}
          onSelectView={setActiveView}
          onCreateNote={handleCreateNote}
        />

        {activeView === 'notes' && (
          <>
            {activeNote ? (
              <NoteEditor
                noteId={activeNote.id}
                title={activeNote.title}
                content={activeNote.content}
                folderName={activeFolder?.name ?? null}
                updatedAt={activeNote.updatedAt}
                isExtracting={isExtracting}
                onTitleChange={handleTitleChange}
                onContentChange={handleContentChange}
              />
            ) : (
              <main className="editor" aria-label="Note editor">
                <div className="empty-editor">
                  <div className="blurb">
                    <strong>No note selected.</strong>
                    <br />
                    Pick one from the sidebar or start a new one — the AI
                    will quietly extract action items as you write.
                  </div>
                  <button className="cta" type="button" onClick={handleCreateNote}>
                    + New note
                  </button>
                </div>
              </main>
            )}
            <TaskPanel
              suggestions={suggestions}
              isLoading={isExtracting && noteSuggestionsActive}
              onAccept={handleAcceptSuggestion}
              onDismiss={handleDismissSuggestion}
            />
          </>
        )}

        {activeView === 'tasks' && (
          <TaskListView
            tasks={tasks}
            onUpdateStatus={handleUpdateTaskStatus}
            onNavigateToNote={handleNavigateToNote}
          />
        )}

        {activeView === 'schedule' && (
          <ScheduleView
            events={calendarEvents}
            tasks={tasks}
            freeSlots={freeSlots}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        )}
      </div>
    </div>
  );
}
