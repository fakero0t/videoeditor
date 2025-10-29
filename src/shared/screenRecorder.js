import { VideoCompositor } from './videoCompositor.js';

// Diagnostic logging for screen recording
class ScreenRecordingDiagnostics {
  logRecordingAttempt(source, options) {
    console.group('[Recording] Starting Recording Attempt');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Source:', {
      id: source?.id,
      name: source?.name,
      type: source?.type
    });
    console.log('Quality:', options?.quality);
    console.log('Microphone:', options?.microphoneSource?.label || 'None');
    console.groupEnd();
  }
  
  logStreamInfo(stream) {
    console.group('[Recording] Stream Information');
    
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    
    console.log('Video Tracks:', videoTracks.length);
    videoTracks.forEach((track, index) => {
      const settings = track.getSettings();
      console.log(`  Video Track ${index + 1}:`, {
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
        deviceId: settings.deviceId
      });
    });
    
    console.log('Audio Tracks:', audioTracks.length);
    audioTracks.forEach((track, index) => {
      console.log(`  Audio Track ${index + 1}:`, {
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      });
    });
    
    console.groupEnd();
  }
  
  logRecordingSuccess(duration, fileSize, filePath) {
    console.group('[Recording] Completed Successfully');
    console.log('Duration:', `${duration.toFixed(2)}s`);
    console.log('File Size:', `${(fileSize / 1024 / 1024).toFixed(2)}MB`);
    console.log('File Path:', filePath);
    console.log('Timestamp:', new Date().toISOString());
    console.groupEnd();
  }
  
  logRecordingError(error, context) {
    console.group('[Recording] Error Occurred');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Context:', context);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    console.error('Timestamp:', new Date().toISOString());
    console.groupEnd();
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
    
    console.log('[Validation] Checking recording requirements...');
    
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
        console.warn('[Validation] Could not verify source availability:', error);
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
        console.warn('[Validation] Screen permission may be missing');
        errors.push('Screen recording permission not granted');
      } else if (!permissions.screen && hasSourcesInList) {
        // Permission API says no, but we have sources - trust the sources
        console.log('[Validation] Permission API says no, but source list indicates permission is granted');
      }
      
      if (microphoneSource && !permissions.microphone) {
        errors.push('Microphone permission not granted');
      }
    } catch (error) {
      console.warn('[Validation] Permission check failed:', error);
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
      console.warn('[Validation] Disk space check failed:', error);
      // Don't block on disk space check failure
    }
    
    // 4. Check codec support
    const supportedCodec = this.findSupportedCodec();
    if (!supportedCodec) {
      errors.push('No supported video codec found. Video recording may not work.');
    } else {
      console.log('[Validation] Will use codec:', supportedCodec);
    }
    
    console.log('[Validation] Results:', {
      valid: errors.length === 0,
      errorCount: errors.length,
      errors: errors
    });
    
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
      console.log('[Recording] Validating requirements...');
      const validation = await this.validateRecordingRequirements(screenSource, microphoneSource);
      if (!validation.valid) {
        const errorMsg = 'Recording validation failed:\n• ' + validation.errors.join('\n• ');
        throw new Error(errorMsg);
      }
      console.log('[Recording] Validation passed');
      
      console.log('Starting screen recording with source:', {
        id: screenSource.id,
        name: screenSource.name,
        type: screenSource.type
      });
      
      // Validate screen source
      if (!screenSource.id) {
        throw new Error('Screen source ID is missing');
      }
      
      if (!screenSource.id.startsWith('screen:') && !screenSource.id.startsWith('window:')) {
        console.warn('Screen source ID format may be incorrect:', screenSource.id);
      }
      
      // Get screen stream
      const videoConstraints = this.getVideoConstraints(quality);
      console.log('[Recording] Video quality constraints:', videoConstraints);

      // Validate screen source ID format
      if (!screenSource.id) {
        throw new Error('Screen source ID is required');
      }

      console.log('[Recording] Requesting screen capture for source:', {
        id: screenSource.id,
        name: screenSource.name,
        type: screenSource.type
      });

      // CRITICAL FIX: Electron desktopCapturer REQUIRES mandatory constraints
      // The mandatory object is NOT optional - without it, getUserMedia falls back to webcam
      console.log('[Recording] Using getUserMedia with Electron desktopCapturer constraints');
      console.log('[Recording] Source ID being used:', screenSource.id);
      console.log('[Recording] Video constraints:', videoConstraints);
      
      const screenStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: screenSource.id
          }
        }
      }).catch(async (error) => {
        console.error('[Recording] getUserMedia FAILED with mandatory constraints');
        console.error('[Recording] Error name:', error.name);
        console.error('[Recording] Error message:', error.message);
        console.error('[Recording] Constraint:', error.constraint);
        console.error('[Recording] Source that failed:', {
          id: screenSource.id,
          name: screenSource.name,
          type: screenSource.type
        });
        
        // Log ALL available sources to compare
        try {
          const allSources = await window.electronAPI.recording.getDesktopSources();
          console.error('[Recording] Available sources at time of failure:');
          allSources.forEach(s => {
            console.error(`  - ${s.type}: ${s.name} (id: ${s.id})`);
          });
        } catch (e) {
          console.error('[Recording] Could not fetch sources for comparison:', e);
        }
        
        throw new Error(`Failed to capture screen: ${error.message}. Check that the source ID is correct and permission is granted.`);
      });

      console.log('[Recording] Screen stream obtained successfully');
      console.log('[Recording] Stream details:', {
        videoTracks: screenStream.getVideoTracks().length,
        audioTracks: screenStream.getAudioTracks().length
      });

      // Log video track info to verify it's screen, not webcam
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log('[Recording] Video track info:', {
          label: videoTrack.label,
          kind: videoTrack.kind,
          width: settings.width,
          height: settings.height,
          frameRate: settings.frameRate,
          deviceId: settings.deviceId
        });
        
        // WARNING: If label contains "camera" or "webcam", we captured wrong device!
        if (videoTrack.label.toLowerCase().includes('camera') || 
            videoTrack.label.toLowerCase().includes('webcam')) {
          console.error('[Recording] WARNING: Captured webcam instead of screen!');
          console.error('[Recording] Video track label:', videoTrack.label);
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
        console.warn('Stopping recording:', reason);
        this.stopRecording();
      });
      
      // Set max duration timer
      this.maxDurationTimer = setTimeout(() => {
        console.log('Max duration reached');
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
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve();
        return;
      }
      
      // Stop media recorder (this will trigger onstop handler)
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
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      const duration = (Date.now() - this.startTime) / 1000;
      
      // Save to temporary location
      console.log('[Recording] Saving blob to file...');
      const tempPath = await this.saveBlobToFile(blob);
      console.log('[Recording] File saved to:', tempPath);
      
      // Log success with metrics
      this.diagnostics.logRecordingSuccess(duration, blob.size, tempPath);
      
      // Callback with file path (BEFORE cleanup to preserve callbacks)
      console.log('[Recording] Calling onComplete callback with path:', tempPath);
      console.log('[Recording] Callbacks object:', this.callbacks);
      console.log('[Recording] onComplete exists?', !!this.callbacks.onComplete);
      if (this.callbacks.onComplete) {
        console.log('[Recording] onComplete callback exists, calling it now...');
        try {
          await this.callbacks.onComplete(tempPath);
          console.log('[Recording] onComplete callback finished successfully');
        } catch (callbackError) {
          console.error('[Recording] onComplete callback failed:', callbackError);
        }
      } else {
        console.warn('[Recording] No onComplete callback registered!');
        console.warn('[Recording] Available callbacks:', Object.keys(this.callbacks));
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
    console.log('[Recording] saveBlobToFile called with blob size:', blob.size);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          console.log('[Recording] FileReader loaded, processing buffer...');
          const buffer = reader.result;
          const timestamp = Date.now();
          const fileName = `Recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
          
          // Get recordings directory
          const recordingsDir = await window.electronAPI.getAppPath('userData');
          const recordingsPath = `${recordingsDir}/Recordings`;
          const filePath = `${recordingsPath}/${fileName}`;
          console.log('[Recording] User data dir:', recordingsDir);
          console.log('[Recording] Recordings dir:', recordingsPath);
          console.log('[Recording] Writing file to:', filePath);
          
          // Write the file (this should create the directory if needed)
          await window.electronAPI.fileSystem.writeFile(filePath, new Uint8Array(buffer));
          
          console.log('[Recording] File written successfully');
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
        console.warn('Stopping recording:', reason);
        this.stopRecording();
      });
      
      // Set max duration timer
      this.maxDurationTimer = setTimeout(() => {
        console.log('Max duration reached');
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
      console.log('[Composite] Starting composite recording');
      console.log('[Composite] Screen source:', screenSource.name);
      console.log('[Composite] Webcam source:', webcamSource.label);
      
      // Validate requirements
      const validation = await this.validateRecordingRequirements(screenSource, microphoneSource);
      if (!validation.valid) {
        const errorMsg = 'Composite recording validation failed:\n• ' + validation.errors.join('\n• ');
        throw new Error(errorMsg);
      }
      
      // Get screen stream
      const videoConstraints = this.getVideoConstraints(quality);
      console.log('[Composite] Screen video constraints:', videoConstraints);
      
      const screenStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: screenSource.id
          }
        }
      });
      console.log('[Composite] Screen stream obtained');
      
      // Get webcam stream with fixed 720p
      console.log('[Composite] Requesting webcam stream (fixed 720p)');
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: webcamSource.deviceId,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      console.log('[Composite] Webcam stream obtained');
      
      // Create off-screen canvas for composition
      const canvas = document.createElement('canvas');
      canvas.width = videoConstraints.width.ideal;
      canvas.height = videoConstraints.height.ideal;
      console.log('[Composite] Canvas created:', canvas.width, 'x', canvas.height);
      
      // Initialize compositor
      const compositor = new VideoCompositor();
      compositor.init(canvas);
      await compositor.setScreenStream(screenStream);
      await compositor.setWebcamStream(webcamStream);
      compositor.startComposition();
      console.log('[Composite] Composition started');
      
      // Get composite stream from canvas
      this.recordingStream = compositor.getCompositeStream();
      console.log('[Composite] Composite stream created');
      
      // Store compositor for cleanup
      this.compositor = compositor;
      this.screenStream = screenStream;
      this.webcamStream = webcamStream;
      
      // Get microphone stream if selected
      if (microphoneSource) {
        console.log('[Composite] Adding microphone audio');
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
        console.log('Max duration reached');
        this.stopRecording();
      }, this.MAX_DURATION);
      
      console.log('[Composite] Recording started successfully');
      
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
    console.log('[Recording] Starting cleanup...');
    
    // Stop compositor if active
    if (this.compositor) {
      console.log('[Recording] Cleaning up compositor');
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
      console.log('[Recording] Stopping', tracks.length, 'track(s) from recording stream');
      tracks.forEach(track => {
        console.log('  - Stopping track:', track.kind, track.label, 'readyState:', track.readyState);
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
        console.log('[Recording] Stopping active MediaRecorder, state:', this.mediaRecorder.state);
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
      console.log('[Recording] Clearing', this.recordedChunks.length, 'recorded chunks');
      this.recordedChunks = [];
    }
    
    this.startTime = null;
    this.callbacks = {};
    
    console.log('[Recording] Cleanup complete');
  }
}
