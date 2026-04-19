import { useState, useEffect, useCallback, useRef } from 'react';
import type { Note, Task, Folder, CalendarEvent, FreeSlot } from './api';
import { Sidebar } from './components/Sidebar';
import { NoteEditor } from './components/NoteEditor';
import { TaskPanel, type TaskSuggestion } from './components/TaskPanel';
import { TaskListView } from './components/TaskListView';
import { ScheduleView } from './components/ScheduleView';
import { SetupScreen } from './components/SetupScreen';

type View = 'notes' | 'tasks' | 'schedule';

export default function App() {
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

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const activeNote = notes.find(n => n.id === activeNoteId) ?? null;

  // Load initial data
  useEffect(() => {
    if (!window.actionflow) return;
    Promise.all([
      window.actionflow.notes.list(),
      window.actionflow.tasks.list(),
      window.actionflow.folders.list(),
    ]).then(([n, t, f]) => {
      setNotes(n);
      setTasks(t);
      setFolders(f);
      if (n.length > 0) setActiveNoteId(n[0].id);
    });
  }, []);

  // Load API key
  useEffect(() => {
    if (!window.actionflow) return;
    window.actionflow.config.getApiKey().then((key) => {
      if (key) setApiKey(key);
      setApiKeyLoaded(true);
    }).catch(() => setApiKeyLoaded(true));
  }, []);

  // Load calendar events
  useEffect(() => {
    if (!window.actionflow) return;
    window.actionflow.calendar.events(7).then((events) => {
      setCalendarEvents(events);
    });
  }, []);

  // Update free slots when date changes
  useEffect(() => {
    if (!window.actionflow) return;
    window.actionflow.calendar.freeSlots(selectedDate, 9, 17).then((slots) => {
      setFreeSlots(slots);
    });
  }, [selectedDate]);

  const refreshNotes = useCallback(async () => {
    if (!window.actionflow) return;
    const n = await window.actionflow.notes.list();
    setNotes(n);
  }, []);

  const refreshTasks = useCallback(async () => {
    if (!window.actionflow) return;
    const t = await window.actionflow.tasks.list();
    setTasks(t);
  }, []);

  const handleCreateNote = useCallback(async () => {
    if (!window.actionflow) return;
    const note = await window.actionflow.notes.create({ title: 'Untitled', content: '', folderId: null });
    await refreshNotes();
    setActiveNoteId(note.id);
    setActiveView('notes');
  }, [refreshNotes]);

  const handleNoteChange = useCallback(async (html: string) => {
    if (!window.actionflow || !activeNoteId) return;

    // Save to DB
    await window.actionflow.notes.update(activeNoteId, { content: html });

    // Extract title from first line
    const titleMatch = html.match(/<[^>]*>([^<]+)/);
    const title = titleMatch?.[1]?.trim() || 'Untitled';
    await window.actionflow.notes.update(activeNoteId, { title });
    await refreshNotes();

    // Debounced AI extraction
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!apiKey) return;
      setIsExtracting(true);
      try {
        const existingTitles = tasks.filter(t => t.sourceNoteId === activeNoteId).map(t => t.title);
        const extracted = await window.actionflow.ai.extract(html, title, existingTitles);
        setSuggestions(extracted);
      } catch {
        // Extraction failed silently
      } finally {
        setIsExtracting(false);
      }
    }, 2000);
  }, [activeNoteId, apiKey, tasks, refreshNotes]);

  const handleAcceptSuggestion = useCallback(async (index: number) => {
    if (!window.actionflow || !activeNoteId) return;
    const suggestion = suggestions[index];
    await window.actionflow.tasks.create({
      title: suggestion.title,
      description: '',
      priority: suggestion.priority,
      status: 'todo',
      dueDate: suggestion.suggestedDueDate,
      sourceNoteId: activeNoteId,
      sourceText: suggestion.sourceText,
    });
    setSuggestions(prev => prev.filter((_, i) => i !== index));
    await refreshTasks();
  }, [activeNoteId, suggestions, refreshTasks]);

  const handleDismissSuggestion = useCallback((index: number) => {
    setSuggestions(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateTaskStatus = useCallback(async (id: number, status: Task['status']) => {
    if (!window.actionflow) return;
    await window.actionflow.tasks.update(id, { status });
    await refreshTasks();
  }, [refreshTasks]);

  const handleNavigateToNote = useCallback((noteId: number) => {
    setActiveNoteId(noteId);
    setActiveView('notes');
  }, []);

  // Render main content based on active view
  const renderContent = () => {
    switch (activeView) {
      case 'tasks':
        return <TaskListView tasks={tasks} onUpdateStatus={handleUpdateTaskStatus} onNavigateToNote={handleNavigateToNote} />;
      case 'schedule':
        return <ScheduleView events={calendarEvents} tasks={tasks} freeSlots={freeSlots} selectedDate={selectedDate} onDateChange={setSelectedDate} />;
      case 'notes':
      default:
        return (
          <>
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {activeNote ? (
                <NoteEditor content={activeNote.content} onChange={handleNoteChange} />
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                  Select a note or create a new one
                </div>
              )}
            </main>
            <TaskPanel suggestions={suggestions} isLoading={isExtracting} onAccept={handleAcceptSuggestion} onDismiss={handleDismissSuggestion} />
          </>
        );
    }
  };

  // Show setup screen if no API key (only in Electron where IPC is available)
  if (apiKeyLoaded && !apiKey && window.actionflow) {
    return <SetupScreen onSave={(key) => setApiKey(key)} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <Sidebar
        folders={folders}
        notes={notes}
        activeView={activeView}
        onSelectNote={(id) => { setActiveNoteId(id); setActiveView('notes'); }}
        onSelectView={setActiveView}
        onCreateNote={handleCreateNote}
      />
      {renderContent()}
    </div>
  );
}
