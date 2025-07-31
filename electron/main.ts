import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC handlers for dispatcher file operations
const getDispatchersFilePath = () => {
  // Use project directory (radioscheduler folder)
  const projectPath = path.join(__dirname, '..') // Go up from dist-electron to project root
  return path.join(projectPath, 'dispatchers.json')
}

// Helper to ensure file exists
function ensureDispatchersFileExists() {
  const filePath = getDispatchersFilePath()
  if (!fs.existsSync(filePath)) {
    const dirPath = path.dirname(filePath)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    console.log('Creating new dispatchers.json file with empty array')
    fs.writeFileSync(filePath, JSON.stringify([]))
  }
}

ipcMain.handle('get-dispatchers', async () => {
  try {
    ensureDispatchersFileExists()
    const filePath = getDispatchersFilePath()
    console.log('Loading dispatchers from:', filePath)
    
    const data = fs.readFileSync(filePath, 'utf-8')
    // console.log('File content:', data) // Removed to avoid console spam
    const parsed = JSON.parse(data)
    console.log('Loaded dispatchers:', parsed.length, 'items')
    return parsed
  } catch (error) {
    console.error('Error loading dispatchers:', error)
    return []
  }
})

ipcMain.handle('save-dispatchers', async (_, dispatchers) => {
  try {
    const filePath = getDispatchersFilePath()
    const dirPath = path.dirname(filePath)
    
    console.log('Saving dispatchers to:', filePath)
    console.log('Dispatchers to save:', dispatchers.length, 'items')
    console.log('Directory exists:', fs.existsSync(dirPath))
    
    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
      console.log('Creating directory:', dirPath)
      fs.mkdirSync(dirPath, { recursive: true })
    }
    
    const jsonContent = JSON.stringify(dispatchers, null, 2)
    // console.log('Writing content:', jsonContent) // Removed to avoid console spam
    fs.writeFileSync(filePath, jsonContent)
    
    // Verify the file was written
    if (fs.existsSync(filePath)) {
      const fileSize = fs.statSync(filePath).size
      console.log('File written successfully, size:', fileSize, 'bytes')
    }
    
    return true
  } catch (error) {
    console.error('Error saving dispatchers:', error)
    return false
  }
})

app.whenReady().then(createWindow)
