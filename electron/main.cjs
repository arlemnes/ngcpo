const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'REC - Gestor de Contratos Públicos',
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: path.join(__dirname, '../public/icon.svg'),
  });

  // Load from local build or dev server
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handler to read Excel directly from Windows shared folder path
ipcMain.handle('read-excel-network-path', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Ficheiro não encontrado no servidor' };
    }
    const buffer = fs.readFileSync(filePath);
    return { success: true, data: buffer };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC handler to write Excel directly to Windows shared folder path
ipcMain.handle('write-excel-network-path', async (event, filePath, buffer) => {
  try {
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC handler to open file picker for network path
ipcMain.handle('select-excel-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar Ficheiro Excel de Contratos no Servidor',
    properties: ['openFile'],
    filters: [
      { name: 'Folha de Cálculo Excel', extensions: ['xlsx', 'xls'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});
