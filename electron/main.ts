import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { Dispatcher } from '../src/appTypes'
import type { Column, Day, Schedule, TimeSlot } from '../src/constants'
import type { DailyDetailDoc } from '../src/appStorage'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Ensure a stable app name so userData path is predictable
// In packaged builds electron-builder will also use productName
app.setName('Radio Scheduler')

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let currentMenu: Menu | null = null
let updateAvailable = false

const workbookTemplateFileName = 'Radio Week View Example.xlsm'
const exportDays: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const exportTimeSlots: TimeSlot[] = [
  '0330-0530',
  '0530-0730',
  '0730-0930',
  '0930-1130',
  '1130-1330',
  '1330-1530',
  '1530-1730',
  '1730-1930',
  '1930-2130',
  '2130-2330',
  '2330-0130',
  '0130-0330',
]
const exportColumns: Column[] = ['SW', 'CE', 'SE', 'NE', 'NW', 'MT', 'UT', 'RELIEF']
const workbookColumns: Record<Column, string> = {
  SW: 'B',
  CE: 'C',
  SE: 'D',
  NE: 'E',
  NW: 'F',
  MT: 'G',
  UT: 'H',
  RELIEF: 'I',
}
const dayStartRows: Record<Day, number> = {
  Monday: 6,
  Tuesday: 20,
  Wednesday: 34,
  Thursday: 48,
  Friday: 71,
  Saturday: 85,
  Sunday: 99,
}
const detailSheetPaths: Record<Day, string> = {
  Monday: 'xl/worksheets/sheet2.xml',
  Tuesday: 'xl/worksheets/sheet6.xml',
  Wednesday: 'xl/worksheets/sheet10.xml',
  Thursday: 'xl/worksheets/sheet14.xml',
  Friday: 'xl/worksheets/sheet18.xml',
  Saturday: 'xl/worksheets/sheet22.xml',
  Sunday: 'xl/worksheets/sheet26.xml',
}
const detailColumns: Column[] = ['SW', 'CE', 'SE', 'NE', 'NW', 'MT', 'UT']

type WorkbookExportPayload = {
  title: string
  schedule: Schedule
  dailyDetails?: Partial<Record<Day, DailyDetailDoc>>
}

type WorkbookExportResult = {
  success: boolean
  canceled?: boolean
  filePath?: string
  error?: string
}

function getWorkbookTemplatePath() {
  const devPath = process.env.APP_ROOT
    ? path.join(process.env.APP_ROOT, 'electron', 'resources', workbookTemplateFileName)
    : ''
  if (devPath && fs.existsSync(devPath)) return devPath
  return path.join(process.resourcesPath, workbookTemplateFileName)
}

function escapeXmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function cellXml(ref: string, existingCell: string, value: string) {
  const styleMatch = existingCell.match(/\ss="[^"]*"/)
  const style = styleMatch ? styleMatch[0] : ''
  if (!value) return `<c r="${ref}"${style}/>`

  const preserveSpace = /^\s|\s$/.test(value) ? ' xml:space="preserve"' : ''
  return `<c r="${ref}"${style} t="inlineStr"><is><t${preserveSpace}>${escapeXmlText(value)}</t></is></c>`
}

function columnNumber(column: string) {
  return column.split('').reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0)
}

function createCellInExistingRow(sheetXml: string, ref: string, value: string) {
  const match = ref.match(/^([A-Z]+)(\d+)$/)
  if (!match) return sheetXml
  const [, column, row] = match
  const rowPattern = new RegExp(`<row\\b(?=[^>]*\\br="${row}")[^>]*>[\\s\\S]*?<\\/row>`)
  const rowXml = sheetXml.match(rowPattern)?.[0]
  if (!rowXml) return sheetXml

  const fallbackCell = rowXml.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/)?.[0] ?? `<c r="${ref}"/>`
  const newCell = cellXml(ref, fallbackCell.replace(/\br="[^"]*"/, `r="${ref}"`), value)
  const targetColumn = columnNumber(column)
  const cells = [...rowXml.matchAll(/<c\b(?=[^>]*\br="([A-Z]+)\d+")[^>]*\/>|<c\b(?=[^>]*\br="([A-Z]+)\d+")[^>]*>[\s\S]*?<\/c>/g)]
  const insertBefore = cells.find((cell) => columnNumber(cell[1] || cell[2]) > targetColumn)
  const nextRowXml = insertBefore
    ? rowXml.replace(insertBefore[0], `${newCell}${insertBefore[0]}`)
    : rowXml.replace('</row>', `${newCell}</row>`)

  return sheetXml.replace(rowPattern, nextRowXml)
}

