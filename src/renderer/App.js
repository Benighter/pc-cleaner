const { useState, useEffect } = React;

function App() {
  const [selectedFolder, setSelectedFolder] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [thresholdDays, setThresholdDays] = useState(30);
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalSize: 0,
    oldFiles: 0,
    oldFilesSize: 0
  });

  // Handle folder selection
  const handleSelectFolder = async () => {
    const folderPath = await window.electron.fileSystem.selectFolder();
    if (folderPath) {
      setSelectedFolder(folderPath);
      setFiles([]);
      setSelectedFiles([]);
    }
  };

  // Scan the selected folder
  const handleScanFolder = async () => {
    if (!selectedFolder) return;
    
    setLoading(true);
    setFiles([]);
    setSelectedFiles([]);
    
    try {
      const scannedFiles = await window.electron.fileSystem.scanFolder(selectedFolder, thresholdDays);
      setFiles(scannedFiles);
      
      // Calculate stats
      const totalSize = scannedFiles.reduce((sum, file) => sum + file.size, 0);
      const oldFiles = scannedFiles.filter(file => file.isOld);
      const oldFilesSize = oldFiles.reduce((sum, file) => sum + file.size, 0);
      
      setStats({
        totalFiles: scannedFiles.length,
        totalSize: formatFileSize(totalSize),
        oldFiles: oldFiles.length,
        oldFilesSize: formatFileSize(oldFilesSize)
      });
    } catch (error) {
      console.error('Error scanning folder:', error);
      alert('Error scanning folder: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection
  const handleSelectFile = (filePath) => {
    setSelectedFiles(prev => {
      if (prev.includes(filePath)) {
        return prev.filter(path => path !== filePath);
      } else {
        return [...prev, filePath];
      }
    });
  };

  // Handle select all files
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(file => file.path));
    }
    setSelectAll(!selectAll);
  };

  // Handle file deletion
  const handleDeleteFiles = async () => {
    if (selectedFiles.length === 0) return;
    
    const confirmation = confirm(`Are you sure you want to delete ${selectedFiles.length} files?`);
    if (!confirmation) return;
    
    setLoading(true);
    
    try {
      const results = await window.electron.fileSystem.deleteFiles(selectedFiles);
      
      const success = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      alert(`Deleted ${success} files successfully. ${failed} files failed to delete.`);
      
      // Remove deleted files from the list
      const deletedPaths = results
        .filter(r => r.success)
        .map(r => r.path);
      
      setFiles(prev => prev.filter(file => !deletedPaths.includes(file.path)));
      setSelectedFiles(prev => prev.filter(path => !deletedPaths.includes(path)));
      
      // Update stats
      const remainingFiles = files.filter(file => !deletedPaths.includes(file.path));
      const totalSize = remainingFiles.reduce((sum, file) => sum + file.size, 0);
      const oldFiles = remainingFiles.filter(file => file.isOld);
      const oldFilesSize = oldFiles.reduce((sum, file) => sum + file.size, 0);
      
      setStats({
        totalFiles: remainingFiles.length,
        totalSize: formatFileSize(totalSize),
        oldFiles: oldFiles.length,
        oldFilesSize: formatFileSize(oldFilesSize)
      });
    } catch (error) {
      console.error('Error deleting files:', error);
      alert('Error deleting files: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to format date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Helper function to format file size (fallback if the main process formatting fails)
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Check if a file is selected
  const isFileSelected = (filePath) => {
    return selectedFiles.includes(filePath);
  };

  return (
    <div className="container">
      <header className="app-header">
        <h1 className="app-title">PC Cleaner</h1>
      </header>
      
      <div className="control-panel">
        <div className="folder-path">
          <span className="folder-path-text">{selectedFolder || 'No folder selected'}</span>
        </div>
        <button onClick={handleSelectFolder}>Select Folder</button>
        
        <div className="threshold-selector">
          <label>Unused for:</label>
          <select 
            value={thresholdDays} 
            onChange={(e) => setThresholdDays(Number(e.target.value))}
          >
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="365">1 year</option>
          </select>
        </div>
        
        <button 
          onClick={handleScanFolder} 
          disabled={!selectedFolder || loading}
        >
          Scan Folder
        </button>
        
        <button 
          className="delete-btn"
          onClick={handleDeleteFiles} 
          disabled={selectedFiles.length === 0 || loading}
        >
          Delete Selected
        </button>
      </div>
      
      {stats.totalFiles > 0 && (
        <div className="summary">
          <h2 className="summary-title">Scan Results</h2>
          <div className="summary-stats">
            <div className="stat-card">
              <div className="stat-value">{stats.totalFiles}</div>
              <div className="stat-label">Total Files</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.totalSize}</div>
              <div className="stat-label">Total Size</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.oldFiles}</div>
              <div className="stat-label">Unused Files</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.oldFilesSize}</div>
              <div className="stat-label">Potential Savings</div>
            </div>
          </div>
        </div>
      )}
      
      <div className="file-list">
        {files.length > 0 && (
          <div className="file-list-header">
            <div className="checkbox-container">
              <input 
                type="checkbox" 
                checked={selectAll}
                onChange={handleSelectAll}
              />
            </div>
            <div>Name</div>
            <div>Size</div>
            <div>Last Accessed</div>
            <div>Last Modified</div>
            <div></div>
          </div>
        )}
        
        {loading ? (
          <div className="loading">Scanning folder...</div>
        ) : files.length === 0 && selectedFolder ? (
          <div className="empty-state">No files found. Try scanning the folder.</div>
        ) : files.length === 0 ? (
          <div className="empty-state">Select a folder to start scanning</div>
        ) : (
          files.map((file) => (
            <div 
              key={file.path} 
              className={`file-item ${file.isOld ? 'old' : ''}`}
            >
              <div className="checkbox-container">
                <input 
                  type="checkbox" 
                  checked={isFileSelected(file.path)}
                  onChange={() => handleSelectFile(file.path)}
                />
              </div>
              <div className="file-name" title={file.name}>{file.name}</div>
              <div>{file.sizeFormatted}</div>
              <div className="file-date">{formatDate(file.lastAccessed)}</div>
              <div className="file-date">{formatDate(file.lastModified)}</div>
              <div className="file-actions">
                <button 
                  className="delete-btn"
                  onClick={() => {
                    setSelectedFiles([file.path]);
                    handleDeleteFiles();
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      {files.length > 0 && (
        <div className="status-bar">
          <div>
            {selectedFiles.length} of {files.length} files selected
          </div>
          <div>
            {files.filter(f => f.isOld).length} unused files found
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 