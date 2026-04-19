const express = require('express');
const cors = require('cors');
const path = require('path');
const { Database } = require('../electron-dist/database');
const { extractTasks } = require('../electron-dist/extraction');
const { fetchCalendarEvents, findFreeSlots } = require('../electron-dist/calendar');

const app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, '..', 'noto.db');
const db = new Database(dbPath);

let apiKey = '';

// --- Notes ---
app.get('/api/notes', (req, res) => {
  const folderId = req.query.folderId !== undefined ? Number(req.query.folderId) : undefined;
  res.json(db.listNotes(folderId));
});

app.get('/api/notes/:id', (req, res) => {
  const note = db.getNote(Number(req.params.id));
  if (!note) return res.status(404).json({ error: 'Not found' });
  res.json(note);
});

app.post('/api/notes', (req, res) => {
  const note = db.createNote(req.body);
  res.json(note);
});

app.patch('/api/notes/:id', (req, res) => {
  db.updateNote(Number(req.params.id), req.body);
  res.json({ ok: true });
});

app.delete('/api/notes/:id', (req, res) => {
  db.deleteNote(Number(req.params.id));
  res.json({ ok: true });
});

// --- Tasks ---
app.get('/api/tasks', (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.sourceNoteId) filter.sourceNoteId = Number(req.query.sourceNoteId);
  res.json(db.listTasks(Object.keys(filter).length ? filter : undefined));
});

app.get('/api/tasks/:id', (req, res) => {
  const task = db.getTask(Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(task);
});

app.post('/api/tasks', (req, res) => {
  const task = db.createTask(req.body);
  res.json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  db.updateTask(Number(req.params.id), req.body);
  res.json({ ok: true });
});

app.delete('/api/tasks/:id', (req, res) => {
  db.deleteTask(Number(req.params.id));
  res.json({ ok: true });
});

// --- Folders ---
app.get('/api/folders', (_req, res) => {
  res.json(db.listFolders());
});

app.post('/api/folders', (req, res) => {
  const folder = db.createFolder(req.body);
  res.json(folder);
});

// --- Config ---
app.get('/api/config/api-key', (_req, res) => {
  res.json({ key: apiKey });
});

app.put('/api/config/api-key', (req, res) => {
  apiKey = req.body.key || '';
  res.json({ ok: true });
});

// --- AI Extraction ---
app.post('/api/ai/extract', async (req, res) => {
  if (!apiKey) return res.status(400).json({ error: 'API key not set' });
  try {
    const { noteContent, noteTitle, existingTaskTitles } = req.body;
    const tasks = await extractTasks(apiKey, noteContent, noteTitle, existingTaskTitles || []);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Calendar ---
app.get('/api/calendar/events', (req, res) => {
  const daysAhead = req.query.daysAhead ? Number(req.query.daysAhead) : 7;
  res.json(fetchCalendarEvents(daysAhead));
});

app.get('/api/calendar/free-slots', (req, res) => {
  const { date, workStart, workEnd } = req.query;
  const events = fetchCalendarEvents(7);
  const slots = findFreeSlots(events, date, Number(workStart), Number(workEnd));
  res.json(slots);
});

// --- Static files (production) ---
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Noto server running at http://localhost:${PORT}`);
});
