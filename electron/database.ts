import * as fs from 'node:fs';
import BetterSqlite3 from 'better-sqlite3';

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
  sourceNoteId: number | null;
  sourceText: string;
  createdAt: string;
  updatedAt: string;
}

interface Folder {
  id: number;
  name: string;
  parentId: number | null;
}

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string) {
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma('journal_mode = WAL');
    try {
      const cols = this.db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string; notnull: number }>;
      const sourceCol = cols.find((c) => c.name === 'sourceNoteId');
      if (sourceCol && sourceCol.notnull === 1 && fs.existsSync(dbPath)) {
        const backup = `${dbPath}.bak.${Date.now()}`;
        fs.copyFileSync(dbPath, backup);
      }
    } catch {
      // best-effort backup; do not block migration
    }
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        parentId INTEGER REFERENCES folders(id)
      );
      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        folderId INTEGER REFERENCES folders(id),
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL CHECK(priority IN ('high','medium','low')),
        status TEXT NOT NULL CHECK(status IN ('todo','in_progress','done')),
        dueDate TEXT,
        sourceNoteId INTEGER REFERENCES notes(id),
        sourceText TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Migration: drop NOT NULL on tasks.sourceNoteId for manual tasks.
    // SQLite cannot ALTER a column's nullability — rebuild the table if needed.
    const cols = this.db.prepare('PRAGMA table_info(tasks)').all() as Array<{
      name: string; notnull: number;
    }>;
    const sourceCol = cols.find((c) => c.name === 'sourceNoteId');
    if (sourceCol && sourceCol.notnull === 1) {
      this.db.exec(`
        BEGIN;
        CREATE TABLE tasks_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          priority TEXT NOT NULL CHECK(priority IN ('high','medium','low')),
          status TEXT NOT NULL CHECK(status IN ('todo','in_progress','done')),
          dueDate TEXT,
          sourceNoteId INTEGER REFERENCES notes(id),
          sourceText TEXT NOT NULL DEFAULT '',
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO tasks_new (id, title, description, priority, status, dueDate, sourceNoteId, sourceText, createdAt, updatedAt)
          SELECT id, title, description, priority, status, dueDate, sourceNoteId, sourceText, createdAt, updatedAt FROM tasks;
        DROP TABLE tasks;
        ALTER TABLE tasks_new RENAME TO tasks;
        COMMIT;
      `);
    }
  }

  createNote(data: { title: string; content: string; folderId: number | null }): Note {
    const stmt = this.db.prepare('INSERT INTO notes (title, content, folderId) VALUES (?, ?, ?)');
    const result = stmt.run(data.title, data.content, data.folderId);
    return this.getNote(result.lastInsertRowid as number)!;
  }

  getNote(id: number): Note | null {
    return (this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined) ?? null;
  }

  updateNote(id: number, data: Partial<Pick<Note, 'title' | 'content' | 'folderId'>>) {
    const fields = Object.entries(data).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return;
    const sets = fields.map(([k]) => `${k} = ?`).join(', ');
    this.db.prepare(`UPDATE notes SET ${sets}, updatedAt = datetime('now') WHERE id = ?`)
      .run(...fields.map(([, v]) => v), id);
  }

  deleteNote(id: number) {
    this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  }

  listNotes(folderId?: number | null): Note[] {
    if (folderId !== undefined) {
      return this.db.prepare('SELECT * FROM notes WHERE folderId IS ? ORDER BY updatedAt DESC').all(folderId) as Note[];
    }
    return this.db.prepare('SELECT * FROM notes ORDER BY updatedAt DESC').all() as Note[];
  }

  createTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
    const stmt = this.db.prepare(
      'INSERT INTO tasks (title, description, priority, status, dueDate, sourceNoteId, sourceText) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(data.title, data.description, data.priority, data.status, data.dueDate, data.sourceNoteId, data.sourceText);
    return this.getTask(result.lastInsertRowid as number)!;
  }

  getTask(id: number): Task | null {
    return (this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined) ?? null;
  }

  updateTask(id: number, data: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'status' | 'dueDate'>>) {
    const fields = Object.entries(data).filter(([, v]) => v !== undefined);
    if (fields.length === 0) {
      // Empty patch still bumps updatedAt so "Dismiss to Later" in the NEW
      // tab can mark a task as triaged without changing anything else.
      this.db.prepare(`UPDATE tasks SET updatedAt = datetime('now') WHERE id = ?`).run(id);
      return;
    }
    const sets = fields.map(([k]) => `${k} = ?`).join(', ');
    this.db.prepare(`UPDATE tasks SET ${sets}, updatedAt = datetime('now') WHERE id = ?`)
      .run(...fields.map(([, v]) => v), id);
  }

  deleteTask(id: number) {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  }

  listTasks(filter?: { status?: string; sourceNoteId?: number }): Task[] {
    let query = 'SELECT * FROM tasks';
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter?.status) { conditions.push('status = ?'); params.push(filter.status); }
    if (filter?.sourceNoteId) { conditions.push('sourceNoteId = ?'); params.push(filter.sourceNoteId); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY createdAt DESC';
    return this.db.prepare(query).all(...params) as Task[];
  }

  createFolder(data: { name: string; parentId: number | null }): Folder {
    const stmt = this.db.prepare('INSERT INTO folders (name, parentId) VALUES (?, ?)');
    const result = stmt.run(data.name, data.parentId);
    return this.db.prepare('SELECT * FROM folders WHERE id = ?').get(result.lastInsertRowid) as Folder;
  }

  listFolders(): Folder[] {
    return this.db.prepare('SELECT * FROM folders ORDER BY name').all() as Folder[];
  }

  close() {
    this.db.close();
  }
}
