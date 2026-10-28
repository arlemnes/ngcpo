const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readExcelFromNetwork: (filePath) => ipcRenderer.invoke('read-excel-network-path', filePath),
  writeExcelToNetwork: (filePath, buffer) => ipcRenderer.invoke('write-excel-network-path', filePath, buffer),
  selectExcelDialog: () => ipcRenderer.invoke('select-excel-dialog'),
  isElectron: true,
});
