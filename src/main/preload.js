import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog APIs
  openFiles: (options) => ipcRenderer.invoke('dialog:openFiles', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  showMessageBox: (options) => ipcRenderer.invoke('dialog:showMessageBox', options),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),
  
  // App APIs
  getAppPath: (name) => ipcRenderer.invoke('app:getPath', name),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  setPreventQuit: (prevent) => ipcRenderer.invoke('app:setPreventQuit', prevent),
  
  // FFmpeg APIs (will be implemented in PR #2)
  ffmpeg: {
    getVideoInfo: (filePath) => ipcRenderer.invoke('ffmpeg:getVideoInfo', filePath),
    generateThumbnail: (videoPath, outputPath, timestamp) => 
      ipcRenderer.invoke('ffmpeg:generateThumbnail', videoPath, outputPath, timestamp),
    exportVideo: (config) => ipcRenderer.invoke('ffmpeg:exportVideo', config),
    cancelExport: () => ipcRenderer.invoke('ffmpeg:cancelExport'),
    convertWebMToMP4: (webmPath) => ipcRenderer.invoke('ffmpeg:convertWebMToMP4', webmPath)
  },
  
  // Event listeners
  onExportProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('ffmpeg:progress', subscription);
    return () => ipcRenderer.removeListener('ffmpeg:progress', subscription);
  },
  
  onQuitRequested: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('app:quit-requested', subscription);
    return () => ipcRenderer.removeListener('app:quit-requested', subscription);
  },

  // File system APIs
  fileSystem: {
    copyFile: (source, destination) => ipcRenderer.invoke('fs:copyFile', source, destination),
    copyFileWithProgress: (source, destination) => 
      ipcRenderer.invoke('fs:copyFileWithProgress', source, destination),
    fileExists: (filePath) => ipcRenderer.invoke('fs:fileExists', filePath),
    deleteFile: (filePath) => ipcRenderer.invoke('fs:deleteFile', filePath),
    readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content)
  },

  // Event listener for file copy progress
  onFileCopyProgress: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('fs:copy-progress', subscription);
    return () => ipcRenderer.removeListener('fs:copy-progress', subscription);
  },

  // Project APIs
  project: {
    save: (projectPath, projectData, filesToCopy) => 
      ipcRenderer.invoke('project:save', projectPath, projectData, filesToCopy)
  },

  // Recording APIs
  recording: {
    checkPermissions: () => ipcRenderer.invoke('recording:checkPermissions'),
    requestPermissions: () => ipcRenderer.invoke('recording:requestPermissions'),
    openSystemSettings: () => ipcRenderer.invoke('recording:openSystemSettings'),
    getDiskSpace: () => ipcRenderer.invoke('recording:getDiskSpace'),
    getDesktopSources: () => ipcRenderer.invoke('recording:getDesktopSources'),
    setRecordingState: (recording) => ipcRenderer.invoke('recording:setRecordingState', recording)
  },

  // Event listeners for recording
  onQuitRequestedDuringRecording: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('app:quit-requested-during-recording', subscription);
    return () => ipcRenderer.removeListener('app:quit-requested-during-recording', subscription);
  }
});

// Platform info
contextBridge.exposeInMainWorld('platform', {
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux'
});
