import { systemPreferences, shell } from 'electron';

export class RecordingHandler {
  constructor() {
    this.platform = process.platform;
  }

  async checkPermissions() {
    const permissions = {
      screen: true,
      microphone: true
    };

    if (this.platform === 'darwin') {
      // macOS - check actual permissions
      try {
        const screenStatus = systemPreferences.getMediaAccessStatus('screen');
        const micStatus = systemPreferences.getMediaAccessStatus('microphone');
        
        console.log('Permission check results:', {
          screen: screenStatus,
          microphone: micStatus,
          screenGranted: screenStatus === 'granted',
          micGranted: micStatus === 'granted'
        });
        
        // Check for various permission states
        permissions.screen = screenStatus === 'granted' || screenStatus === 'authorized';
        permissions.microphone = micStatus === 'granted' || micStatus === 'authorized';
        
        // If the API says permissions are not granted, but we can see screen sources,
        // it might be a false negative - let's be more permissive
        if (!permissions.screen) {
          console.log('Screen permission appears to be denied, but checking if we can access screen sources...');
          // We'll let the renderer process test this by trying to get screen sources
        }
        
      } catch (error) {
        console.error('Permission check error:', error);
        // If permission check fails, assume permissions are granted
        // This is a fallback for cases where the API doesn't work correctly
        permissions.screen = true;
        permissions.microphone = true;
      }
    } else if (this.platform === 'win32') {
      // Windows - permissions handled differently
      // Generally more permissive, but we still return true
      permissions.screen = true;
      permissions.microphone = true;
    }

    return permissions;
  }

  async requestPermissions() {
    if (this.platform === 'darwin') {
      try {
        // Request microphone permission
        await systemPreferences.askForMediaAccess('microphone');
        
        // Note: Screen recording permission cannot be requested programmatically
        // User must grant it manually in System Preferences
      } catch (error) {
        console.error('Permission request error:', error);
      }
    }
  }

  openSystemSettings() {
    if (this.platform === 'darwin') {
      // Open Screen Recording settings on macOS
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    } else if (this.platform === 'win32') {
      // Open Privacy settings on Windows
      shell.openExternal('ms-settings:privacy');
    }
  }

  async getDiskSpace() {
    const { app } = require('electron');
    const os = require('os');
    const path = require('path');
    const fs = require('fs').promises;

    try {
      // Get free space on home directory drive
      const homedir = app.getPath('home');
      
      if (this.platform === 'win32') {
        // Windows
        const drive = path.parse(homedir).root;
        const { exec } = require('child_process');
        
        return new Promise((resolve, reject) => {
          exec(`wmic logicaldisk where "DeviceID='${drive.replace('\\', '')}'" get FreeSpace`, (error, stdout) => {
            if (error) {
              reject(error);
              return;
            }
            const lines = stdout.trim().split('\n');
            const freeSpace = parseInt(lines[1].trim());
            resolve({ available: freeSpace });
          });
        });
      } else {
        // macOS/Linux - use statvfs
        const { execSync } = require('child_process');
        const df = execSync(`df -k "${homedir}" | tail -1 | awk '{print $4}'`);
        const freeSpaceKB = parseInt(df.toString().trim());
        const freeSpaceBytes = freeSpaceKB * 1024;
        
        return { available: freeSpaceBytes };
      }
    } catch (error) {
      console.error('Disk space check error:', error);
      // Return large number if check fails (assume enough space)
      return { available: 100 * 1024 * 1024 * 1024 }; // 100GB
    }
  }
}
