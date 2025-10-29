import ffmpeg from 'fluent-ffmpeg';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import ThumbnailCache from './thumbnailCache.js';

class FFmpegHandler {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.currentOperation = null;
    this.progressCallback = null;
    this.thumbnailCache = new ThumbnailCache();
    this.initialized = false;
    
    // Initialize FFmpeg paths asynchronously
    this.initialize();
  }

  async initialize() {
    await this.setupFFmpegPaths();
    this.initialized = true;
  }

  async setupFFmpegPaths() {
    let ffmpegPath, ffprobePath;
    
    if (app.isPackaged) {
      // In packaged app, use extraResources paths
      const resourcesPath = process.resourcesPath;
      ffmpegPath = path.join(resourcesPath, 'ffmpeg-static', 'ffmpeg');
      ffprobePath = path.join(resourcesPath, 'ffprobe-static', 'bin', 'darwin', 'arm64', 'ffprobe');
    } else {
      // In development, dynamically import the modules
      try {
        const ffmpegStatic = await import('ffmpeg-static');
        const ffprobeStatic = await import('ffprobe-static');
        ffmpegPath = ffmpegStatic.default;
        ffprobePath = ffprobeStatic.default.path;
      } catch (error) {
        console.error('Failed to import FFmpeg modules:', error);
        return;
      }
    }
    
    // Ensure the binaries exist and are executable
    if (fs.existsSync(ffmpegPath)) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    } else {
      console.error('FFmpeg binary not found at:', ffmpegPath);
    }
    
    if (fs.existsSync(ffprobePath)) {
      ffmpeg.setFfprobePath(ffprobePath);
    } else {
      console.error('FFprobe binary not found at:', ffprobePath);
    }
    
    console.log('FFmpeg path:', ffmpegPath);
    console.log('FFprobe path:', ffprobePath);
    console.log('App packaged:', app.isPackaged);
  }

  // Queue an operation for processing
  queueOperation(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        operation,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      this.processQueue();
    });
  }

  // Process operations in queue (one at a time for best UX)
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    const item = this.queue.shift();
    
    try {
      const result = await item.operation();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.processing = false;
      this.processQueue(); // Process next item
    }
  }

  // Get video metadata using ffprobe
  async getVideoInfo(filePath) {
    return this.queueOperation(async () => {
      return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
          if (err) {
            console.error('FFprobe error:', err);
            reject(new Error(`Failed to read video file: ${err.message}`));
            return;
          }
          
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');
          const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
          
          if (!videoStream) {
            reject(new Error('No video stream found in file'));
            return;
          }
          
          resolve({
            duration: parseFloat(metadata.format.duration) || 0,
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            codec: videoStream.codec_name || 'unknown',
            bitrate: parseInt(metadata.format.bit_rate) || 0,
            frameRate: this.parseFrameRate(videoStream.r_frame_rate || '30/1'),
            hasAudio: !!audioStream,
            fileSize: parseInt(metadata.format.size) || 0,
            format: metadata.format.format_name || 'unknown'
          });
        });
      });
    });
  }

  parseFrameRate(rateString) {
    const parts = rateString.split('/');
    if (parts.length === 2) {
      return parseInt(parts[0]) / parseInt(parts[1]);
    }
    return parseFloat(rateString) || 30;
  }

  // Generate thumbnail from video
  async generateThumbnail(videoPath, timestamp = 1) {
    return this.queueOperation(async () => {
      // Check cache first
      const cachedPath = this.thumbnailCache.getThumbnailPath(videoPath, timestamp);
      if (cachedPath) {
        console.log('Using cached thumbnail:', cachedPath);
        // Convert cached file to base64 data URL
        try {
          const thumbnailBuffer = fs.readFileSync(cachedPath);
          const base64 = thumbnailBuffer.toString('base64');
          return `data:image/jpeg;base64,${base64}`;
        } catch (error) {
          console.error('Error reading cached thumbnail:', error);
          // Fall through to generate new thumbnail
        }
      }
      
      // Generate new thumbnail
      const outputPath = this.thumbnailCache.getOutputPath(videoPath, timestamp);
      
      return new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .seekInput(timestamp)
          .frames(1)
          .size('160x90')
          .output(outputPath)
          .on('end', () => {
            console.log('Generated thumbnail:', outputPath);
            // Convert to base64 data URL for Electron security
            try {
              const thumbnailBuffer = fs.readFileSync(outputPath);
              const base64 = thumbnailBuffer.toString('base64');
              const dataUrl = `data:image/jpeg;base64,${base64}`;
              resolve(dataUrl);
            } catch (error) {
              console.error('Error converting thumbnail to base64:', error);
              resolve(outputPath); // Fallback to file path
            }
          })
          .on('error', (err) => {
            console.error('Thumbnail generation error:', err);
            reject(new Error(`Failed to generate thumbnail: ${err.message}`));
          })
          .run();
      });
    });
  }

  // Export video with progress tracking
  async exportVideo(config, progressCallback) {
    this.progressCallback = progressCallback;
    
    return this.queueOperation(async () => {
      return new Promise((resolve, reject) => {
        const {
          inputs,
          output,
          resolution,
          quality,
          frameRate,
          filterComplex
        } = config;
        
        const command = ffmpeg();
        
        // Add input files
        inputs.forEach(input => {
          command.input(input.path);
          if (input.startTime) {
            command.inputOptions([`-ss ${input.startTime}`]);
          }
          if (input.duration) {
            command.inputOptions([`-t ${input.duration}`]);
          }
        });
        
        // Apply filter complex if provided
        if (filterComplex) {
          command.complexFilter(filterComplex);
        }
        
        // Build output options
        const outOpts = [
          '-c:v libx264',
          `-preset ${this.getPreset(quality)}`,
          `-crf ${this.getCRF(quality)}`,
          '-c:a aac',
          '-b:a 128k',
          '-ar 48000',
          '-ac 2',
          '-movflags +faststart'
        ];
        
        // Only set -r when explicitly provided (source fps -> omit)
        if (typeof frameRate === 'number' && frameRate > 0) {
          outOpts.push(`-r ${frameRate}`);
        }
        
        // If using labeled outputs, map them
        if (filterComplex && filterComplex.includes('[v_out]')) {
          outOpts.push('-map [v_out]');
        }
        if (filterComplex && filterComplex.includes('[a_out]')) {
          outOpts.push('-map [a_out]');
        }

        command.outputOptions(outOpts);
        
        // Set resolution if specified and not already handled via filter graph
        // When filterComplex is provided, scaling is expected in the graph
        if ((!filterComplex || !filterComplex.includes('[v_out]')) && resolution && resolution !== 'source') {
          const [width, height] = this.parseResolution(resolution);
          command.size(`${width}x${height}`);
        }
        
        command
          .output(output)
          .on('start', (commandLine) => {
            console.log('FFmpeg command:', commandLine);
            this.currentOperation = command;
          })
          .on('progress', (progress) => {
            if (this.progressCallback) {
              this.progressCallback({
                percent: Math.round(progress.percent || 0),
                currentTime: progress.timemark,
                fps: progress.currentFps
              });
            }
          })
          .on('end', () => {
            console.log('Export completed');
            this.currentOperation = null;
            this.progressCallback = null;
            resolve({ success: true, output });
          })
          .on('error', (err) => {
            console.error('Export error:', err);
            this.currentOperation = null;
            this.progressCallback = null;
            reject(new Error(`Export failed: ${err.message}`));
          })
          .run();
      });
    });
  }

  // Cancel current export operation
  cancelExport() {
    if (this.currentOperation) {
      this.currentOperation.kill('SIGKILL');
      this.currentOperation = null;
      this.progressCallback = null;
      return true;
    }
    return false;
  }

  getPreset(quality) {
    const presets = {
      'low': 'ultrafast',
      'medium': 'fast',
      'high': 'medium',
      'ultra': 'slow'
    };
    return presets[quality] || 'medium';
  }

  getCRF(quality) {
    const crfValues = {
      'low': 28,
      'medium': 23,
      'high': 18,
      'ultra': 15
    };
    return crfValues[quality] || 23;
  }

  parseResolution(resolution) {
    const resolutions = {
      '720p': [1280, 720],
      '1080p': [1920, 1080],
      '1440p': [2560, 1440],
      '4k': [3840, 2160]
    };
    return resolutions[resolution] || [1920, 1080];
  }

  // WebM to MP4 conversion
  async convertWebMToMP4(webmPath) {
    return new Promise((resolve, reject) => {
      const outputPath = webmPath.replace('.webm', '.mp4');
      
      ffmpeg(webmPath)
        .outputOptions([
          '-c:v libx264',
          '-preset fast',
          '-crf 22',
          '-c:a aac',
          '-b:a 128k',
          '-movflags +faststart'
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          console.log('FFmpeg conversion started:', commandLine);
        })
        .on('progress', (progress) => {
          console.log('Conversion progress:', progress.percent);
        })
        .on('end', () => {
          console.log('Conversion complete:', outputPath);
          resolve(outputPath);
        })
        .on('error', (error) => {
          console.error('Conversion error:', error);
          reject(error);
        })
        .run();
    });
  }

  // Test FFmpeg installation
  async testFFmpeg() {
    try {
      const testPath = path.join(os.tmpdir(), 'ffmpeg_test.txt');
      fs.writeFileSync(testPath, 'FFmpeg test');
      
      // Simple test: get version
      return new Promise((resolve) => {
        ffmpeg()
          .input(testPath)
          .on('start', () => {
            fs.unlinkSync(testPath);
            resolve(true);
          })
          .on('error', () => {
            resolve(false);
          });
      });
    } catch (error) {
      console.error('FFmpeg test failed:', error);
      return false;
    }
  }
}

export default FFmpegHandler;
