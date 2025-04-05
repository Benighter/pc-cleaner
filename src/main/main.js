const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const readFile = promisify(fs.readFile);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow = null;
// Track active scan operation for cancellation
let scanCancelled = false;
let isScanning = false;
let totalFilesFound = 0;
let filesProcessed = 0;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the html file
  mainWindow.loadFile(path.join(__dirname, '../../public/index.html'));

  // Open the DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle folder selection
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (result.canceled) {
    return null;
  }
  
  return result.filePaths[0];
});

// Cancel current scan operation
ipcMain.handle('cancel-scan', async () => {
  if (isScanning) {
    scanCancelled = true;
    return { success: true };
  }
  return { success: false, message: 'No scan in progress' };
});

// Scan folder for old/unused files with progress tracking
ipcMain.handle('scan-folder', async (event, folderPath, oldThresholdDays) => {
  // Reset scan state
  scanCancelled = false;
  isScanning = true;
  totalFilesFound = 0;
  filesProcessed = 0;
  
  const files = [];
  const batchSize = 500; // Process files in batches to prevent memory issues
  const now = new Date();
  const oldThreshold = now.getTime() - (oldThresholdDays * 24 * 60 * 60 * 1000);
  
  // First pass: count total files (async)
  try {
    await countFiles(folderPath);
    
    // Send initial progress
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan-progress', {
        processed: 0,
        total: totalFilesFound,
        percent: 0
      });
    }
  } catch (err) {
    console.error('Error counting files:', err);
  }
  
  // Function to count total files
  async function countFiles(dirPath) {
    if (scanCancelled) return;
    
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (scanCancelled) return;
        
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip system directories
          if (entry.name !== '$RECYCLE.BIN' && entry.name !== 'System Volume Information') {
            try {
              await countFiles(fullPath);
            } catch (err) {
              console.error(`Error scanning directory ${fullPath}:`, err);
            }
          }
        } else {
          totalFilesFound++;
        }
      }
    } catch (err) {
      console.error(`Error reading directory ${dirPath}:`, err);
    }
  }
  
  // Function to recursively scan directories
  async function scanDir(dirPath) {
    if (scanCancelled) return;
    
    const entries = await readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (scanCancelled) return;
      
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip system directories
        if (entry.name !== '$RECYCLE.BIN' && entry.name !== 'System Volume Information') {
          try {
            await scanDir(fullPath);
          } catch (err) {
            console.error(`Error scanning directory ${fullPath}:`, err);
          }
        }
      } else {
        try {
          const stats = await stat(fullPath);
          const fileInfo = {
            path: fullPath,
            name: entry.name,
            size: stats.size,
            lastAccessed: stats.atime,
            lastModified: stats.mtime,
            isOld: stats.atime.getTime() < oldThreshold
          };
          
          // Convert file size to readable format
          fileInfo.sizeFormatted = formatFileSize(stats.size);
          
          files.push(fileInfo);
          
          // Update progress
          filesProcessed++;
          if (filesProcessed % 50 === 0 && !scanCancelled && mainWindow && !mainWindow.isDestroyed()) {
            const percent = Math.min(Math.round((filesProcessed / totalFilesFound) * 100), 100);
            mainWindow.webContents.send('scan-progress', {
              processed: filesProcessed,
              total: totalFilesFound,
              percent
            });
          }
          
          // Process in batches to prevent memory issues with large folders
          if (files.length >= batchSize) {
            if (!scanCancelled && mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('scan-batch', files.slice());
            }
            files.length = 0; // Clear the array but keep the reference
          }
        } catch (err) {
          console.error(`Error getting file stats for ${fullPath}:`, err);
          filesProcessed++;
        }
      }
    }
  }
  
  try {
    await scanDir(folderPath);
    
    // Send final batch if there are remaining files
    if (files.length > 0 && !scanCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan-batch', files);
    }
    
    // Send completion event
    if (!scanCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan-complete', {
        success: true,
        totalFiles: totalFilesFound,
        cancelled: false
      });
    } else if (scanCancelled && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan-complete', {
        success: false,
        cancelled: true
      });
    }
    
    isScanning = false;
    // Return an empty array here, actual results are sent via IPC events
    return { success: true, totalFilesProcessed: filesProcessed };
  } catch (err) {
    console.error('Error scanning folder:', err);
    isScanning = false;
    throw err;
  }
});

// Delete selected files
ipcMain.handle('delete-files', async (event, filePaths) => {
  const results = [];
  
  for (const filePath of filePaths) {
    try {
      await unlink(filePath);
      results.push({ path: filePath, success: true });
    } catch (err) {
      console.error(`Error deleting file ${filePath}:`, err);
      results.push({ path: filePath, success: false, error: err.message });
    }
  }
  
  return results;
});

// Handle open file with default application
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    shell.openPath(filePath);
    return { success: true };
  } catch (err) {
    console.error(`Error opening file ${filePath}:`, err);
    return { success: false, error: err.message };
  }
});

// Get file preview data
ipcMain.handle('get-file-preview', async (event, filePath) => {
  try {
    const stats = await stat(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();
    
    // Get MIME type based on extension
    const mimeType = getMimeType(fileExtension);
    const fileType = getFileType(fileExtension);
    
    // For images, videos, and audio, return a data URL
    if (fileType === 'image' || fileType === 'video' || fileType === 'audio') {
      // For large files, don't try to load the entire file
      if (stats.size > 10 * 1024 * 1024) { // 10MB limit
        return {
          type: fileType,
          mimeType,
          path: filePath,
          tooLarge: true,
          size: stats.size
        };
      }
      
      // Read file as base64
      const data = await readFile(filePath);
      const base64Data = data.toString('base64');
      
      return {
        type: fileType,
        mimeType,
        dataUrl: `data:${mimeType};base64,${base64Data}`,
        path: filePath
      };
    }
    
    // For text files, return content
    if (fileType === 'text') {
      // For large text files, limit content
      if (stats.size > 100 * 1024) { // 100KB limit for text
        return {
          type: 'text',
          mimeType,
          path: filePath,
          tooLarge: true,
          size: stats.size
        };
      }
      
      const content = await readFile(filePath, 'utf8');
      return {
        type: 'text',
        mimeType,
        content,
        path: filePath
      };
    }
    
    // For other file types
    return {
      type: 'other',
      mimeType,
      path: filePath,
      size: stats.size
    };
  } catch (err) {
    console.error(`Error getting preview for ${filePath}:`, err);
    return {
      type: 'error',
      error: err.message,
      path: filePath
    };
  }
});

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to determine MIME type from extension
function getMimeType(extension) {
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.wmv': 'video/x-ms-wmv',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.txt': 'text/plain',
    '.js': 'text/javascript',
    '.html': 'text/html',
    '.css': 'text/css',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

// Helper function to determine file type from extension
function getFileType(extension) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.mkv'];
  const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
  const textExtensions = ['.txt', '.js', '.html', '.css', '.json', '.md', '.log', '.csv'];
  
  if (imageExtensions.includes(extension)) return 'image';
  if (videoExtensions.includes(extension)) return 'video';
  if (audioExtensions.includes(extension)) return 'audio';
  if (textExtensions.includes(extension)) return 'text';
  
  return 'other';
} 