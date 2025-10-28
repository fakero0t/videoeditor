import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import FFmpegHandler from './ffmpegHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Handle creating/removing shortcuts on Windows when installing/uninstalling
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch (e) {
  // electron-squirrel-startup not available, continue normally
}

let mainWindow = null;

// Initialize FFmpeg handler
const ffmpegHandler = new FFmpegHandler();

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'ClipForge',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Needed for ffmpeg access
      webSecurity: false, // Allow local file access
      allowRunningInsecureContent: true, // Allow local file access
      experimentalFeatures: true // Enable experimental features for file access
    },
    show: false // Don't show until ready
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    // Development mode
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'));
  }

  // Set up security headers to allow local file access
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['default-src \'self\' \'unsafe-inline\' \'unsafe-eval\' file: data: blob:']
      }
    });
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// App lifecycle
app.whenReady().then(async () => {
  createWindow();
  
  // Test FFmpeg on startup
  const ffmpegWorking = await ffmpegHandler.testFFmpeg();
  console.log('FFmpeg status:', ffmpegWorking ? 'Working' : 'Failed');
  
  if (!ffmpegWorking) {
    dialog.showErrorBox(
      'FFmpeg Error',
      'FFmpeg could not be initialized. Video processing will not work.'
    );
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('dialog:openFiles', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: options.filters || []
  });
  
  return result;
});

ipcMain.handle('dialog:saveFile', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: options.filters || [],
    defaultPath: options.defaultPath || ''
  });
  
  return result.filePath;
});

ipcMain.handle('app:getPath', async (event, name) => {
  return app.getPath(name);
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

// Prevent app from quitting during export
let preventQuit = false;

ipcMain.handle('app:setPreventQuit', (event, prevent) => {
  preventQuit = prevent;
});

app.on('before-quit', (event) => {
  if (preventQuit) {
    event.preventDefault();
    mainWindow.webContents.send('app:quit-requested');
  }
});

// FFmpeg IPC Handlers
ipcMain.handle('ffmpeg:getVideoInfo', async (event, filePath) => {
  try {
    return await ffmpegHandler.getVideoInfo(filePath);
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('ffmpeg:generateThumbnail', async (event, videoPath, timestamp) => {
  try {
    return await ffmpegHandler.generateThumbnail(videoPath, timestamp);
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('ffmpeg:exportVideo', async (event, config) => {
  try {
    const result = await ffmpegHandler.exportVideo(config, (progress) => {
      // Send progress updates to renderer
      mainWindow.webContents.send('ffmpeg:progress', progress);
    });
    return result;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('ffmpeg:cancelExport', () => {
  return ffmpegHandler.cancelExport();
});