function replaceCell(sheetXml: string, ref: string, value: string) {
  const pattern = new RegExp(
    `<c\\b(?=[^>]*\\br="${ref}")[^>]*\\/>|<c\\b(?=[^>]*\\br="${ref}")[^>]*>[\\s\\S]*?<\\/c>`
  )
  const existing = sheetXml.match(pattern)?.[0]
  if (!existing) {
    return createCellInExistingRow(sheetXml, ref, value)
  }
  return sheetXml.replace(pattern, cellXml(ref, existing, value))
}

function fillRange(
  sheetXml: string,
  startColumnCode: number,
  startRow: number,
  rowCount: number,
  columnCount: number,
  getValue: (rowIndex: number, columnIndex: number) => string
) {
  let nextXml = sheetXml
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const ref = `${String.fromCharCode(startColumnCode + columnIndex)}${startRow + rowIndex}`
      nextXml = replaceCell(nextXml, ref, getValue(rowIndex, columnIndex) ?? '')
    }
  }
  return nextXml
}

function scheduleDetailDoc(day: Day, schedule: Schedule): DailyDetailDoc {
  return {
    grid: {
      headers: [day, ...detailColumns],
      rows: exportTimeSlots.map((slot) => [
        slot,
        ...detailColumns.map((column) => schedule?.[day]?.[slot]?.[column] ?? ''),
      ]),
    },
    rosters: { headers: ['A SHIFT', 'B SHIFT', 'C SHIFT', 'E SHIFT', 'F SHIFT'], rows: [] },
    stabilizer: {
      headers: ['STABILIZER', '', ''],
      rows: ['0730', '0930', '1130', '1330', '1530', '1730', '1930', '2130', '2330', '0130'].map((time) => [time, '', '']),
    },
    relief: {
      headers: ['RELIEF', ''],
      rows: ['1530', '1730', '1930', '2130', '2330', '0130'].map((time) => [time, '']),
    },
    teletype: {
      headers: ['TELETYPE', ''],
      rows: ['0130-0330', '0330-0530', '0530-0730'].map((time) => [time, '']),
    },
  }
}

function fillDetailSheet(sheetXml: string, day: Day, detail: DailyDetailDoc) {
  const gridHeaders = detail.grid?.headers?.length ? detail.grid.headers : [day, ...detailColumns]
  let nextXml = fillRange(sheetXml, 65, 1, 1, 8, (_row, columnIndex) => gridHeaders[columnIndex] ?? '')
  nextXml = fillRange(nextXml, 65, 2, 12, 8, (rowIndex, columnIndex) => {
    if (columnIndex === 0) return detail.grid?.rows?.[rowIndex]?.[0] ?? exportTimeSlots[rowIndex] ?? ''
    return detail.grid?.rows?.[rowIndex]?.[columnIndex] ?? ''
  })

  nextXml = fillRange(nextXml, 65, 14, 1, 5, (_row, columnIndex) => detail.rosters?.headers?.[columnIndex] ?? '')
  nextXml = fillRange(nextXml, 65, 15, 39, 5, (rowIndex, columnIndex) => (
    detail.rosters?.rows?.[rowIndex]?.[columnIndex] ?? ''
  ))

  nextXml = replaceCell(nextXml, 'G18', detail.stabilizer?.headers?.[0] || 'STABILIZER')
  nextXml = replaceCell(nextXml, 'H18', '')
  nextXml = fillRange(nextXml, 70, 19, 10, 3, (rowIndex, columnIndex) => (
    detail.stabilizer?.rows?.[rowIndex]?.[columnIndex] ?? ''
  ))

  nextXml = replaceCell(nextXml, 'G29', detail.relief?.headers?.[0] || 'RELIEF')
  nextXml = replaceCell(nextXml, 'H29', '')
  nextXml = fillRange(nextXml, 71, 30, 6, 2, (rowIndex, columnIndex) => (
    detail.relief?.rows?.[rowIndex]?.[columnIndex] ?? ''
  ))

  nextXml = replaceCell(nextXml, 'G37', detail.teletype?.headers?.[0] || 'TELETYPE')
  nextXml = replaceCell(nextXml, 'H37', '')
  nextXml = fillRange(nextXml, 71, 38, 3, 2, (rowIndex, columnIndex) => (
    detail.teletype?.rows?.[rowIndex]?.[columnIndex] ?? ''
  ))

  return nextXml
}

