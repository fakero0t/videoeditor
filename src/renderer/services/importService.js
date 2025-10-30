import clipforgeFFmpegService from '../../shared/clipforge/ffmpegService';
import { isVideoFile, isAudioFile } from '../../shared/utils/videoUtils';

class ImportService {
  constructor(appMode = 'clipforge') {
    this.appMode = appMode;
    this.supportedExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.mpg', '.mpeg'];
    this.ffmpegService = clipforgeFFmpegService;
  }

  async openFileDialog() {
    try {
      const filters = [
        { name: 'Video Files', extensions: ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v', 'mpg', 'mpeg'] },
        { name: 'All Files', extensions: ['*'] }
      ];
      
      const result = await window.electronAPI.openFiles({
        filters,
        properties: ['openFile', 'multiSelections']
      });
      
      if (result.canceled) {
        return [];
      }
      
      return result.filePaths || [];
    } catch (error) {
      console.error('Error opening file dialog:', error);
      throw new Error('Failed to open file dialog');
    }
  }

  async processFiles(filePaths, progressCallback = null) {
    const results = [];
    const errors = [];
    
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      
      if (progressCallback) {
        progressCallback(i + 1, filePaths.length);
      }
      
      try {
        // Validate file
        this.validateFile(filePath);
        
        // Process file and extract metadata
        const fileData = await this.processFile(filePath);
        results.push(fileData);
      } catch (error) {
        console.error(`Failed to process ${filePath}:`, error);
        errors.push({
          filePath,
          fileName: filePath.split('/').pop(),
          error: error.message
        });
      }
    }
    
    return { results, errors };
  }

  validateFile(filePath) {
    const fileName = filePath.split('/').pop();
    
    // Check if it's a video file
    const isValid = isVideoFile(fileName);
    
    if (!isValid) {
      throw new Error(`Unsupported file format: ${fileName}. Expected video file.`);
    }
    
    // Additional validations can be added here
    // (file size, file existence, etc. - already handled by FFmpeg)
    
    return true;
  }

  async processFile(filePath) {
    try {
      // Extract video metadata using FFmpeg
      const videoInfo = await this.ffmpegService.getVideoInfo(filePath);
      
      // Generate thumbnail (non-blocking, can fail gracefully)
      let thumbnailPath = null;
      try {
        thumbnailPath = await this.ffmpegService.generateThumbnail(filePath, 1);
      } catch (error) {
        // Continue without thumbnail
      }
      
      return {
        filePath,
        fileName: filePath.split('/').pop(),
        duration: videoInfo.duration,
        width: videoInfo.width,
        height: videoInfo.height,
        codec: videoInfo.codec,
        bitrate: videoInfo.bitrate,
        frameRate: videoInfo.frameRate,
        hasAudio: videoInfo.hasAudio,
        fileSize: videoInfo.fileSize,
        format: videoInfo.format,
        thumbnailPath
      };
    } catch (error) {
      throw new Error(`Failed to read video file: ${error.message}`);
    }
  }

  validateDroppedFiles(files) {
    const validFiles = [];
    const invalidFiles = [];
    
    for (const file of files) {
      const isValid = isVideoFile(file.name);
      
      if (isValid) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    }
    
    return { validFiles, invalidFiles };
  }
}

export default ImportService;
