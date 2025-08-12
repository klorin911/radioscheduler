// Electron preload runs in a CommonJS context. Use require() at runtime,
// but keep TypeScript types via type-only imports.
/* eslint-disable @typescript-eslint/no-require-imports */
import type { IpcRendererEvent } from 'electron';
const { contextBridge, ipcRenderer } = require('electron');

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

// Keep maps of wrapped listeners so we can remove the exact same fn reference later
const statusListenerMap = new Map<
  (payload: { status?: string; info?: unknown; error?: string }) => void,
  IpcListener
>();
const progressListenerMap = new Map<
  (progress: { percent?: number }) => void,
  IpcListener
>();

// Expose updater operations
contextBridge.exposeInMainWorld('updaterAPI', {
  check: (): Promise<boolean> => ipcRenderer.invoke('updater:check'),
  install: (): Promise<boolean> => ipcRenderer.invoke('updater:install'),
  onStatus: (listener: (payload: { status?: string; info?: unknown; error?: string }) => void) => {
    const wrapped: IpcListener = (_e: IpcRendererEvent, ...args: unknown[]) => {
      const payload = (args[0] ?? {}) as { status?: string; info?: unknown; error?: string }
      listener(payload)
    }
    statusListenerMap.set(listener, wrapped)
    ipcRenderer.on('updater:status', wrapped)
  },
  offStatus: (listener: (payload: { status?: string; info?: unknown; error?: string }) => void) => {
    const wrapped = statusListenerMap.get(listener)
    if (wrapped) {
      ipcRenderer.off('updater:status', wrapped)
      statusListenerMap.delete(listener)
    }
  },
  onProgress: (listener: (progress: { percent?: number }) => void) => {
    const wrapped: IpcListener = (_e: IpcRendererEvent, ...args: unknown[]) => {
      const progress = (args[0] ?? {}) as { percent?: number }
      listener(progress)
    }
    progressListenerMap.set(listener, wrapped)
    ipcRenderer.on('updater:progress', wrapped)
  },
  offProgress: (listener: (progress: { percent?: number }) => void) => {
    const wrapped = progressListenerMap.get(listener)
    if (wrapped) {
      ipcRenderer.off('updater:progress', wrapped)
      progressListenerMap.delete(listener)
    }
  },
})
