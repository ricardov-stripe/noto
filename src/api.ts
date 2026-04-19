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
    };
  }
}

export const api = window.actionflow;
export type { Note, Task, Folder };