function fillWorkbookTemplate(templatePath: string, payload: WorkbookExportPayload) {
  const workbookBytes = fs.readFileSync(templatePath)
  const workbook = unzipSync(new Uint8Array(workbookBytes))
  const masterSheetPath = 'xl/worksheets/sheet1.xml'
  const masterSheet = workbook[masterSheetPath]
  if (!masterSheet) {
    throw new Error(`Template is missing ${masterSheetPath}`)
  }
  if (!workbook['xl/vbaProject.bin']) {
    throw new Error('Template is missing xl/vbaProject.bin')
  }

  let sheetXml = strFromU8(masterSheet)
  sheetXml = replaceCell(sheetXml, 'D4', payload.title.trim())

  exportDays.forEach((day) => {
    const startRow = dayStartRows[day]
    exportTimeSlots.forEach((slot, slotIndex) => {
      const rowNumber = startRow + slotIndex
      exportColumns.forEach((column) => {
        const ref = `${workbookColumns[column]}${rowNumber}`
        const value = payload.schedule?.[day]?.[slot]?.[column] ?? ''
        sheetXml = replaceCell(sheetXml, ref, value)
      })
    })
  })

  workbook[masterSheetPath] = strToU8(sheetXml)

  exportDays.forEach((day) => {
    const sheetPath = detailSheetPaths[day]
    const detailSheet = workbook[sheetPath]
    if (!detailSheet) {
      throw new Error(`Template is missing ${sheetPath}`)
    }
    const detail = payload.dailyDetails?.[day] ?? scheduleDetailDoc(day, payload.schedule)
    workbook[sheetPath] = strToU8(fillDetailSheet(strFromU8(detailSheet), day, detail))
  })

  return zipSync(workbook, { level: 6 })
}

function safeWorkbookFileName(title: string) {
  const normalizedTitle = title.trim() || 'Radio Schedule'
  const cleaned = normalizedTitle.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/\s+/g, '-')
  return `${cleaned || 'Radio-Schedule'}.xlsm`
}

function updateMenu() {
  createMenu()
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Radio Scheduler',
      submenu: [
        {
          label: 'About Radio Scheduler',
          role: 'about'
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: async () => {
            try {
              await autoUpdater.checkForUpdates()
            } catch (error) {
              console.error('Error checking for updates:', error)
            }
          }
        },
        {
          label: 'Install Update',
          enabled: updateAvailable,
          click: () => {
            autoUpdater.quitAndInstall()
          }
        },
        { type: 'separator' },
        {
          label: 'Hide Radio Scheduler',
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideOthers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit()
          }
        }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Export',
          accelerator: 'Command+E',
          click: () => {
            win?.webContents.send('menu:export-workbook')
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: 'Toggle Developer Tools', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Actual Size', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', accelerator: 'Ctrl+Command+F', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: 'Close', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            win?.webContents.send('menu:about')
          }
        }
      ]
    }
  ]

  currentMenu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(currentMenu)
}

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

