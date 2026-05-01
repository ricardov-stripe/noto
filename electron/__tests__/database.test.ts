import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../database';
import fs from 'fs';
import * as fsm from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';

const TEST_DB = '/tmp/noto-test.db';

describe('Database', () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(TEST_DB);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  describe('notes', () => {
    it('creates and retrieves a note', () => {
      const note = db.createNote({ title: 'Test Note', content: '# Hello', folderId: null });
      expect(note.id).toBeDefined();
      expect(note.title).toBe('Test Note');

      const fetched = db.getNote(note.id);
      expect(fetched?.content).toBe('# Hello');
    });

    it('updates a note', () => {
      const note = db.createNote({ title: 'Old', content: '', folderId: null });
      db.updateNote(note.id, { title: 'New', content: '# Updated' });
      const fetched = db.getNote(note.id);
      expect(fetched?.title).toBe('New');
      expect(fetched?.content).toBe('# Updated');
    });

    it('deletes a note', () => {
      const note = db.createNote({ title: 'Doomed', content: '', folderId: null });
      db.deleteNote(note.id);
      expect(db.getNote(note.id)).toBeNull();
    });

    it('lists all notes', () => {
      db.createNote({ title: 'A', content: '', folderId: null });
      db.createNote({ title: 'B', content: '', folderId: null });
      expect(db.listNotes()).toHaveLength(2);
    });
  });

  describe('tasks', () => {
    it('creates and retrieves a task', () => {
      const note = db.createNote({ title: 'N', content: '', folderId: null });
      const task = db.createTask({
        title: 'Do thing',
        description: '',
        priority: 'high',
        status: 'todo',
        dueDate: '2026-04-21',
        sourceNoteId: note.id,
        sourceText: 'do thing',
      });
      expect(task.id).toBeDefined();
      expect(task.priority).toBe('high');
    });

    it('updates task status', () => {
      const note = db.createNote({ title: 'N', content: '', folderId: null });
      const task = db.createTask({
        title: 'T', description: '', priority: 'medium',
        status: 'todo', dueDate: null, sourceNoteId: note.id, sourceText: '',
      });
      db.updateTask(task.id, { status: 'done' });
      expect(db.getTask(task.id)?.status).toBe('done');
    });

    it('lists tasks by status', () => {
      const note = db.createNote({ title: 'N', content: '', folderId: null });
      db.createTask({ title: 'A', description: '', priority: 'low', status: 'todo', dueDate: null, sourceNoteId: note.id, sourceText: '' });
      db.createTask({ title: 'B', description: '', priority: 'low', status: 'done', dueDate: null, sourceNoteId: note.id, sourceText: '' });
      expect(db.listTasks({ status: 'todo' })).toHaveLength(1);
    });
  });

  describe('folders', () => {
    it('creates and lists folders', () => {
      db.createFolder({ name: 'Work', parentId: null });
      db.createFolder({ name: 'Personal', parentId: null });
      expect(db.listFolders()).toHaveLength(2);
    });
  });
});

function tmpDb(): string {
  return path.join(os.tmpdir(), `noto-test-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
}

describe('Database migration: nullable sourceNoteId', () => {
  let dbPath: string;

  beforeEach(() => { dbPath = tmpDb(); });
  afterEach(() => { try { fsm.unlinkSync(dbPath); } catch {} });

  it('migrates an existing tasks table with NOT NULL sourceNoteId to nullable', () => {
    const raw = new BetterSqlite3(dbPath);
    raw.exec(`
      CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', folderId INTEGER, createdAt TEXT NOT NULL DEFAULT (datetime('now')), updatedAt TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL CHECK(priority IN ('high','medium','low')),
        status TEXT NOT NULL CHECK(status IN ('todo','in_progress','done')),
        dueDate TEXT,
        sourceNoteId INTEGER NOT NULL REFERENCES notes(id),
        sourceText TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    raw.prepare('INSERT INTO notes (title) VALUES (?)').run('A note');
    raw.prepare("INSERT INTO tasks (title, priority, status, sourceNoteId) VALUES (?, ?, ?, ?)")
      .run('Existing', 'medium', 'todo', 1);
    raw.close();

    const db = new Database(dbPath);
    const tasks = db.listTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Existing');
    expect(tasks[0].sourceNoteId).toBe(1);

    const manual = db.createTask({
      title: 'Manual task',
      description: '',
      priority: 'medium',
      status: 'todo',
      dueDate: null,
      sourceNoteId: null,
      sourceText: '',
    });
    expect(manual.sourceNoteId).toBeNull();
    db.close();
  });

  it('is idempotent — running migration twice does not double-migrate or corrupt rows', () => {
    const db1 = new Database(dbPath);
    db1.close();
    const db2 = new Database(dbPath);
    const t = db2.createTask({
      title: 'X', description: '', priority: 'low', status: 'todo',
      dueDate: null, sourceNoteId: null, sourceText: '',
    });
    expect(t.sourceNoteId).toBeNull();
    db2.close();
  });
});
