interface Note {
  id: number;
  title: string;
  content: string;
  folderId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'in_progress' | 'done';
  dueDate: string | null;
  sourceNoteId: number;
  sourceText: string;
  createdAt: string;
  updatedAt: string;
}

interface Folder {
  id: number;
  name: string;
  parentId: number | null;
}

declare global {
  interface Window {
    actionflow: {
      platform: string;
      notes: {
        list(folderId?: number): Promise<Note[]>;
        get(id: number): Promise<Note | null>;
        create(data: { title: string; content: string; folderId: number | null }): Promise<Note>;
        update(id: number, data: Partial<Pick<Note, 'title' | 'content' | 'folderId'>>): Promise<void>;
        delete(id: number): Promise<void>;
      };
      tasks: {
        list(filter?: { status?: string; sourceNoteId?: number }): Promise<Task[]>;
        get(id: number): Promise<Task | null>;
        create(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task>;
        update(id: number, data: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'status' | 'dueDate'>>): Promise<void>;
        delete(id: number): Promise<void>;
      };
      folders: {
        list(): Promise<Folder[]>;
        create(data: { name: string; parentId: number | null }): Promise<Folder>;
      };
      config: {
        setApiKey(key: string): Promise<void>;
        getApiKey(): Promise<string>;
      };
      ai: {
        extract(noteContent: string, noteTitle: string, existingTaskTitles: string[]): Promise<ExtractedTask[]>;
      };
      calendar: {
        events(daysAhead?: number): Promise<CalendarEvent[]>;
        freeSlots(date: string, workStart: number, workEnd: number): Promise<FreeSlot[]>;
      };
    };
  }
}

interface ExtractedTask {
  title: string;
  priority: 'high' | 'medium' | 'low';
  suggestedDueDate: string | null;
  sourceText: string;
  reasoning: string;
}

interface CalendarEvent {
  title: string;
  date: string;
  startHour: number;
  endHour: number;
}

interface FreeSlot {
  start: number;
  end: number;
}

export const api = window.actionflow;
export type { Note, Task, Folder, ExtractedTask, CalendarEvent, FreeSlot };