function setupAutoUpdater() {
  // Configure updater behavior
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const send = (channel: string, payload?: unknown) => {
    try {
      win?.webContents.send(channel, payload)
    } catch {
      // noop: window may be closed between events
    }
  }

  autoUpdater.on('checking-for-update', () => send('updater:status', { status: 'checking' }))
  autoUpdater.on('update-available', (info) => {
    updateAvailable = false // Not ready to install yet
    updateMenu()
    send('updater:status', { status: 'available', info })
  })
  autoUpdater.on('update-not-available', (info) => {
    updateAvailable = false
    updateMenu()
    send('updater:status', { status: 'not-available', info })
  })
  autoUpdater.on('download-progress', (progress) => send('updater:progress', progress))
  autoUpdater.on('error', (error) => {
    updateAvailable = false
    updateMenu()
    send('updater:status', { status: 'error', error: String(error) })
  })
  autoUpdater.on('update-downloaded', (info) => {
    updateAvailable = true // Now ready to install
    updateMenu()
    send('updater:status', { status: 'downloaded', info })
    // You may prompt user on renderer side, then call 'updater:install'
  })

  // IPC handlers to control updates from renderer
  ipcMain.handle('updater:check', async () => {
    await autoUpdater.checkForUpdates()
    return true
  })

  ipcMain.handle('updater:install', async () => {
    autoUpdater.quitAndInstall()
    return true
  })

  // Menu IPC handlers
  ipcMain.on('menu:export-workbook', () => {
    win?.webContents.send('menu:export-workbook')
  })

  ipcMain.on('menu:export-csv', () => {
    win?.webContents.send('menu:export-csv')
  })

  ipcMain.on('menu:export-pdf', () => {
    win?.webContents.send('menu:export-pdf')
  })
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
// Use per-user data directory for read/write in packaged apps
const getUserDataFilePath = () => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'dispatchers.json')
}

// Resolve a bundled default file path to seed user data on first run
// In dev: project root dispatchers.json
// In prod: process.resourcesPath/dispatchers.json (from electron-builder extraResources)
const getBundledDefaultFilePath = () => {
  const devRoot = process.env.APP_ROOT ? path.join(process.env.APP_ROOT, 'dispatchers.json') : ''
  if (devRoot && fs.existsSync(devRoot)) return devRoot
  return path.join(process.resourcesPath, 'dispatchers.json')
}

// Helper to ensure file exists
function ensureDispatchersFileExists() {
  const filePath = getUserDataFilePath()
  if (!fs.existsSync(filePath)) {
    const dirPath = path.dirname(filePath)
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    const seedPath = getBundledDefaultFilePath()
    if (fs.existsSync(seedPath)) {
      console.log('Seeding dispatchers.json from:', seedPath)
      fs.copyFileSync(seedPath, filePath)
    } else {
      console.log('Creating new dispatchers.json file with empty array at:', filePath)
      fs.writeFileSync(filePath, JSON.stringify([]))
    }
  }
}

ipcMain.handle('get-dispatchers', async () => {
  try {
    ensureDispatchersFileExists()
    const filePath = getUserDataFilePath()
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

ipcMain.handle('save-dispatchers', async (_: unknown, dispatchers: Dispatcher[]) => {
  try {
    const filePath = getUserDataFilePath()
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

ipcMain.handle('export-week-workbook', async (_: unknown, payload: WorkbookExportPayload): Promise<WorkbookExportResult> => {
  try {
    if (!payload?.schedule) {
      throw new Error('No schedule was provided for export')
    }

    const templatePath = getWorkbookTemplatePath()
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Workbook template was not found at ${templatePath}`)
    }

    const saveDialogOptions = {
      title: 'Export Radio Schedule',
      defaultPath: path.join(app.getPath('documents'), safeWorkbookFileName(payload.title)),
      filters: [
        { name: 'Excel Macro-Enabled Workbook', extensions: ['xlsm'] },
      ],
    }
    const result = win
      ? await dialog.showSaveDialog(win, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions)

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    const outputPath = result.filePath.toLowerCase().endsWith('.xlsm')
      ? result.filePath
      : `${result.filePath}.xlsm`
    const exportedWorkbook = fillWorkbookTemplate(templatePath, payload)
    fs.writeFileSync(outputPath, exportedWorkbook)

    return { success: true, filePath: outputPath }
  } catch (error) {
    console.error('Error exporting week workbook:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
})

app.whenReady().then(() => {
  createMenu()
  createWindow()
  setupAutoUpdater()
  // Only check in packaged builds to avoid dev spam
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify()
  }
})
