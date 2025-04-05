// App component
function App() {
  const [selectedFolder, setSelectedFolder] = React.useState('');
  const [files, setFiles] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const [selectAll, setSelectAll] = React.useState(false);
  const [thresholdDays, setThresholdDays] = React.useState(30);
  const [stats, setStats] = React.useState({
    totalFiles: 0,
    totalSize: 0,
    oldFiles: 0,
    oldFilesSize: 0
  });
  
  // Preview state
  const [previewFile, setPreviewFile] = React.useState(null);
  const [previewData, setPreviewData] = React.useState(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

  // Handle folder selection
  const handleSelectFolder = async () => {
    const folderPath = await window.electron.fileSystem.selectFolder();
    if (folderPath) {
      setSelectedFolder(folderPath);
      setFiles([]);
      setSelectedFiles([]);
      setPreviewFile(null);
      setPreviewData(null);
    }
  };

  // Scan the selected folder
  const handleScanFolder = async () => {
    if (!selectedFolder) return;
    
    setLoading(true);
    setFiles([]);
    setSelectedFiles([]);
    setPreviewFile(null);
    setPreviewData(null);
    
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
      
      // If the preview file was deleted, clear the preview
      if (previewFile && deletedPaths.includes(previewFile.path)) {
        setPreviewFile(null);
        setPreviewData(null);
      }
      
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
  
  // Handle file preview
  const handlePreviewFile = async (file) => {
    if (previewFile && previewFile.path === file.path) {
      return; // Already previewing this file
    }
    
    setPreviewFile(file);
    setPreviewData(null);
    setPreviewLoading(true);
    
    try {
      const data = await window.electron.fileSystem.getFilePreview(file.path);
      setPreviewData(data);
    } catch (error) {
      console.error('Error getting file preview:', error);
      setPreviewData({ 
        type: 'error', 
        error: 'Failed to load preview',
        path: file.path
      });
    } finally {
      setPreviewLoading(false);
    }
  };
  
  // Handle opening file with default app
  const handleOpenFile = async (filePath) => {
    try {
      await window.electron.fileSystem.openFile(filePath);
    } catch (error) {
      console.error('Error opening file:', error);
      alert('Failed to open file: ' + error.message);
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
  
  // Get file icon based on type
  const getFileTypeIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'wmv', 'mkv'];
    const audioExtensions = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac'];
    const docExtensions = ['doc', 'docx', 'pdf', 'txt', 'rtf'];
    
    if (imageExtensions.includes(extension)) return '🖼️';
    if (videoExtensions.includes(extension)) return '🎬';
    if (audioExtensions.includes(extension)) return '🎵';
    if (docExtensions.includes(extension)) return '📄';
    
    return '📁';
  };
  
  // Render preview content based on file type
  const renderPreviewContent = () => {
    if (!previewData) return null;
    
    if (previewLoading) {
      return React.createElement(
        'div',
        { className: 'preview-loading' },
        React.createElement('div', { className: 'loading-spinner' })
      );
    }
    
    if (previewData.type === 'error') {
      return React.createElement(
        'div',
        { className: 'preview-error' },
        'Error: ' + previewData.error
      );
    }
    
    if (previewData.tooLarge) {
      return React.createElement(
        'div',
        { className: 'preview-large-file' },
        `This file is too large to preview (${formatFileSize(previewData.size)})`,
        React.createElement('br'),
        React.createElement(
          'button',
          { 
            onClick: () => handleOpenFile(previewData.path),
            style: { marginTop: '10px' }
          },
          'Open with default app'
        )
      );
    }
    
    switch (previewData.type) {
      case 'image':
        return React.createElement(
          'img',
          {
            className: 'preview-image',
            src: previewData.dataUrl,
            alt: 'Preview'
          }
        );
        
      case 'video':
        return React.createElement(
          'video',
          {
            className: 'preview-video',
            src: previewData.dataUrl,
            controls: true,
            autoPlay: false
          }
        );
        
      case 'audio':
        return React.createElement(
          'audio',
          {
            className: 'preview-audio',
            src: previewData.dataUrl,
            controls: true,
            autoPlay: false
          }
        );
        
      case 'text':
        return React.createElement(
          'pre',
          { className: 'preview-text' },
          previewData.content
        );
        
      default:
        return React.createElement(
          'div',
          { className: 'preview-unsupported' },
          'Preview not available for this file type',
          React.createElement('br'),
          React.createElement(
            'button',
            { 
              onClick: () => handleOpenFile(previewData.path),
              style: { marginTop: '10px' }
            },
            'Open with default app'
          )
        );
    }
  };

  return React.createElement(
    'div',
    { className: 'container app-layout' },
    React.createElement(
      'header',
      { className: 'app-header' },
      React.createElement('h1', { className: 'app-title' }, 'PC Cleaner')
    ),
    
    React.createElement(
      'div',
      { className: 'control-panel' },
      React.createElement(
        'div',
        { className: 'folder-path' },
        React.createElement('span', { className: 'folder-path-text' }, selectedFolder || 'No folder selected')
      ),
      React.createElement('button', { onClick: handleSelectFolder }, 'Select Folder'),
      
      React.createElement(
        'div',
        { className: 'threshold-selector' },
        React.createElement('label', null, 'Unused for:'),
        React.createElement(
          'select',
          { 
            value: thresholdDays,
            onChange: (e) => setThresholdDays(Number(e.target.value))
          },
          React.createElement('option', { value: '7' }, '7 days'),
          React.createElement('option', { value: '30' }, '30 days'),
          React.createElement('option', { value: '90' }, '90 days'),
          React.createElement('option', { value: '180' }, '180 days'),
          React.createElement('option', { value: '365' }, '1 year')
        )
      ),
      
      React.createElement(
        'button',
        {
          onClick: handleScanFolder,
          disabled: !selectedFolder || loading
        },
        'Scan Folder'
      ),
      
      React.createElement(
        'button',
        {
          className: 'delete-btn',
          onClick: handleDeleteFiles,
          disabled: selectedFiles.length === 0 || loading
        },
        'Delete Selected'
      )
    ),
    
    stats.totalFiles > 0 && React.createElement(
      'div',
      { className: 'summary' },
      React.createElement('h2', { className: 'summary-title' }, 'Scan Results'),
      React.createElement(
        'div',
        { className: 'summary-stats' },
        React.createElement(
          'div',
          { className: 'stat-card' },
          React.createElement('div', { className: 'stat-value' }, stats.totalFiles),
          React.createElement('div', { className: 'stat-label' }, 'Total Files')
        ),
        React.createElement(
          'div',
          { className: 'stat-card' },
          React.createElement('div', { className: 'stat-value' }, stats.totalSize),
          React.createElement('div', { className: 'stat-label' }, 'Total Size')
        ),
        React.createElement(
          'div',
          { className: 'stat-card' },
          React.createElement('div', { className: 'stat-value' }, stats.oldFiles),
          React.createElement('div', { className: 'stat-label' }, 'Unused Files')
        ),
        React.createElement(
          'div',
          { className: 'stat-card' },
          React.createElement('div', { className: 'stat-value' }, stats.oldFilesSize),
          React.createElement('div', { className: 'stat-label' }, 'Potential Savings')
        )
      )
    ),
    
    React.createElement(
      'div',
      { className: 'main-content' },
      React.createElement(
        'div',
        { className: 'files-panel' },
        React.createElement(
          'div',
          { className: 'file-list' },
          files.length > 0 && React.createElement(
            'div',
            { className: 'file-list-header' },
            React.createElement(
              'div',
              { className: 'checkbox-container' },
              React.createElement('input', {
                type: 'checkbox',
                checked: selectAll,
                onChange: handleSelectAll
              })
            ),
            React.createElement('div', null, 'Name'),
            React.createElement('div', null, 'Size'),
            React.createElement('div', null, 'Last Accessed'),
            React.createElement('div', null, 'Last Modified'),
            React.createElement('div', null, '')
          ),
          
          loading ? React.createElement(
            'div',
            { className: 'loading' },
            'Scanning folder...'
          ) : files.length === 0 && selectedFolder ? React.createElement(
            'div',
            { className: 'empty-state' },
            'No files found. Try scanning the folder.'
          ) : files.length === 0 ? React.createElement(
            'div',
            { className: 'empty-state' },
            'Select a folder to start scanning'
          ) : files.map((file) => React.createElement(
            'div',
            {
              key: file.path,
              className: `file-item ${file.isOld ? 'old' : ''} ${previewFile && previewFile.path === file.path ? 'selected' : ''}`,
              onClick: () => handlePreviewFile(file)
            },
            React.createElement(
              'div',
              { className: 'checkbox-container', onClick: (e) => e.stopPropagation() },
              React.createElement('input', {
                type: 'checkbox',
                checked: isFileSelected(file.path),
                onChange: () => handleSelectFile(file.path)
              })
            ),
            React.createElement(
              'div', 
              { className: 'file-name', title: file.name },
              getFileTypeIcon(file.name),
              ' ',
              file.name
            ),
            React.createElement('div', null, file.sizeFormatted),
            React.createElement('div', { className: 'file-date' }, formatDate(file.lastAccessed)),
            React.createElement('div', { className: 'file-date' }, formatDate(file.lastModified)),
            React.createElement(
              'div',
              { className: 'file-actions', onClick: (e) => e.stopPropagation() },
              React.createElement(
                'button',
                {
                  className: 'delete-btn',
                  onClick: (e) => {
                    e.stopPropagation();
                    setSelectedFiles([file.path]);
                    handleDeleteFiles();
                  }
                },
                'Delete'
              )
            )
          )),
          
          files.length > 0 && React.createElement(
            'div',
            { className: 'status-bar' },
            React.createElement(
              'div',
              null,
              `${selectedFiles.length} of ${files.length} files selected`
            ),
            React.createElement(
              'div',
              null,
              `${files.filter(f => f.isOld).length} unused files found`
            )
          )
        )
      ),
      
      // Preview Panel
      React.createElement(
        'div',
        { className: 'preview-panel' },
        previewFile ? React.createElement(
          React.Fragment,
          null,
          React.createElement(
            'div',
            { className: 'preview-header' },
            React.createElement('div', { className: 'preview-title' }, previewFile.name),
            React.createElement('div', { className: 'preview-info' }, `Size: ${previewFile.sizeFormatted}`),
            React.createElement('div', { className: 'preview-info' }, `Last accessed: ${formatDate(previewFile.lastAccessed)}`),
            React.createElement('div', { className: 'preview-info' }, `Last modified: ${formatDate(previewFile.lastModified)}`)
          ),
          React.createElement(
            'div',
            { className: 'preview-actions' },
            React.createElement(
              'button',
              { onClick: () => handleOpenFile(previewFile.path) },
              'Open File'
            ),
            React.createElement(
              'button',
              { 
                className: 'delete-btn',
                onClick: () => {
                  setSelectedFiles([previewFile.path]);
                  handleDeleteFiles();
                }
              },
              'Delete'
            )
          ),
          React.createElement(
            'div',
            { className: 'preview-content' },
            previewLoading ? React.createElement(
              'div',
              { className: 'preview-loading' },
              React.createElement('div', { className: 'loading-spinner' })
            ) : renderPreviewContent()
          )
        ) : React.createElement(
          'div',
          { className: 'preview-empty' },
          React.createElement('div', { className: 'preview-empty-icon' }, '👆'),
          React.createElement('div', null, 'Select a file to preview')
        )
      )
    )
  );
}

// Render the App component
ReactDOM.render(
  React.createElement(App),
  document.getElementById('root')
); 