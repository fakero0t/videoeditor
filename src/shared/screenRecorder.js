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

  // Start screen recording
  async startScreenRecording(screenSource, microphoneSource, quality, callbacks) {
    this.callbacks = callbacks;
    
    try {
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
      console.log('Video constraints:', videoConstraints);
      
      // Use the correct Electron API format for screen capture
      const screenStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: screenSource.id,
          width: videoConstraints.width,
          height: videoConstraints.height
        }
      });
      
      console.log('Screen stream obtained:', {
        videoTracks: screenStream.getVideoTracks().length,
        audioTracks: screenStream.getAudioTracks().length
      });
      
      this.recordingStream = screenStream;
      
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
      
      // Save to temporary location
      const tempPath = await this.saveBlobToFile(blob);
      
      // Cleanup streams
      this.cleanup();
      
      // Callback with file path
      if (this.callbacks.onComplete) {
        this.callbacks.onComplete(tempPath);
      }
      
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
          const filePath = `${recordingsDir}/Recordings/${fileName}`;
          
          // Create recordings directory if needed
          await window.electronAPI.fileSystem.writeFile(filePath, new Uint8Array(buffer));
          
          resolve(filePath);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = reject;
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

  cleanup() {
    // Stop all streams
    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach(track => track.stop());
      this.recordingStream = null;
    }
    
    // Clean up audio monitoring
    this.cleanupAudioMonitoring();

    // Clear intervals
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

    // Clear recorder
    if (this.mediaRecorder) {
      this.mediaRecorder = null;
    }

    this.recordedChunks = [];
    this.startTime = null;
  }
}
