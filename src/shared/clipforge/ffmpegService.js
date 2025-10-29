class ClipForgeFFmpegService {
  constructor() {
    this.progressCallbacks = new Set();
  }

  async getVideoInfo(filePath) {
    try {
      return await window.electronAPI.ffmpeg.getVideoInfo(filePath);
    } catch (error) {
      console.error('Error getting video info:', error);
      throw new Error('Failed to read video file. Please ensure it is a valid video format.');
    }
  }

  async generateThumbnail(videoPath, timestamp = 1) {
    try {
      return await window.electronAPI.ffmpeg.generateThumbnail(videoPath, timestamp);
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return null; // Return null instead of throwing to allow graceful degradation
    }
  }

  async exportVideo(config) {
    try {
      return await window.electronAPI.ffmpeg.exportVideo(config);
    } catch (error) {
      console.error('Error exporting video:', error);
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  async cancelExport() {
    return await window.electronAPI.ffmpeg.cancelExport();
  }

  onProgress(callback) {
    this.progressCallbacks.add(callback);
    
    // Set up listener if not already set
    if (this.progressCallbacks.size === 1) {
      this.unsubscribe = window.electronAPI.onExportProgress((progress) => {
        this.progressCallbacks.forEach(cb => cb(progress));
      });
    }
    
    // Return unsubscribe function
    return () => {
      this.progressCallbacks.delete(callback);
      if (this.progressCallbacks.size === 0 && this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    };
  }
}

export default new ClipForgeFFmpegService();
