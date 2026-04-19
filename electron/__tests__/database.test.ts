import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../database';
import fs from 'fs';

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
