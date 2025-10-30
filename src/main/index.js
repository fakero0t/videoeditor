import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import FFmpegHandler from './ffmpegHandler.js';
import { RecordingHandler } from './recordingHandler.js';

// Load environment variables
dotenv.config();

// Debug environment variables
console.log('Environment variables loaded:');
console.log('- OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);
console.log('- OPENAI_API_KEY length:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0);
console.log('- OPENAI_API_KEY starts with sk-:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.startsWith('sk-') : false);


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Initialize recording handler
const recordingHandler = new RecordingHandler();

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Forge',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
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
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
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
  
  // Wait for FFmpeg handler to initialize
  await ffmpegHandler.initialize();
  
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
  if (preventQuit || isCurrentlyRecording) {
    event.preventDefault();
    
    if (isCurrentlyRecording) {
      mainWindow.webContents.send('app:quit-requested-during-recording');
    } else {
      mainWindow.webContents.send('app:quit-requested');
    }
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

ipcMain.handle('ffmpeg:convertWebMToMP4', async (event, webmPath) => {
  try {
    return await ffmpegHandler.convertWebMToMP4(webmPath);
  } catch (error) {
    throw error;
  }
});

// Audio-specific FFmpeg handlers
ipcMain.handle('ffmpeg:getAudioInfo', async (event, filePath) => {
  try {
    return await ffmpegHandler.getAudioInfo(filePath);
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('ffmpeg:exportAudio', async (event, config) => {
  try {
    const result = await ffmpegHandler.exportAudio(config, (progress) => {
      // Send progress updates to renderer
      mainWindow.webContents.send('ffmpeg:progress', progress);
    });
    return result;
  } catch (error) {
    throw error;
  }
});

// File system handlers for project management
ipcMain.handle('fs:copyFile', async (event, source, destination) => {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destination), { recursive: true });
    
    // Copy file
    await fs.copyFile(source, destination);
    
    return { success: true };
  } catch (error) {
    console.error('File copy error:', error);
    throw error;
  }
});

ipcMain.handle('fs:copyFileWithProgress', async (event, source, destination) => {
  const fs = require('fs');
  const path = require('path');
  
  return new Promise((resolve, reject) => {
    // Ensure destination directory exists
    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    const readStream = fs.createReadStream(source);
    const writeStream = fs.createWriteStream(destination);
    
    let totalSize = 0;
    let copiedSize = 0;
    
    // Get file size
    fs.stat(source, (err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      totalSize = stats.size;
    });
    
    readStream.on('data', (chunk) => {
      copiedSize += chunk.length;
      const progress = totalSize > 0 ? (copiedSize / totalSize) * 100 : 0;
      event.sender.send('fs:copy-progress', { 
        source: path.basename(source),
        progress: Math.round(progress),
        copiedSize,
        totalSize
      });
    });
    
    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', () => resolve({ success: true }));
    
    readStream.pipe(writeStream);
  });
});

ipcMain.handle('fs:fileExists', async (event, filePath) => {
  const fs = require('fs').promises;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fs:deleteFile', async (event, filePath) => {
  const fs = require('fs').promises;
  try {
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fs:readFile', async (event, filePath) => {
  const fs = require('fs').promises;
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Write file - handle both string and binary data
    if (content instanceof Uint8Array) {
      await fs.writeFile(filePath, Buffer.from(content));
    } else {
      await fs.writeFile(filePath, content, 'utf-8');
    }
    
    return { success: true };
  } catch (error) {
    throw error;
  }
});

// Project save with rollback on failure
ipcMain.handle('project:save', async (event, projectPath, projectData, filesToCopy) => {
  const projectFolder = path.dirname(projectPath);
  const projectName = path.basename(projectPath, path.extname(projectPath));
  const mediaFolder = path.join(projectFolder, `${projectName}_media`);
  const thumbnailFolder = path.join(mediaFolder, '.thumbnails');
  
  // Track copied files for rollback
  const copiedFiles = [];
  
  try {
    // Create folders
    await fs.mkdir(mediaFolder, { recursive: true });
    await fs.mkdir(thumbnailFolder, { recursive: true });
    
    // Copy each file with progress
    for (let i = 0; i < filesToCopy.length; i++) {
      const file = filesToCopy[i];
      const destPath = path.join(projectFolder, file.destRelative);
      
      try {
        // Copy file
        await fs.copyFile(file.source, destPath);
        copiedFiles.push(destPath);
        
        // Send progress
        event.sender.send('fs:copy-progress', {
          source: path.basename(file.source),
          progress: 100,
          copiedSize: (await fs.stat(destPath)).size,
          totalSize: (await fs.stat(file.source)).size
        });
        
      } catch (copyError) {
        console.error(`Failed to copy ${file.source}:`, copyError);
        throw new Error(`Failed to copy file: ${path.basename(file.source)}`);
      }
    }
    
    // Write project JSON
    const projectJSON = JSON.stringify(projectData, null, 2);
    await fs.writeFile(projectPath, projectJSON, 'utf-8');
    
    return { success: true };
    
  } catch (error) {
    console.error('Save failed, rolling back:', error);
    
    // ROLLBACK: Delete all copied files
    for (const filePath of copiedFiles) {
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error(`Failed to rollback ${filePath}:`, unlinkError);
      }
    }
    
    // Try to delete empty folders
    try {
      await fs.rmdir(thumbnailFolder);
      await fs.rmdir(mediaFolder);
    } catch (rmdirError) {
      // Ignore if folders not empty or don't exist
    }
    
    return {
      success: false,
      error: error.message
    };
  }
});

// Show message box
ipcMain.handle('dialog:showMessageBox', async (event, options) => {
  return await dialog.showMessageBox(mainWindow, options);
});

// Show open dialog  
ipcMain.handle('dialog:showOpenDialog', async (event, options) => {
  return await dialog.showOpenDialog(mainWindow, options);
});

// Show save dialog
ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
  return await dialog.showSaveDialog(mainWindow, options);
});

// Recording permission handlers
ipcMain.handle('recording:checkPermissions', async () => {
  return await recordingHandler.checkPermissions();
});

ipcMain.handle('recording:requestPermissions', async () => {
  return await recordingHandler.requestPermissions();
});

ipcMain.handle('recording:openSystemSettings', () => {
  recordingHandler.openSystemSettings();
});

ipcMain.handle('recording:getDiskSpace', async () => {
  return await recordingHandler.getDiskSpace();
});

// Desktop capturer (for screen sources)
ipcMain.handle('recording:getDesktopSources', async () => {
  const { desktopCapturer } = require('electron');
  
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 150, height: 150 }
    });
    
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      type: source.id.startsWith('screen') ? 'screen' : 'window'
    }));
  } catch (error) {
    console.error('Failed to get desktop sources:', error);
    throw error;
  }
});

// Track recording state for quit prevention
let isCurrentlyRecording = false;

ipcMain.handle('recording:setRecordingState', (event, recording) => {
  isCurrentlyRecording = recording;
});

