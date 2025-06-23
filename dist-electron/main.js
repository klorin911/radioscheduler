import { app, BrowserWindow } from "electron";
import path from "path";
const filterConsole = () => {
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => {
    var _a;
    const message = ((_a = args[0]) == null ? void 0 : _a.toString()) || "";
    if (!message.includes("Autofill.") && !message.includes("SharedImageManager")) {
      originalLog.apply(console, args);
    }
  };
  console.error = (...args) => {
    var _a;
    const message = ((_a = args[0]) == null ? void 0 : _a.toString()) || "";
    if (!message.includes("Autofill.") && !message.includes("SharedImageManager")) {
      originalError.apply(console, args);
    }
  };
};
filterConsole();
let mainWindow = null;
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  if (process.env.NODE_ENV === "development") {
    await mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
