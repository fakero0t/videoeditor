class AudioForgeFFmpegService {
  constructor() {
    this.progressCallbacks = new Set();
  }

  async getAudioInfo(filePath) {
    try {
      return await window.electronAPI.ffmpeg.getAudioInfo(filePath);
    } catch (error) {
      console.error('Error getting audio info:', error);
      throw new Error('Failed to read audio file. Please ensure it is a valid audio format.');
    }
  }

  async exportAudio(config) {
    try {
      return await window.electronAPI.ffmpeg.exportAudio(config);
    } catch (error) {
      console.error('Error exporting audio:', error);
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

export default new AudioForgeFFmpegService();
