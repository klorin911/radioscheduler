import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/index.css'
import type { IpcRenderer, IpcRendererEvent } from 'electron';

declare global {
  interface Window {
    ipcRenderer: IpcRenderer;
  }
} // ensure ipcRenderer is always available via preload
 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Use contextBridge
if (window.ipcRenderer?.on) {
  window.ipcRenderer.on('main-process-message', (_event: IpcRendererEvent, message: unknown) => {
    console.log(message);
  });
}

