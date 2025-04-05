# PC Cleaner

A desktop application that helps you identify and remove unused files that may be slowing down your PC. It scans selected folders to find files that haven't been accessed for a specified period and allows for easy cleanup with comprehensive file previewing capabilities.

## Author

**Bennet Nkolele**

- GitHub: [benighter](https://github.com/benighter)

## Features

### Core Functionality
- Select any folder on your PC to scan
- Configure time threshold to identify unused files (7 days to 1 year)
- View detailed information about each file (size, last accessed, last modified)
- One-click removal of individual files or batch deletion of selected files
- Summary statistics of scan results (total files, total size, unused files, potential space savings)

### Preview Capabilities
- Preview images, videos, and audio files directly in the application
- Read text files without opening external applications
- File type detection with appropriate icons
- Preview safeguards for large files to prevent performance issues
- "Open with default app" option for all file types

### User Interface
- Clean, intuitive interface with a two-panel layout
- Highlighted identification of old/unused files
- Detailed file information panel
- Responsive design that adapts to different screen sizes
- Interactive file selection with checkboxes for bulk operations

## Installation

### Prerequisites
- Node.js (v14 or newer)
- npm (v6 or newer)

### Setup
1. Clone this repository
```
git clone https://github.com/benighter/pc-cleaner.git
```

2. Navigate to the project directory
```
cd pc-cleaner
```

3. Install dependencies
```
npm install
```

### Running the Application
To start the application in development mode:
```
npm start
```

### Building for Production
To create a distributable package:
```
npm run build
```
The packaged application will be available in the `dist` directory.

## Usage Guide

### 1. Selecting a Folder to Scan
- Launch the application
- Click the "Select Folder" button to open the folder selection dialog
- Navigate to and select the folder you want to analyze
- The selected folder path will appear in the path display area

### 2. Configuring Scan Parameters
- Use the "Unused for" dropdown to select the time threshold (7 days, 30 days, 90 days, 180 days, or 1 year)
- Files that haven't been accessed for longer than this period will be flagged as unused

### 3. Scanning for Unused Files
- Click the "Scan Folder" button to begin analysis
- The application will recursively scan all files and subdirectories
- A loading indicator will display while scanning is in progress

### 4. Reviewing Scan Results
- Once scanning is complete, the application will display:
  - Summary statistics (total files, total size, unused files, potential savings)
  - A detailed list of all files with their information
  - Unused files are highlighted in light red for easy identification

### 5. Previewing Files
- Click on any file in the list to preview it in the right panel
- The preview panel will display:
  - For images: A thumbnail view of the image
  - For videos: A video player with controls
  - For audio: An audio player with controls
  - For text files: The text content with syntax highlighting
  - For other files: Basic file information

### 6. Managing Files
- Select individual files by checking their checkboxes
- Use the "Select All" checkbox in the header to select all files
- Click the "Delete Selected" button to remove multiple files at once
- Alternatively, use the individual "Delete" button next to each file
- A confirmation dialog will appear before deletion to prevent accidents

## Technical Details

### Architecture
PC Cleaner is built using Electron for the desktop framework, with React for the user interface. It uses a two-process architecture:

- **Main Process**: Handles file system operations, window management, and IPC communication
- **Renderer Process**: Manages the user interface and user interactions

### Key Technologies
- **Electron**: Desktop application framework
- **React**: User interface library
- **Node.js**: Backend runtime for file system operations
- **IPC (Inter-Process Communication)**: For secure communication between processes

### File Structure
```
pc-cleaner/
├── src/
│   ├── main/           # Electron main process code
│   │   ├── main.js     # Main application entry point
│   │   └── preload.js  # Preload script for secure IPC
│   └── renderer/       # React components
├── public/             # Static assets and HTML entry
│   ├── index.html      # HTML template
│   ├── styles.css      # CSS styles
│   └── app.js          # Bundled React application
└── package.json        # Project configuration
```

### Security Considerations
- Uses Electron's contextIsolation for secure IPC communication
- Implements proper error handling for file operations
- Validates user input before performing operations
- Handles large files appropriately to prevent memory issues

## Safety Features
- Confirmation dialog before file deletion
- System directories are automatically excluded from scanning
- Error handling and reporting for all file operations
- Size limits for file previews to prevent performance issues
- Path validation to prevent access to system files

## License
ISC

---

*PC Cleaner is designed to help you identify potentially unused files. Always exercise caution when deleting files and ensure you have proper backups of important data.* 