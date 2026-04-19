import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('actionflow', {
  platform: process.platform,
});
