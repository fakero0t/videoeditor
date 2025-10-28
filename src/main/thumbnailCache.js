import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';

class ThumbnailCache {
  constructor() {
    this.cacheDir = path.join(app.getPath('userData'), 'thumbnails');
    this.ensureCacheDir();
    this.cleanupOldThumbnails();
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  // Generate cache key from file path and timestamp
  getCacheKey(videoPath, timestamp = 1) {
    const hash = crypto
      .createHash('md5')
      .update(`${videoPath}-${timestamp}`)
      .digest('hex');
    return `${hash}.jpg`;
  }

  // Get thumbnail path (check if exists)
  getThumbnailPath(videoPath, timestamp = 1) {
    const filename = this.getCacheKey(videoPath, timestamp);
    const thumbnailPath = path.join(this.cacheDir, filename);
    
    if (fs.existsSync(thumbnailPath)) {
      return thumbnailPath;
    }
    
    return null;
  }

  // Store thumbnail path (no action needed, just return path for FFmpeg)
  getOutputPath(videoPath, timestamp = 1) {
    const filename = this.getCacheKey(videoPath, timestamp);
    return path.join(this.cacheDir, filename);
  }

  // Clean up thumbnails older than 30 days
  cleanupOldThumbnails() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
      
      files.forEach(file => {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtimeMs < thirtyDaysAgo) {
          fs.unlinkSync(filePath);
          console.log('Deleted old thumbnail:', file);
        }
      });
    } catch (error) {
      console.error('Error cleaning up thumbnails:', error);
    }
  }

  // Clear all thumbnails
  clearCache() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(this.cacheDir, file));
      });
      console.log('Thumbnail cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Get cache statistics
  getCacheStats() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      let totalSize = 0;
      
      files.forEach(file => {
        const stats = fs.statSync(path.join(this.cacheDir, file));
        totalSize += stats.size;
      });
      
      return {
        count: files.length,
        size: totalSize,
        path: this.cacheDir
      };
    } catch (error) {
      return { count: 0, size: 0, path: this.cacheDir };
    }
  }
}

export default ThumbnailCache;
