import { app, BrowserWindow } from 'electron';
import path from 'path';

// Filter out known DevTools warnings
const filterConsole = (): void => {
  const originalLog = console.log;
  const originalError = console.error;
  
  console.log = (...args: unknown[]): void => {
    const message = args[0]?.toString() || '';
    if (!message.includes('Autofill.') && !message.includes('SharedImageManager')) {
      originalLog.apply(console, args);
    }
  };
  
  console.error = (...args: unknown[]): void => {
    const message = args[0]?.toString() || '';
    if (!message.includes('Autofill.') && !message.includes('SharedImageManager')) {
      originalError.apply(console, args);
    }
  };
};

filterConsole();

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    await mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});