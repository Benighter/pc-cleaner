const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  fileSystem: {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    scanFolder: (folderPath, oldThresholdDays) => 
      ipcRenderer.invoke('scan-folder', folderPath, oldThresholdDays),
    cancelScan: () => ipcRenderer.invoke('cancel-scan'),
    deleteFiles: (filePaths) => ipcRenderer.invoke('delete-files', filePaths),
    getFilePreview: (filePath) => ipcRenderer.invoke('get-file-preview', filePath),
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath)
  },
  events: {
    onScanProgress: (callback) => {
      ipcRenderer.on('scan-progress', (event, data) => callback(data));
    },
    onScanBatch: (callback) => {
      ipcRenderer.on('scan-batch', (event, data) => callback(data));
    },
    onFolderStructure: (callback) => {
      ipcRenderer.on('folder-structure', (event, data) => callback(data));
    },
    onScanComplete: (callback) => {
      ipcRenderer.on('scan-complete', (event, data) => callback(data));
    },
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  }
}); 