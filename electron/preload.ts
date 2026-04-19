import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('actionflow', {
  platform: process.platform,
  notes: {
    list: (folderId?: number) => ipcRenderer.invoke('notes:list', folderId),
    get: (id: number) => ipcRenderer.invoke('notes:get', id),
    create: (data: { title: string; content: string; folderId: number | null }) => ipcRenderer.invoke('notes:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('notes:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('notes:delete', id),
  },
  tasks: {
    list: (filter?: Record<string, unknown>) => ipcRenderer.invoke('tasks:list', filter),
    get: (id: number) => ipcRenderer.invoke('tasks:get', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('tasks:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('tasks:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('tasks:delete', id),
  },
  folders: {
    list: () => ipcRenderer.invoke('folders:list'),
    create: (data: { name: string; parentId: number | null }) => ipcRenderer.invoke('folders:create', data),
  },
  config: {
    setApiKey: (key: string) => ipcRenderer.invoke('config:setApiKey', key),
    getApiKey: () => ipcRenderer.invoke('config:getApiKey'),
  },
  ai: {
    extract: (noteContent: string, noteTitle: string, existingTaskTitles: string[]) =>
      ipcRenderer.invoke('ai:extract', noteContent, noteTitle, existingTaskTitles),
  },
  calendar: {
    events: (daysAhead?: number) => ipcRenderer.invoke('calendar:events', daysAhead),
    freeSlots: (date: string, workStart: number, workEnd: number) =>
      ipcRenderer.invoke('calendar:freeSlots', date, workStart, workEnd),
  },
});
