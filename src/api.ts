export interface Note {
  id: number;
  title: string;
  content: string;
  folderId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'done';
  dueDate: string | null;
  sourceNoteId: number | null;
  sourceText: string;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: number;
  name: string;
  parentId: number | null;
}

export interface ExtractedTask {
  title: string;
  priority: 'high' | 'medium' | 'low';
  suggestedDueDate: string | null;
  sourceText: string;
  reasoning: string;
}

export interface CalendarEvent {
  title: string;
  date: string;
  startHour: number;
  endHour: number;
}

export interface FreeSlot {
  start: number;
  end: number;
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return json<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function patch(url: string, body: unknown): Promise<void> {
  return json(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function put(url: string, body: unknown): Promise<void> {
  return json(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function del(url: string): Promise<void> {
  return json(url, { method: 'DELETE' });
}

export const api = {
  notes: {
    list: (folderId?: number): Promise<Note[]> =>
      json(`/api/notes${folderId !== undefined ? `?folderId=${folderId}` : ''}`),
    get: (id: number): Promise<Note | null> =>
      json(`/api/notes/${id}`),
    create: (data: { title: string; content: string; folderId: number | null }): Promise<Note> =>
      post('/api/notes', data),
    update: (id: number, data: Partial<Pick<Note, 'title' | 'content' | 'folderId'>>): Promise<void> =>
      patch(`/api/notes/${id}`, data),
    delete: (id: number): Promise<void> =>
      del(`/api/notes/${id}`),
  },
  tasks: {
    list: (filter?: { status?: string; sourceNoteId?: number }): Promise<Task[]> => {
      const params = new URLSearchParams();
      if (filter?.status) params.set('status', filter.status);
      if (filter?.sourceNoteId) params.set('sourceNoteId', String(filter.sourceNoteId));
      const qs = params.toString();
      return json(`/api/tasks${qs ? `?${qs}` : ''}`);
    },
    get: (id: number): Promise<Task | null> =>
      json(`/api/tasks/${id}`),
    create: (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> =>
      post('/api/tasks', data),
    update: (id: number, data: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'status' | 'dueDate'>>): Promise<void> =>
      patch(`/api/tasks/${id}`, data),
    delete: (id: number): Promise<void> =>
      del(`/api/tasks/${id}`),
  },
  folders: {
    list: (): Promise<Folder[]> =>
      json('/api/folders'),
    create: (data: { name: string; parentId: number | null }): Promise<Folder> =>
      post('/api/folders', data),
  },
  config: {
    setApiKey: (key: string): Promise<void> =>
      put('/api/config/api-key', { key }),
    getApiKey: async (): Promise<string> => {
      const res = await json<{ key: string }>('/api/config/api-key');
      return res.key;
    },
  },
  ai: {
    extract: (noteContent: string, noteTitle: string, existingTaskTitles: string[]): Promise<ExtractedTask[]> =>
      post('/api/ai/extract', { noteContent, noteTitle, existingTaskTitles }),
  },
  calendar: {
    events: (daysAhead?: number): Promise<CalendarEvent[]> =>
      json(`/api/calendar/events${daysAhead !== undefined ? `?daysAhead=${daysAhead}` : ''}`),
    freeSlots: (date: string, workStart: number, workEnd: number): Promise<FreeSlot[]> =>
      json(`/api/calendar/free-slots?date=${date}&workStart=${workStart}&workEnd=${workEnd}`),
  },
};
