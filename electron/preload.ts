// Using CommonJS require so compiled preload.js is CJS-compatible
/* eslint-disable @typescript-eslint/no-var-requires */
const { ipcRenderer, contextBridge } = require('electron');

type IpcRendererEvent = Electron.IpcRendererEvent;
type IpcListener = (event: IpcRendererEvent, ...args: unknown[]) => void;

// Import types for proper typing
import type { Dispatcher } from '../src/types';



// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: IpcListener) {
    return ipcRenderer.on(channel, listener)
  },
  off(channel: string, listener: IpcListener) {
    return ipcRenderer.off(channel, listener)
  },
  send(channel: string, ...args: unknown[]) {
    return ipcRenderer.send(channel, ...args)
  },
  invoke(channel: string, ...args: unknown[]) {
    return ipcRenderer.invoke(channel, ...args)
  },

  // You can expose other APTs you need here.
  // ...
})

// Expose dispatcher file operations
contextBridge.exposeInMainWorld('dispatcherAPI', {
  getDispatchers: (): Promise<Dispatcher[]> => ipcRenderer.invoke('get-dispatchers'),
  saveDispatchers: (data: Dispatcher[]): Promise<boolean> => ipcRenderer.invoke('save-dispatchers', data),
})
