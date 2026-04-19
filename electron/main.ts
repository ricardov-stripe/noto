import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { Database } from './database';
import { extractTasks } from './extraction';
import { fetchCalendarEvents, findFreeSlots } from './calendar';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

const db = new Database(path.join(app.getPath('userData'), 'noto.db'));

// Notes
ipcMain.handle('notes:list', (_, folderId?: number) => db.listNotes(folderId));
ipcMain.handle('notes:get', (_, id: number) => db.getNote(id));
ipcMain.handle('notes:create', (_, data) => db.createNote(data));
ipcMain.handle('notes:update', (_, id: number, data) => db.updateNote(id, data));
ipcMain.handle('notes:delete', (_, id: number) => db.deleteNote(id));

// Tasks
ipcMain.handle('tasks:list', (_, filter?) => db.listTasks(filter));
ipcMain.handle('tasks:get', (_, id: number) => db.getTask(id));
ipcMain.handle('tasks:create', (_, data) => db.createTask(data));
ipcMain.handle('tasks:update', (_, id: number, data) => db.updateTask(id, data));
ipcMain.handle('tasks:delete', (_, id: number) => db.deleteTask(id));

// Folders
ipcMain.handle('folders:list', () => db.listFolders());
ipcMain.handle('folders:create', (_, data) => db.createFolder(data));

// AI Extraction
let apiKey = '';

ipcMain.handle('config:setApiKey', (_, key: string) => { apiKey = key; });
ipcMain.handle('config:getApiKey', () => apiKey);

ipcMain.handle('ai:extract', async (_, noteContent: string, noteTitle: string, existingTaskTitles: string[]) => {
  if (!apiKey) throw new Error('API key not set');
  return extractTasks(apiKey, noteContent, noteTitle, existingTaskTitles);
});

// Calendar
ipcMain.handle('calendar:events', (_, daysAhead?: number) => fetchCalendarEvents(daysAhead));
ipcMain.handle('calendar:freeSlots', (_, date: string, workStart: number, workEnd: number) => {
  const events = fetchCalendarEvents(7);
  return findFreeSlots(events, date, workStart, workEnd);
});
