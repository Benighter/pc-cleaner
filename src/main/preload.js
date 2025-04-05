const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  fileSystem: {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    scanFolder: (folderPath, oldThresholdDays) => 
      ipcRenderer.invoke('scan-folder', folderPath, oldThresholdDays),
    deleteFiles: (filePaths) => ipcRenderer.invoke('delete-files', filePaths),
    getFilePreview: (filePath) => ipcRenderer.invoke('get-file-preview', filePath),
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath)
  }
}); 