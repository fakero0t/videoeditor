import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog APIs
  openFiles: (options) => ipcRenderer.invoke('dialog:openFiles', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  
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
    cancelExport: () => ipcRenderer.invoke('ffmpeg:cancelExport')
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
  }
});

// Platform info
contextBridge.exposeInMainWorld('platform', {
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux'
});
