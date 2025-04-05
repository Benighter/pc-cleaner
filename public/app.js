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
  
  // Progress state
  const [progress, setProgress] = React.useState({
    percent: 0,
    processed: 0,
    total: 0,
    status: ''
  });
  const [scanCancelled, setScanCancelled] = React.useState(false);
  
  // Folder navigation state
  const [folderStructure, setFolderStructure] = React.useState(null);
  const [currentFolder, setCurrentFolder] = React.useState(null);
  const [expandedFolders, setExpandedFolders] = React.useState({});
  const [filesInCurrentFolder, setFilesInCurrentFolder] = React.useState([]);
  const [breadcrumbs, setBreadcrumbs] = React.useState([]);

  // State for panel resizing
  const [isDragging, setIsDragging] = React.useState(false);
  const [startX, setStartX] = React.useState(0);
  const [folderTreeWidth, setFolderTreeWidth] = React.useState(250);
  const [previewPanelWidth, setPreviewPanelWidth] = React.useState(350);
  
  // References for panels
  const folderTreePanelRef = React.useRef(null);
  const previewPanelRef = React.useRef(null);
  const folderTreeHandleRef = React.useRef(null);
  const previewPanelHandleRef = React.useRef(null);

  // Register event listeners for scan progress and batches
  React.useEffect(() => {
    // Listen for progress updates
    window.electron.events.onScanProgress((data) => {
      setProgress({
        percent: data.percent,
        processed: data.processed,
        total: data.total,
        status: `Processing files: ${data.processed.toLocaleString()} of ${data.total.toLocaleString()}`
      });
    });
    
    // Listen for file batches
    window.electron.events.onScanBatch((batchFiles) => {
      setFiles(prevFiles => {
        // Merge with existing files, avoiding duplicates
        const newFiles = [...prevFiles];
        const existingPaths = new Set(prevFiles.map(f => f.path));
        
        batchFiles.forEach(file => {
          if (!existingPaths.has(file.path)) {
            newFiles.push(file);
          }
        });
        
        // Calculate updated stats
        updateStats(newFiles);
        
        // Update files in current folder if a folder is selected
        if (currentFolder) {
          updateFilesInCurrentFolder(currentFolder, newFiles);
        }
        
        return newFiles;
      });
    });
    
    // Listen for folder structure
    window.electron.events.onFolderStructure((structure) => {
      setFolderStructure(structure);
      // Automatically expand the root folder
      if (structure && structure.root) {
        setExpandedFolders(prev => ({
          ...prev,
          [structure.root.path]: true
        }));
        
        // Set current folder to root
        handleFolderSelect(structure.root);
      }
    });
    
    // Listen for scan completion
    window.electron.events.onScanComplete((result) => {
      setLoading(false);
      
      if (result.cancelled) {
        setScanCancelled(true);
        setProgress(prev => ({
          ...prev,
          status: 'Scan cancelled'
        }));
      } else {
        setProgress(prev => ({
          ...prev,
          percent: 100,
          status: 'Scan complete'
        }));
      }
    });
    
    // Cleanup function to remove event listeners
    return () => {
      window.electron.events.removeAllListeners('scan-progress');
      window.electron.events.removeAllListeners('scan-batch');
      window.electron.events.removeAllListeners('folder-structure');
      window.electron.events.removeAllListeners('scan-complete');
    };
  }, [currentFolder]);
  
  // Update stats based on files array
  const updateStats = (filesArray) => {
    const totalSize = filesArray.reduce((sum, file) => sum + file.size, 0);
    const oldFiles = filesArray.filter(file => file.isOld);
    const oldFilesSize = oldFiles.reduce((sum, file) => sum + file.size, 0);
    
    setStats({
      totalFiles: filesArray.length,
      totalSize: formatFileSize(totalSize),
      oldFiles: oldFiles.length,
      oldFilesSize: formatFileSize(oldFilesSize)
    });
  };
  
  // Update files shown based on selected folder
  const updateFilesInCurrentFolder = (folder, allFiles) => {
    if (!folder) return;
    
    // Filter files by the current folder
    const filesInFolder = allFiles.filter(file => {
      return file.parentDir === folder.path;
    });
    
    setFilesInCurrentFolder(filesInFolder);
  };
  
  // Handle folder selection from tree
  const handleFolderSelect = (folder) => {
    if (!folder) return;
    
    setCurrentFolder(folder);
    updateFilesInCurrentFolder(folder, files);
    
    // Build breadcrumbs
    const generateBreadcrumbs = (folderPath) => {
      if (!folderStructure || !folderStructure.root) return [];
      
      // If it's the root folder
      if (folderPath === folderStructure.root.path) {
        return [folderStructure.root];
      }
      
      // Handle nested folders
      const relativePath = folderPath.replace(folderStructure.root.path, '');
      const pathParts = relativePath.split(path.sep).filter(p => p);
      
      const breadcrumbs = [folderStructure.root];
      let currentPath = folderStructure.root.path;
      let currentFolderObj = folderStructure.root;
      
      for (const part of pathParts) {
        currentPath = path.join(currentPath, part);
        
        if (currentFolderObj.subFolders && currentFolderObj.subFolders[part]) {
          currentFolderObj = currentFolderObj.subFolders[part];
          breadcrumbs.push(currentFolderObj);
        } else {
          break;
        }
      }
      
      return breadcrumbs;
    };
    
    setBreadcrumbs(generateBreadcrumbs(folder.path));
  };
  
  // Toggle folder expansion in tree
  const toggleFolderExpansion = (folderPath, event) => {
    event.stopPropagation();
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  // Handle folder selection
  const handleSelectFolder = async () => {
    const folderPath = await window.electron.fileSystem.selectFolder();
    if (folderPath) {
      setSelectedFolder(folderPath);
      setFiles([]);
      setSelectedFiles([]);
      setPreviewFile(null);
      setPreviewData(null);
      setFolderStructure(null);
      setCurrentFolder(null);
      setFilesInCurrentFolder([]);
      setBreadcrumbs([]);
      // Reset progress state
      setProgress({
        percent: 0,
        processed: 0,
        total: 0,
        status: ''
      });
      setScanCancelled(false);
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
    setFolderStructure(null);
    setCurrentFolder(null);
    setFilesInCurrentFolder([]);
    setBreadcrumbs([]);
    setScanCancelled(false);
    
    setProgress({
      percent: 0,
      processed: 0,
      total: 0,
      status: 'Preparing scan...'
    });
    
    try {
      await window.electron.fileSystem.scanFolder(selectedFolder, thresholdDays);
      // Results will come through the event listeners
    } catch (error) {
      console.error('Error scanning folder:', error);
      alert('Error scanning folder: ' + error.message);
      setLoading(false);
    }
  };
  
  // Cancel the scanning process
  const handleCancelScan = async () => {
    try {
      const result = await window.electron.fileSystem.cancelScan();
      if (result.success) {
        setProgress(prev => ({
          ...prev,
          status: 'Cancelling scan...'
        }));
      }
    } catch (error) {
      console.error('Error cancelling scan:', error);
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
      setSelectedFiles(filesInCurrentFolder.map(file => file.path));
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
      
      // Update main files list
      const updatedFiles = files.filter(file => !deletedPaths.includes(file.path));
      setFiles(updatedFiles);
      
      // Update current folder files
      setFilesInCurrentFolder(prev => prev.filter(file => !deletedPaths.includes(file.path)));
      
      // Update selected files
      setSelectedFiles(prev => prev.filter(path => !deletedPaths.includes(path)));
      
      // Update stats
      updateStats(updatedFiles);
      
      // Update folder structure to remove deleted files
      if (folderStructure) {
        // This is a simplified approach - in a real app you'd need 
        // to recursively update the folder structure
        const updateFolderFiles = (folder) => {
          if (folder.files) {
            folder.files = folder.files.filter(file => !deletedPaths.includes(file.path));
          }
          
          if (folder.subFolders) {
            Object.values(folder.subFolders).forEach(subFolder => {
              updateFolderFiles(subFolder);
            });
          }
        };
        
        if (folderStructure.root) {
          updateFolderFiles(folderStructure.root);
          setFolderStructure({...folderStructure});
        }
      }
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
  
  // Render progress bar
  const renderProgressBar = () => {
    return React.createElement(
      'div',
      { className: 'progress-container' },
      React.createElement(
        'div',
        { 
          className: 'progress-bar',
          style: { width: `${progress.percent}%` }
        }
      ),
      React.createElement(
        'div',
        { className: 'progress-text' },
        `${progress.percent}%`
      )
    );
  };
  
  // Render folder tree
  const renderFolderTree = () => {
    if (!folderStructure || !folderStructure.root) {
      return React.createElement(
        'div',
        { className: 'empty-state' },
        'No folders to display. Scan a folder to see its structure.'
      );
    }
    
    // Recursive function to render folder and its children
    const renderFolder = (folder, level = 0) => {
      if (!folder) return null;
      
      const hasSubFolders = folder.subFolders && Object.keys(folder.subFolders).length > 0;
      const isExpanded = expandedFolders[folder.path] || false;
      const isSelected = currentFolder && currentFolder.path === folder.path;
      const oldFilesCount = folder.files ? folder.files.filter(f => f.isOld).length : 0;
      
      return React.createElement(
        'div',
        { key: folder.path, className: 'folder-tree-item' },
        React.createElement(
          'div',
          { 
            className: `folder-item ${isSelected ? 'selected' : ''}`,
            onClick: () => handleFolderSelect(folder)
          },
          hasSubFolders ? React.createElement(
            'span',
            { 
              className: `folder-toggle ${isExpanded ? 'expanded' : ''}`,
              onClick: (e) => toggleFolderExpansion(folder.path, e)
            },
            '▶'
          ) : React.createElement('span', { className: 'folder-toggle-placeholder', style: { width: '16px' } }),
          React.createElement(
            'div',
            { className: 'folder-item-content' },
            React.createElement('span', { className: 'folder-icon' }, '📁'),
            React.createElement('span', { className: 'folder-name' }, folder.name),
            React.createElement(
              'span',
              { className: 'folder-stats' },
              `${folder.files ? folder.files.length : 0} ${oldFilesCount > 0 ? `(${oldFilesCount} old)` : ''}`
            )
          )
        ),
        hasSubFolders && isExpanded && React.createElement(
          'div',
          { className: 'folder-children' },
          Object.values(folder.subFolders).map(subFolder => renderFolder(subFolder, level + 1))
        )
      );
    };
    
    return renderFolder(folderStructure.root);
  };
  
  // Render breadcrumb navigation
  const renderBreadcrumbs = () => {
    if (!breadcrumbs || breadcrumbs.length === 0) return null;
    
    return React.createElement(
      'div',
      { className: 'breadcrumb-nav' },
      breadcrumbs.map((folder, index) => [
        React.createElement(
          'span',
          { 
            key: folder.path,
            className: 'breadcrumb-item',
            onClick: () => handleFolderSelect(folder)
          },
          index === 0 ? 'Root' : folder.name
        ),
        index < breadcrumbs.length - 1 && React.createElement(
          'span',
          { key: `${folder.path}-separator`, className: 'breadcrumb-separator' },
          '/'
        )
      ].flat())
    );
  };

  // Handle folder tree panel resizing
  const handleFolderTreeDragStart = (e) => {
    setIsDragging(true);
    setStartX(e.clientX);
    document.body.style.cursor = 'col-resize';
    
    // Add dragging class to handle
    if (folderTreeHandleRef.current) {
      folderTreeHandleRef.current.classList.add('active');
    }
    
    // Add event listeners for mousemove and mouseup
    document.addEventListener('mousemove', handleFolderTreeDrag);
    document.addEventListener('mouseup', handleDragEnd);
  };
  
  const handleFolderTreeDrag = (e) => {
    if (!isDragging) return;
    
    const delta = e.clientX - startX;
    const newWidth = Math.max(150, Math.min(window.innerWidth * 0.4, folderTreeWidth + delta));
    
    if (folderTreePanelRef.current) {
      folderTreePanelRef.current.style.width = `${newWidth}px`;
    }
    
    setStartX(e.clientX);
    setFolderTreeWidth(newWidth);
  };
  
  // Handle preview panel resizing
  const handlePreviewPanelDragStart = (e) => {
    setIsDragging(true);
    setStartX(e.clientX);
    document.body.style.cursor = 'col-resize';
    
    // Add dragging class to handle
    if (previewPanelHandleRef.current) {
      previewPanelHandleRef.current.classList.add('active');
    }
    
    // Add event listeners for mousemove and mouseup
    document.addEventListener('mousemove', handlePreviewPanelDrag);
    document.addEventListener('mouseup', handleDragEnd);
  };
  
  const handlePreviewPanelDrag = (e) => {
    if (!isDragging) return;
    
    const delta = startX - e.clientX;
    const newWidth = Math.max(200, Math.min(window.innerWidth * 0.5, previewPanelWidth + delta));
    
    if (previewPanelRef.current) {
      previewPanelRef.current.style.width = `${newWidth}px`;
    }
    
    setStartX(e.clientX);
    setPreviewPanelWidth(newWidth);
  };
  
  // Common drag end handler
  const handleDragEnd = () => {
    setIsDragging(false);
    document.body.style.cursor = '';
    
    // Remove active class from handles
    if (folderTreeHandleRef.current) {
      folderTreeHandleRef.current.classList.remove('active');
    }
    
    if (previewPanelHandleRef.current) {
      previewPanelHandleRef.current.classList.remove('active');
    }
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleFolderTreeDrag);
    document.removeEventListener('mousemove', handlePreviewPanelDrag);
    document.removeEventListener('mouseup', handleDragEnd);
  };
  
  // Handle window resize
  React.useEffect(() => {
    const handleResize = () => {
      // Reset panel widths if they exceed window bounds
      const maxWidth = window.innerWidth * 0.9;
      
      if (folderTreeWidth + previewPanelWidth > maxWidth) {
        const newFolderTreeWidth = Math.min(folderTreeWidth, window.innerWidth * 0.3);
        const newPreviewPanelWidth = Math.min(previewPanelWidth, window.innerWidth * 0.3);
        
        setFolderTreeWidth(newFolderTreeWidth);
        setPreviewPanelWidth(newPreviewPanelWidth);
        
        if (folderTreePanelRef.current) {
          folderTreePanelRef.current.style.width = `${newFolderTreeWidth}px`;
        }
        
        if (previewPanelRef.current) {
          previewPanelRef.current.style.width = `${newPreviewPanelWidth}px`;
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [folderTreeWidth, previewPanelWidth]);

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
      React.createElement('button', { onClick: handleSelectFolder, disabled: loading }, 'Select Folder'),
      
      React.createElement(
        'div',
        { className: 'threshold-selector' },
        React.createElement('label', null, 'Unused for:'),
        React.createElement(
          'select',
          { 
            value: thresholdDays,
            onChange: (e) => setThresholdDays(Number(e.target.value)),
            disabled: loading
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
    
    // Progress bar and cancel button (only visible during scanning)
    loading && React.createElement(
      'div',
      { className: 'scanning-info' },
      React.createElement('div', { className: 'scanning-label' }, 'Scanning Folder'),
      React.createElement('div', { className: 'scanning-info-text' }, progress.status),
      renderProgressBar(),
      React.createElement(
        'div',
        { className: 'scan-status' },
        React.createElement(
          'div',
          null,
          progress.processed > 0 ? `Found ${files.length.toLocaleString()} files so far` : 'Counting files...'
        ),
        React.createElement(
          'button',
          { 
            className: 'cancel-btn',
            onClick: handleCancelScan,
            disabled: scanCancelled
          },
          scanCancelled ? 'Cancelling...' : 'Cancel Scan'
        )
      )
    ),
    
    !loading && stats.totalFiles > 0 && React.createElement(
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
      
      // Folder tree panel
      React.createElement(
        'div',
        { 
          className: 'folder-tree-panel',
          ref: folderTreePanelRef,
          style: { width: folderTreeWidth + 'px' }
        },
        React.createElement(
          'div',
          { className: 'folder-tree-header' },
          'Folders'
        ),
        React.createElement(
          'div',
          { className: 'folder-tree' },
          renderFolderTree()
        ),
        React.createElement(
          'div',
          { 
            className: 'panel-drag-handle folder-tree-handle',
            ref: folderTreeHandleRef,
            onMouseDown: handleFolderTreeDragStart 
          }
        )
      ),
      
      // Files panel container
      React.createElement(
        'div',
        { className: 'files-panel-container' },
        React.createElement(
          'div',
          { className: 'files-panel' },
          // Breadcrumb navigation
          currentFolder && renderBreadcrumbs(),
          
          React.createElement(
            'div',
            { className: 'file-list' },
            filesInCurrentFolder.length > 0 && React.createElement(
              'div',
              { className: 'file-list-header' },
              React.createElement(
                'div',
                { className: 'checkbox-container' },
                React.createElement('input', {
                  type: 'checkbox',
                  checked: selectAll,
                  onChange: handleSelectAll,
                  disabled: loading
                })
              ),
              React.createElement('div', null, 'Name'),
              React.createElement('div', null, 'Size'),
              React.createElement('div', null, 'Last Accessed'),
              React.createElement('div', null, 'Last Modified'),
              React.createElement('div', null, '')
            ),
            
            React.createElement(
              'div', 
              { className: 'files-scrollable' },
              loading ? React.createElement(
                'div',
                { className: 'loading with-progress' },
                scanCancelled ? 'Scan cancelled.' : null
              ) : filesInCurrentFolder.length === 0 && currentFolder ? React.createElement(
                'div',
                { className: 'empty-state' },
                'No files in this folder.'
              ) : !currentFolder ? React.createElement(
                'div',
                { className: 'empty-state' },
                'Select a folder to view its files'
              ) : filesInCurrentFolder.map((file) => React.createElement(
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
              ))
            ),
            
            !loading && filesInCurrentFolder.length > 0 && React.createElement(
              'div',
              { className: 'status-bar' },
              React.createElement(
                'div',
                null,
                `${selectedFiles.length} of ${filesInCurrentFolder.length} files selected`
              ),
              React.createElement(
                'div',
                null,
                `${filesInCurrentFolder.filter(f => f.isOld).length} unused files found in this folder`
              )
            )
          )
        )
      ),
      
      // Preview Panel
      React.createElement(
        'div',
        { 
          className: 'preview-panel',
          ref: previewPanelRef,
          style: { width: previewPanelWidth + 'px' }
        },
        React.createElement(
          'div',
          { 
            className: 'panel-drag-handle preview-panel-handle',
            ref: previewPanelHandleRef,
            onMouseDown: handlePreviewPanelDragStart 
          }
        ),
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

// Helper function for path manipulation
const path = {
  join: (...parts) => parts.join('/').replace(/\/+/g, '/'),
  sep: '/',
  basename: (path) => path.split('/').pop(),
  dirname: (path) => {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/') || '/';
  },
  relative: (from, to) => {
    // Simple implementation for relative path
    const fromParts = from.split('/').filter(Boolean);
    const toParts = to.split('/').filter(Boolean);
    
    let commonIndex = 0;
    while (commonIndex < fromParts.length && commonIndex < toParts.length && 
           fromParts[commonIndex] === toParts[commonIndex]) {
      commonIndex++;
    }
    
    const relativeParts = toParts.slice(commonIndex);
    return relativeParts.join('/') || '.';
  }
};

// Render the App component
ReactDOM.render(
  React.createElement(App),
  document.getElementById('root')
); 