import { VideoCompositor } from './videoCompositor.js';

// Diagnostic logging for screen recording
class ScreenRecordingDiagnostics {
  logRecordingAttempt(source, options) {
    // Logging removed for cleaner console output
  }
  
  logStreamInfo(stream) {
    // Logging removed for cleaner console output
  }
  
  logRecordingSuccess(duration, fileSize, filePath) {
    // Logging removed for cleaner console output
  }
  
  logRecordingError(error, context) {
    console.error('Recording error:', error.message);
  }
}

export class ScreenRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordingStream = null;
    this.audioStream = null;
    this.audioContext = null;
    this.audioAnalyser = null;
    this.startTime = null;
    this.durationInterval = null;
    this.diskSpaceInterval = null;
    this.audioLevelInterval = null;
    
    // Diagnostics for debugging
    this.diagnostics = new ScreenRecordingDiagnostics();
    
    // Callbacks
    this.callbacks = {};
    
    // 2 hour max duration
    this.MAX_DURATION = 2 * 60 * 60 * 1000; // milliseconds
    this.maxDurationTimer = null;
    
    // Disk space monitoring
    this.MIN_DISK_SPACE = 500 * 1024 * 1024; // 500MB
  }

  async checkPermissions() {
    return await window.electronAPI.recording.checkPermissions();
  }

  async requestPermissions() {
    return await window.electronAPI.recording.requestPermissions();
  }

  async checkDiskSpace() {
    const space = await window.electronAPI.recording.getDiskSpace();
    return space.available;
  }

  // Get video constraints based on quality
  getVideoConstraints(quality) {
    const constraints = {
      high: { width: { ideal: 1920 }, height: { ideal: 1080 } },
      medium: { width: { ideal: 1280 }, height: { ideal: 720 } },
      low: { width: { ideal: 854 }, height: { ideal: 480 } }
    };
    return constraints[quality] || constraints.high;
  }

  // Validate recording requirements before starting
  async validateRecordingRequirements(screenSource, microphoneSource) {
    const errors = [];
    
    
    // 1. Validate source exists and has correct format
    if (!screenSource) {
      errors.push('No screen source selected');
    } else {
      if (!screenSource.id) {
        errors.push('Screen source missing ID');
      } else if (!screenSource.id.includes(':')) {
        errors.push(`Invalid source ID format: ${screenSource.id} (expected format: screen:X:Y or window:X:Y)`);
      }
      
      // Verify source still exists in available sources
      try {
        const sources = await window.electronAPI.recording.getDesktopSources();
        const sourceExists = sources.some(s => s.id === screenSource.id);
        if (!sourceExists) {
          errors.push(`Selected source no longer available: ${screenSource.name || screenSource.id}`);
        }
      } catch (error) {
        // Don't block on this check
      }
    }
    
    // 2. Check permissions (but be lenient - if we have sources, permission is clearly granted)
    try {
      const permissions = await this.checkPermissions();
      
      // If source verification succeeded (source exists in list), we definitely have screen permission
      // Don't fail validation based on permission API alone - it can be unreliable
      const hasSourcesInList = screenSource && !errors.some(e => e.includes('no longer available'));
      
      if (!permissions.screen && !hasSourcesInList) {
        // Only add error if BOTH permission API says no AND we couldn't verify source
        errors.push('Screen recording permission not granted');
      } else if (!permissions.screen && hasSourcesInList) {
        // Permission API says no, but we have sources - trust the sources
      }
      
      if (microphoneSource && !permissions.microphone) {
        errors.push('Microphone permission not granted');
      }
    } catch (error) {
      // Don't block on permission check failure - we'll find out when we try to get stream
    }
    
    // 3. Check disk space
    try {
      const diskSpace = await this.checkDiskSpace();
      const required = 5 * 1024 * 1024 * 1024; // 5GB
      if (diskSpace < required) {
        const requiredGB = (required / 1024 / 1024 / 1024).toFixed(1);
        const availableGB = (diskSpace / 1024 / 1024 / 1024).toFixed(1);
        errors.push(`Insufficient disk space. Need ${requiredGB}GB, have ${availableGB}GB available`);
      }
    } catch (error) {
      // Don't block on disk space check failure
    }
    
    // 4. Check codec support
    const supportedCodec = this.findSupportedCodec();
    if (!supportedCodec) {
      errors.push('No supported video codec found. Video recording may not work.');
    } else {
    }
    
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Find best supported video codec
  findSupportedCodec() {
    const codecs = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    
    for (const codec of codecs) {
      if (MediaRecorder.isTypeSupported(codec)) {
        return codec;
      }
    }
    
    return null;
  }

  // Start screen recording
  async startScreenRecording(screenSource, microphoneSource, quality, callbacks) {
    this.callbacks = callbacks;
    
    try {
      // Log recording attempt with full details
      this.diagnostics.logRecordingAttempt(screenSource, { quality, microphoneSource });
      
      // Validate requirements before starting
      const validation = await this.validateRecordingRequirements(screenSource, microphoneSource);
      if (!validation.valid) {
        const errorMsg = 'Recording validation failed:\n• ' + validation.errors.join('\n• ');
        throw new Error(errorMsg);
      }
      
      
      // Validate screen source
      if (!screenSource.id) {
        throw new Error('Screen source ID is missing');
      }
      
      if (!screenSource.id.startsWith('screen:') && !screenSource.id.startsWith('window:')) {
      }
      
      // Get screen stream
      const videoConstraints = this.getVideoConstraints(quality);

      // Validate screen source ID format
      if (!screenSource.id) {
        throw new Error('Screen source ID is required');
      }


      // CRITICAL FIX: Electron desktopCapturer REQUIRES mandatory constraints
      // The mandatory object is NOT optional - without it, getUserMedia falls back to webcam
      
      const screenStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: screenSource.id
          }
        }
      }).catch(async (error) => {
        console.error('[Recording] getUserMedia failed:', error.message);
        
        // Log ALL available sources to compare
        try {
          const allSources = await window.electronAPI.recording.getDesktopSources();
        } catch (e) {
        }
        
        throw new Error(`Failed to capture screen: ${error.message}. Check that the source ID is correct and permission is granted.`);
      });


      // Log video track info to verify it's screen, not webcam
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        
        // WARNING: If label contains "camera" or "webcam", we captured wrong device!
        if (videoTrack.label.toLowerCase().includes('camera') || 
            videoTrack.label.toLowerCase().includes('webcam')) {
          console.error('[Recording] WARNING: Captured webcam instead of screen!');
        }
      }

      this.recordingStream = screenStream;
      
      // Log complete stream information for debugging
      this.diagnostics.logStreamInfo(this.recordingStream);
      
      // Get microphone stream if selected
      if (microphoneSource) {
        this.audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: microphoneSource.deviceId,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        // Add audio track to recording stream
        const audioTrack = this.audioStream.getAudioTracks()[0];
        this.recordingStream.addTrack(audioTrack);
        
        // Set up audio level monitoring
        this.setupAudioLevelMonitoring();
      }
      
      // Start recording
      await this.startMediaRecorder(this.recordingStream);
      
      // Start duration tracking
      this.startDurationTracking();
      
      // Start disk space monitoring
      this.startDiskSpaceMonitoring((reason, available) => {
        this.stopRecording();
      });
      
      // Set max duration timer
      this.maxDurationTimer = setTimeout(() => {
        this.stopRecording();
      }, this.MAX_DURATION);
      
      // Callback on start
      if (this.callbacks.onStart) {
        this.callbacks.onStart();
      }
      
    } catch (error) {
      // Use diagnostics for detailed error logging
      this.diagnostics.logRecordingError(error, {
        screenSource: {
          id: screenSource?.id,
          name: screenSource?.name,
          type: screenSource?.type
        },
        microphoneSource: microphoneSource?.label || 'None',
        quality
      });
      
      // Also keep existing detailed logging
      console.error('Failed to start screen recording:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        constraint: error.constraint,
        screenSource: screenSource
      });
      
      this.cleanup();
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      throw error;
    }
  }

  // Start MediaRecorder
  async startMediaRecorder(stream) {
    return new Promise((resolve, reject) => {
      try {
        // Try different codecs
        const mimeTypes = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm'
        ];
        
        let mimeType = null;
        for (const type of mimeTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            break;
          }
        }
        
        if (!mimeType) {
          reject(new Error('No supported video codec found'));
          return;
        }
        
        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 5000000 // 5 Mbps
        });
        
        this.recordedChunks = [];
        
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };
        
        this.mediaRecorder.onstop = async () => {
          console.log('[ScreenRecorder] MediaRecorder onstop event fired');
          await this.handleRecordingComplete();
        };
        
        this.mediaRecorder.onerror = (error) => {
          console.error('MediaRecorder error:', error);
          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }
        };
        
        this.startTime = Date.now();
        this.mediaRecorder.start(1000); // Collect data every second
        
        resolve();
        
      } catch (error) {
        reject(error);
      }
    });
  }

  // Setup audio level monitoring
  setupAudioLevelMonitoring() {
    try {
      this.audioContext = new AudioContext();
      this.audioAnalyser = this.audioContext.createAnalyser();
      this.audioAnalyser.fftSize = 256;
      
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      source.connect(this.audioAnalyser);
      
      this.audioLevelInterval = setInterval(() => {
        const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
        this.audioAnalyser.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const level = (average / 255) * 100;
        
        if (this.callbacks.onAudioLevel) {
          this.callbacks.onAudioLevel(level);
        }
      }, 100); // Update every 100ms
      
    } catch (error) {
      console.error('Failed to setup audio monitoring:', error);
    }
  }

  // Start duration tracking
  startDurationTracking() {
    this.durationInterval = setInterval(() => {
      if (this.startTime) {
        const duration = (Date.now() - this.startTime) / 1000; // seconds
        if (this.callbacks.onProgress) {
          this.callbacks.onProgress(duration);
        }
        
        // Monitor audio sync every 5 seconds
        if (this.audioContext && Math.floor(duration) % 5 === 0) {
          const syncStatus = this.testAudioSync();
          if (!syncStatus.inSync && syncStatus.drift > 100) { // Only warn if drift > 100ms
            console.warn('Audio sync drift detected:', syncStatus.drift + 'ms');
          }
        }
      }
    }, 1000); // Update every second
  }

  // Start disk space monitoring
  startDiskSpaceMonitoring(callback) {
    this.diskSpaceInterval = setInterval(async () => {
      const available = await this.checkDiskSpace();
      
      if (available < this.MIN_DISK_SPACE) {
        callback('low_disk_space', available);
      }
    }, 30000); // Check every 30 seconds
  }

  // Stop disk space monitoring
  stopDiskSpaceMonitoring() {
    if (this.diskSpaceInterval) {
      clearInterval(this.diskSpaceInterval);
      this.diskSpaceInterval = null;
    }
  }

  // Stop recording
  async stopRecording() {
    return new Promise((resolve) => {
      console.log('[ScreenRecorder] stopRecording called, MediaRecorder state:', this.mediaRecorder?.state);
      
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        console.log('[ScreenRecorder] MediaRecorder is not active, resolving immediately');
        resolve();
        return;
      }
      
      // Stop media recorder (this will trigger onstop handler)
      console.log('[ScreenRecorder] Calling MediaRecorder.stop()');
      this.mediaRecorder.stop();
      
      resolve();
    });
  }

  // Handle recording complete
  async handleRecordingComplete() {
    try {
      // Stop all intervals
      if (this.durationInterval) {
        clearInterval(this.durationInterval);
        this.durationInterval = null;
      }
      
      if (this.audioLevelInterval) {
        clearInterval(this.audioLevelInterval);
        this.audioLevelInterval = null;
      }
      
      this.stopDiskSpaceMonitoring();
      
      if (this.maxDurationTimer) {
        clearTimeout(this.maxDurationTimer);
        this.maxDurationTimer = null;
      }
      
      // Create blob from recorded chunks
      console.log('[ScreenRecorder] Recorded chunks count:', this.recordedChunks.length);
      console.log('[ScreenRecorder] Recorded chunks total size:', this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0));
      
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      const duration = (Date.now() - this.startTime) / 1000;
      
      console.log('[ScreenRecorder] Blob size:', blob.size, 'bytes');
      console.log('[ScreenRecorder] Blob type:', blob.type);
      console.log('[ScreenRecorder] Recording duration:', duration, 'seconds');
      
      // Save to temporary location
      const tempPath = await this.saveBlobToFile(blob);
      console.log('[ScreenRecorder] File saved to:', tempPath);
      
      // Log success with metrics
      this.diagnostics.logRecordingSuccess(duration, blob.size, tempPath);
      
      // Callback with file path and duration (BEFORE cleanup to preserve callbacks)
      if (this.callbacks.onComplete) {
        try {
          await this.callbacks.onComplete(tempPath, duration);
        } catch (callbackError) {
          console.error('[Recording] onComplete callback failed:', callbackError);
        }
      } else {
      }
      
      // Cleanup streams (AFTER callback)
      this.cleanup();
      
    } catch (error) {
      console.error('Failed to handle recording complete:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    }
  }

  // Save blob to file
  async saveBlobToFile(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const buffer = reader.result;
          const timestamp = Date.now();
          const fileName = `Recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
          
          // Get recordings directory
          const recordingsDir = await window.electronAPI.getAppPath('userData');
          const recordingsPath = `${recordingsDir}/Recordings`;
          const filePath = `${recordingsPath}/${fileName}`;
          
          // Write the file (this should create the directory if needed)
          await window.electronAPI.fileSystem.writeFile(filePath, new Uint8Array(buffer));
          
          resolve(filePath);
        } catch (error) {
          console.error('[Recording] Error saving file:', error);
          reject(error);
        }
      };
      
      reader.onerror = (error) => {
        console.error('[Recording] FileReader error:', error);
        reject(error);
      };
      reader.readAsArrayBuffer(blob);
    });
  }

  // Audio sync testing utility
  testAudioSync() {
    // This is a test utility, not used in production
    // Verifies audio/video are synchronized within acceptable threshold
    const ACCEPTABLE_DRIFT = 50; // 50ms
    
    if (!this.startTime) {
      return {
        videoTimestamp: null,
        audioTimestamp: null,
        drift: null,
        inSync: false,
        error: 'Recording not started'
      };
    }
    
    const currentTime = Date.now();
    const videoTimestamp = currentTime - this.startTime;
    const audioTimestamp = this.audioContext ? this.audioContext.currentTime * 1000 : videoTimestamp;
    const drift = Math.abs(videoTimestamp - audioTimestamp);
    
    return {
      videoTimestamp,
      audioTimestamp,
      drift,
      inSync: drift <= ACCEPTABLE_DRIFT,
      acceptableDrift: ACCEPTABLE_DRIFT
    };
  }

  // Get audio quality settings
  getAudioQualitySettings() {
    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 44100,
      channelCount: 2,
      bitrate: 128000 // 128kbps
    };
  }

  // Set up audio level monitoring for preview (not recording)
  async setupPreviewAudioLevelMonitoring(microphoneSource, onAudioLevel) {
    try {
      // Clean up existing audio monitoring
      this.cleanupAudioMonitoring();
      
      if (!microphoneSource) return;
      
      // Get microphone stream for preview
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: microphoneSource.deviceId,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Set up audio context and analyser
      this.audioContext = new AudioContext();
      this.audioAnalyser = this.audioContext.createAnalyser();
      this.audioAnalyser.fftSize = 256;
      
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      source.connect(this.audioAnalyser);
      
      // Start monitoring audio levels
      this.audioLevelInterval = setInterval(() => {
        const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
        this.audioAnalyser.getByteFrequencyData(dataArray);
        
        // Calculate average audio level
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const level = Math.round((average / 255) * 100);
        
        if (onAudioLevel) {
          onAudioLevel(level);
        }
      }, 100); // Update every 100ms for smooth visualization
      
    } catch (error) {
      console.error('Failed to setup preview audio monitoring:', error);
    }
  }

  // Clean up audio monitoring
  cleanupAudioMonitoring() {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
  }

  // Start webcam recording
  async startWebcamRecording(webcamSource, microphoneSource, quality, callbacks) {
    this.callbacks = callbacks;
    
    try {
      // Get webcam stream
      const videoConstraints = this.getVideoConstraints(quality);
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: webcamSource.deviceId,
          width: videoConstraints.width,
          height: videoConstraints.height
        },
        audio: false
      });
      
      this.recordingStream = webcamStream;
      
      // Get microphone stream if selected
      if (microphoneSource) {
        this.audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: microphoneSource.deviceId,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        // Add audio track to recording stream
        const audioTrack = this.audioStream.getAudioTracks()[0];
        this.recordingStream.addTrack(audioTrack);
        
        // Set up audio level monitoring
        this.setupAudioLevelMonitoring();
      }
      
      // Start recording (same as screen recording)
      await this.startMediaRecorder(this.recordingStream);
      
      // Start duration tracking
      this.startDurationTracking();
      
      // Start disk space monitoring
      this.startDiskSpaceMonitoring((reason, available) => {
        this.stopRecording();
      });
      
      // Set max duration timer
      this.maxDurationTimer = setTimeout(() => {
        this.stopRecording();
      }, this.MAX_DURATION);
      
      // Callback on start
      if (this.callbacks.onStart) {
        this.callbacks.onStart();
      }
      
    } catch (error) {
      console.error('Failed to start webcam recording:', error);
      this.cleanup();
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      throw error;
    }
  }

  // Start composite recording (screen + webcam PiP)
  async startCompositeRecording(screenSource, webcamSource, microphoneSource, quality, callbacks) {
    this.callbacks = callbacks;
    
    try {
      // Validate requirements
      const validation = await this.validateRecordingRequirements(screenSource, microphoneSource);
      if (!validation.valid) {
        const errorMsg = 'Composite recording validation failed:\n• ' + validation.errors.join('\n• ');
        throw new Error(errorMsg);
      }
      
      // Get screen stream
      const videoConstraints = this.getVideoConstraints(quality);
      
      const screenStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: screenSource.id
          }
        }
      });
      
      // Get webcam stream with fixed 720p
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: webcamSource.deviceId,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      // Create off-screen canvas for composition
      const canvas = document.createElement('canvas');
      canvas.width = videoConstraints.width.ideal;
      canvas.height = videoConstraints.height.ideal;
      
      // Initialize compositor
      const compositor = new VideoCompositor();
      compositor.init(canvas);
      await compositor.setScreenStream(screenStream);
      await compositor.setWebcamStream(webcamStream);
      compositor.startComposition();
      
      // Get composite stream from canvas
      this.recordingStream = compositor.getCompositeStream();
      
      // Store compositor for cleanup
      this.compositor = compositor;
      this.screenStream = screenStream;
      this.webcamStream = webcamStream;
      
      // Get microphone stream if selected
      if (microphoneSource) {
        this.audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: microphoneSource.deviceId,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        // Add audio track to recording stream
        const audioTrack = this.audioStream.getAudioTracks()[0];
        this.recordingStream.addTrack(audioTrack);
        
        // Set up audio level monitoring
        this.setupAudioLevelMonitoring();
      }
      
      // Start recording
      await this.startMediaRecorder(this.recordingStream);
      
      // Start duration tracking
      this.startDurationTracking();
      
      // Start disk space monitoring
      this.startDiskSpaceMonitoring((reason, available) => {
        console.warn('Stopping composite recording:', reason);
        this.stopRecording();
      });
      
      // Set max duration timer
      this.maxDurationTimer = setTimeout(() => {
        this.stopRecording();
      }, this.MAX_DURATION);
      
      
      // Callback on start
      if (this.callbacks.onStart) {
        this.callbacks.onStart();
      }
      
    } catch (error) {
      console.error('[Composite] Failed to start composite recording:', error);
      this.cleanup();
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      throw error;
    }
  }

  cleanup() {
    
    // Stop compositor if active
    if (this.compositor) {
      this.compositor.cleanup();
      this.compositor = null;
    }
    
    // Stop screen stream (for composite)
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
    
    // Stop webcam stream (for composite)
    if (this.webcamStream) {
      this.webcamStream.getTracks().forEach(track => track.stop());
      this.webcamStream = null;
    }
    
    // Stop all video/audio tracks
    if (this.recordingStream) {
      const tracks = this.recordingStream.getTracks();
      tracks.forEach(track => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
      this.recordingStream = null;
    }
    
    // Clean up audio monitoring
    this.cleanupAudioMonitoring();

    // Clear all intervals
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    this.stopDiskSpaceMonitoring();

    // Clear max duration timer
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }

    // Stop and clear media recorder
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.stop();
        } catch (error) {
          console.warn('[Recording] Error stopping MediaRecorder:', error);
        }
      }
      this.mediaRecorder = null;
    }

    // Clear recorded data
    if (this.recordedChunks && this.recordedChunks.length > 0) {
      this.recordedChunks = [];
    }
    
    this.startTime = null;
    this.callbacks = {};
    
  }
}
