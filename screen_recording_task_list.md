# Screen Recording Implementation PRD

## Executive Summary

This PRD outlines the complete technical specification for reliable screen recording in the Forge application using Electron's `desktopCapturer` API. The implementation is broken into 5 sequential pull requests that build upon each other to ensure robust error handling and reliable screen recording functionality.

---

## Current State Analysis

### Files Involved
- `src/main/index.js` - IPC handlers for `desktopCapturer`
- `src/main/recordingHandler.js` - Permission checking
- `src/main/preload.js` - Context bridge APIs
- `src/shared/screenRecorder.js` - Recording logic
- `src/renderer/components/RecordingPanel.vue` - UI and orchestration
- `src/renderer/stores/clipforge/recordingStore.js` - State management

### Current Flow
1. Main process uses `desktopCapturer.getSources()` to list screens/windows
2. Sources with thumbnails sent to renderer via IPC
3. User selects source in UI
4. Renderer calls `navigator.mediaDevices.getUserMedia()` with `chromeMediaSource: 'desktop'`
5. MediaRecorder captures stream to WebM
6. Conversion to MP4 via FFmpeg after recording

### Known Issues
- Permission API can report false negatives on macOS
- Complex workaround logic needed for permission detection
- Error messages not always clear to users
- No comprehensive validation before recording starts

---

## Pull Request Breakdown

### PR #1: Enhanced Permission Detection & Validation

**Objective**: Fix permission detection issues and add comprehensive pre-recording validation.

**Files to Modify**:
- `src/main/recordingHandler.js`
- `src/shared/screenRecorder.js`
- `src/renderer/components/RecordingPanel.vue`

**Changes**:

#### 1. Update `recordingHandler.js` - Improved Permission Detection

Replace the `checkPermissions()` method:

```javascript
async checkPermissions() {
  const permissions = {
    screen: true,
    microphone: true
  };

  if (this.platform === 'darwin') {
    try {
      const screenStatus = systemPreferences.getMediaAccessStatus('screen');
      const micStatus = systemPreferences.getMediaAccessStatus('microphone');
      
      // API can return false negatives - verify with actual capability test
      let hasScreenPermission = screenStatus === 'granted';
      
      if (!hasScreenPermission) {
        // Test actual capability by trying to get sources
        const { desktopCapturer } = require('electron');
        const testSources = await desktopCapturer.getSources({ 
          types: ['screen'], 
          thumbnailSize: { width: 10, height: 10 } 
        });
        hasScreenPermission = testSources.length > 0;
        
        console.log('Permission check - API says:', screenStatus, '| Actual capability:', hasScreenPermission);
      }
      
      permissions.screen = hasScreenPermission;
      permissions.microphone = micStatus === 'granted';
      
    } catch (error) {
      console.error('Permission check error:', error);
      // On error, default to true and let actual recording attempt fail with better error
      permissions.screen = true;
      permissions.microphone = true;
    }
  } else if (this.platform === 'win32') {
    // Windows - permissions handled differently
    permissions.screen = true;
    permissions.microphone = true;
  }

  return permissions;
}
```

#### 2. Add validation method to `screenRecorder.js`

Add new method before `startScreenRecording()`:

```javascript
async validateRecordingRequirements(screenSource, microphoneSource) {
  const errors = [];
  
  // 1. Check permissions
  const permissions = await this.checkPermissions();
  if (!permissions.screen) {
    errors.push({
      code: 'PERMISSION_DENIED',
      message: 'Screen recording permission required'
    });
  }
  if (microphoneSource && !permissions.microphone) {
    errors.push({
      code: 'MICROPHONE_PERMISSION_DENIED',
      message: 'Microphone permission required'
    });
  }
  
  // 2. Check disk space
  const diskSpace = await this.checkDiskSpace();
  if (diskSpace < 5 * 1024 * 1024 * 1024) {
    errors.push({
      code: 'INSUFFICIENT_SPACE',
      message: `Need at least 5GB free disk space. Available: ${(diskSpace / 1024 / 1024 / 1024).toFixed(2)}GB`
    });
  }
  
  // 3. Validate source selection
  if (!screenSource || !screenSource.id) {
    errors.push({
      code: 'NO_SOURCE_SELECTED',
      message: 'Please select a screen or window to record'
    });
  }
  
  // 4. Test codec support
  const supportedCodec = this.findSupportedCodec();
  if (!supportedCodec) {
    errors.push({
      code: 'CODEC_NOT_SUPPORTED',
      message: 'Video recording not supported in this environment'
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

findSupportedCodec() {
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  
  return null;
}
```

#### 3. Update `startScreenRecording()` in `screenRecorder.js`

Add validation at the start:

```javascript
async startScreenRecording(screenSource, microphoneSource, quality, callbacks) {
  this.callbacks = callbacks;
  
  try {
    // Validate requirements before starting
    const validation = await this.validateRecordingRequirements(screenSource, microphoneSource);
    if (!validation.valid) {
      const errorMessage = validation.errors.map(e => e.message).join('\n');
      throw new Error(errorMessage);
    }
    
    console.log('[Recording] Validation passed, starting recording');
    console.log('[Recording] Source:', { id: screenSource.id, name: screenSource.name });
    
    // ... rest of existing code
```

#### 4. Update `RecordingPanel.vue` - Add validation feedback

In the `startRecording()` method, add validation feedback:

```javascript
const startRecording = async () => {
  try {
    // Show initializing state
    recordingStore.setError(null);
    
    // Force a fresh permission check before recording
    await checkPermissionsSilently();
    
    // Final permission check
    if (!recordingStore.hasScreenPermission) {
      console.error('Screen permission not granted - cannot start recording');
      showPermissionModal.value = true;
      return;
    }
    
    if (recordingStore.selectedMicrophoneSource && !recordingStore.hasMicrophonePermission) {
      console.error('Microphone permission not granted - cannot start recording');
      showPermissionModal.value = true;
      return;
    }
    
    // ... rest of existing code
```

**Testing**:
- Test permission detection on macOS (grant/deny scenarios)
- Test with insufficient disk space
- Test with no source selected
- Test on Windows

---

### PR #2: Diagnostic Logging & Error Tracking

**Objective**: Add comprehensive logging and error tracking for debugging and monitoring.

**Files to Modify**:
- `src/shared/screenRecorder.js`
- `src/renderer/stores/clipforge/recordingStore.js`

**Changes**:

#### 1. Add diagnostics class to `screenRecorder.js`

Add at the top of the file:

```javascript
class ScreenRecordingDiagnostics {
  logRecordingAttempt(source, options) {
    console.log('[Recording] Attempt:', {
      timestamp: new Date().toISOString(),
      sourceId: source?.id,
      sourceName: source?.name,
      sourceType: source?.type,
      quality: options?.quality,
      hasMicrophone: !!options?.microphoneSource,
      microphoneLabel: options?.microphoneSource?.label
    });
  }
  
  logRecordingSuccess(duration, fileSize, filePath) {
    console.log('[Recording] Success:', {
      duration: `${duration.toFixed(2)}s`,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      filePath,
      timestamp: new Date().toISOString()
    });
  }
  
  logRecordingError(error, context) {
    console.error('[Recording] Error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }
  
  logStreamInfo(stream) {
    const videoTrack = stream.getVideoTracks()[0];
    const audioTracks = stream.getAudioTracks();
    
    console.log('[Recording] Stream Info:', {
      videoTrack: videoTrack ? {
        id: videoTrack.id,
        label: videoTrack.label,
        enabled: videoTrack.enabled,
        muted: videoTrack.muted,
        readyState: videoTrack.readyState,
        settings: videoTrack.getSettings()
      } : null,
      audioTracks: audioTracks.map(track => ({
        id: track.id,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState
      }))
    });
  }
}
```

#### 2. Use diagnostics in `ScreenRecorder` class

Add property to constructor:

```javascript
constructor() {
  // ... existing properties
  this.diagnostics = new ScreenRecordingDiagnostics();
}
```

Update `startScreenRecording()`:

```javascript
async startScreenRecording(screenSource, microphoneSource, quality, callbacks) {
  this.callbacks = callbacks;
  
  try {
    // Log attempt
    this.diagnostics.logRecordingAttempt(screenSource, { quality, microphoneSource });
    
    // Validate requirements before starting
    const validation = await this.validateRecordingRequirements(screenSource, microphoneSource);
    if (!validation.valid) {
      const errorMessage = validation.errors.map(e => e.message).join('\n');
      throw new Error(errorMessage);
    }
    
    // ... existing code to get stream ...
    
    // Log stream info
    this.diagnostics.logStreamInfo(this.recordingStream);
    
    // ... rest of code
    
  } catch (error) {
    this.diagnostics.logRecordingError(error, {
      screenSource,
      microphoneSource,
      quality
    });
    // ... existing error handling
  }
}
```

Update `handleRecordingComplete()`:

```javascript
async handleRecordingComplete() {
  try {
    // ... existing code to create blob ...
    
    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const duration = (Date.now() - this.startTime) / 1000;
    
    // Log success
    this.diagnostics.logRecordingSuccess(duration, blob.size, tempPath);
    
    // ... rest of existing code
```

#### 3. Add error tracking to `recordingStore.js`

Add new state:

```javascript
const errorCount = ref(0);
const lastErrorTime = ref(null);
const consecutiveErrors = ref(0);
```

Add new action:

```javascript
const recordError = (error) => {
  errorCount.value++;
  lastErrorTime.value = Date.now();
  lastError.value = error;
  
  // Track consecutive errors (reset if more than 5 minutes between errors)
  if (lastErrorTime.value && (Date.now() - lastErrorTime.value) < 300000) {
    consecutiveErrors.value++;
  } else {
    consecutiveErrors.value = 1;
  }
  
  console.error('[RecordingStore] Error recorded:', {
    error,
    errorCount: errorCount.value,
    consecutiveErrors: consecutiveErrors.value
  });
};

const clearErrorTracking = () => {
  consecutiveErrors.value = 0;
  lastError.value = null;
};
```

Export in return statement and use in `RecordingPanel.vue`.

**Testing**:
- Verify logs appear in console with correct format
- Test error tracking with multiple failures
- Verify stream info logs correctly

---

### PR #3: Enhanced Error Messages & Recovery

**Objective**: Improve error messages and add recovery mechanisms.

**Files to Modify**:
- `src/shared/screenRecorder.js`
- `src/renderer/components/RecordingPanel.vue`

**Changes**:

#### 1. Add error message constants to `screenRecorder.js`

Add at top of file:

```javascript
const ERROR_MESSAGES = {
  PERMISSION_DENIED: {
    title: 'Screen Recording Permission Required',
    message: 'Please grant screen recording permission in System Preferences.',
    action: 'Open System Preferences',
    canRetry: true
  },
  
  MICROPHONE_PERMISSION_DENIED: {
    title: 'Microphone Permission Required',
    message: 'Please grant microphone permission to record audio.',
    action: 'Open System Preferences',
    canRetry: true
  },
  
  SOURCE_NOT_FOUND: {
    title: 'Screen Source Unavailable',
    message: 'The selected window or screen is no longer available. Please select another source.',
    action: 'Refresh Sources',
    canRetry: true
  },
  
  DEVICE_IN_USE: {
    title: 'Screen Capture In Use',
    message: 'Another application is using screen recording. Close other recording apps and try again.',
    action: 'Retry',
    canRetry: true
  },
  
  INSUFFICIENT_SPACE: {
    title: 'Not Enough Disk Space',
    message: 'Please free up at least 5GB of disk space before recording.',
    action: 'OK',
    canRetry: false
  },
  
  CODEC_NOT_SUPPORTED: {
    title: 'Recording Not Supported',
    message: 'Video recording is not supported. Please update the application.',
    action: 'OK',
    canRetry: false
  },
  
  STREAM_ERROR: {
    title: 'Unable to Access Screen',
    message: 'Could not access the screen for recording. Please try again.',
    action: 'Retry',
    canRetry: true
  }
};

export { ERROR_MESSAGES };
```

#### 2. Add error parsing method

```javascript
parseRecordingError(error) {
  // Map error types to user-friendly messages
  if (error.message.includes('permission') || error.name === 'NotAllowedError') {
    return ERROR_MESSAGES.PERMISSION_DENIED;
  }
  
  if (error.message.includes('NotFoundError') || error.message.includes('no longer available')) {
    return ERROR_MESSAGES.SOURCE_NOT_FOUND;
  }
  
  if (error.name === 'NotReadableError') {
    return ERROR_MESSAGES.DEVICE_IN_USE;
  }
  
  if (error.message.includes('disk space')) {
    return ERROR_MESSAGES.INSUFFICIENT_SPACE;
  }
  
  if (error.message.includes('codec') || error.message.includes('not supported')) {
    return ERROR_MESSAGES.CODEC_NOT_SUPPORTED;
  }
  
  // Default error
  return {
    title: 'Recording Error',
    message: error.message || 'An unexpected error occurred while recording.',
    action: 'Retry',
    canRetry: true
  };
}
```

#### 3. Update `RecordingPanel.vue` error handling

Add method to display errors:

```javascript
const showRecordingError = async (error) => {
  const errorInfo = screenRecorder.parseRecordingError(error);
  
  const result = await window.electronAPI.dialog.showMessageBox({
    type: 'error',
    title: errorInfo.title,
    message: errorInfo.message,
    buttons: errorInfo.canRetry ? [errorInfo.action, 'Cancel'] : ['OK'],
    defaultId: 0
  });
  
  // Handle action button
  if (result.response === 0) {
    if (errorInfo.action === 'Open System Preferences') {
      await window.electronAPI.recording.openSystemSettings();
      // Recheck permissions after 2 seconds
      setTimeout(() => checkPermissionsSilently(), 2000);
    } else if (errorInfo.action === 'Refresh Sources') {
      await refreshSources();
    } else if (errorInfo.action === 'Retry') {
      // Allow user to try again
      recordingStore.clearError();
    }
  }
};
```

Update error callbacks:

```javascript
const startRecording = async () => {
  try {
    // ... existing validation code ...
    
    await screenRecorder.startScreenRecording(
      recordingStore.selectedScreenSource,
      recordingStore.selectedMicrophoneSource,
      recordingStore.recordingQuality,
      {
        onStart: () => {
          recordingStore.startRecording('screen', recordingId);
          minimizePanel();
        },
        onProgress: (duration) => {
          recordingStore.updateDuration(duration);
        },
        onAudioLevel: (level) => {
          recordingStore.updateAudioLevel(level);
        },
        onComplete: async (filePath) => {
          await handleRecordingComplete(filePath);
        },
        onError: async (error) => {
          console.error('Recording error:', error);
          recordingStore.recordError(error.message);
          recordingStore.stopRecording();
          await window.electronAPI.recording.setRecordingState(false);
          await showRecordingError(error);
        }
      }
    );
    
  } catch (error) {
    console.error('Failed to start recording:', error);
    recordingStore.recordError(error.message);
    await showRecordingError(error);
  }
};
```

**Testing**:
- Test each error scenario and verify correct message appears
- Test "Open System Preferences" action
- Test "Refresh Sources" action
- Test retry functionality

---

### PR #4: Improved getUserMedia Configuration

**Objective**: Fix and optimize the getUserMedia constraints for better compatibility.

**Files to Modify**:
- `src/shared/screenRecorder.js`

**Changes**:

#### 1. Update video constraints in `startScreenRecording()`

Replace the getUserMedia call:

```javascript
// Get screen stream with proper constraints
const videoConstraints = this.getVideoConstraints(quality);
console.log('[Recording] Requesting screen stream with constraints:', videoConstraints);

// Use the correct Electron API format for screen capture
const screenStream = await navigator.mediaDevices.getUserMedia({
  audio: false,
  video: {
    mandatory: {
      chromeMediaSource: 'desktop',
      chromeMediaSourceId: screenSource.id,
      minWidth: videoConstraints.width.ideal,
      maxWidth: videoConstraints.width.ideal,
      minHeight: videoConstraints.height.ideal,
      maxHeight: videoConstraints.height.ideal,
      minFrameRate: 30,
      maxFrameRate: 60
    }
  }
}).catch(error => {
  // If mandatory constraints fail, try with ideal constraints
  console.warn('[Recording] Mandatory constraints failed, trying ideal constraints:', error);
  
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      chromeMediaSource: 'desktop',
      chromeMediaSourceId: screenSource.id,
      width: videoConstraints.width,
      height: videoConstraints.height,
      frameRate: { ideal: 30, max: 60 }
    }
  });
});

console.log('[Recording] Screen stream obtained successfully');
this.diagnostics.logStreamInfo(screenStream);
```

#### 2. Improve codec selection in `startMediaRecorder()`

Update the codec selection:

```javascript
async startMediaRecorder(stream) {
  return new Promise((resolve, reject) => {
    try {
      // Find best supported codec
      const supportedCodec = this.findSupportedCodec();
      
      if (!supportedCodec) {
        reject(new Error('No supported video codec found. Please update your Electron version.'));
        return;
      }
      
      console.log('[Recording] Using codec:', supportedCodec);
      
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedCodec,
        videoBitsPerSecond: 5000000 // 5 Mbps
      });
      
      this.recordedChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
          console.log('[Recording] Data chunk received:', event.data.size, 'bytes');
        }
      };
      
      this.mediaRecorder.onstop = async () => {
        console.log('[Recording] MediaRecorder stopped, total chunks:', this.recordedChunks.length);
        await this.handleRecordingComplete();
      };
      
      this.mediaRecorder.onerror = (event) => {
        console.error('[Recording] MediaRecorder error:', event.error);
        if (this.callbacks.onError) {
          this.callbacks.onError(event.error);
        }
      };
      
      this.startTime = Date.now();
      this.mediaRecorder.start(1000); // Collect data every second
      
      console.log('[Recording] MediaRecorder started successfully');
      resolve();
      
    } catch (error) {
      console.error('[Recording] Failed to start MediaRecorder:', error);
      reject(error);
    }
  });
}
```

#### 3. Add stream validation

Add method to validate stream before recording:

```javascript
validateStream(stream) {
  const videoTracks = stream.getVideoTracks();
  
  if (videoTracks.length === 0) {
    throw new Error('No video track in stream');
  }
  
  const videoTrack = videoTracks[0];
  
  if (videoTrack.readyState !== 'live') {
    throw new Error(`Video track not ready: ${videoTrack.readyState}`);
  }
  
  const settings = videoTrack.getSettings();
  console.log('[Recording] Video track settings:', settings);
  
  return true;
}
```

Call in `startScreenRecording()` after getting stream:

```javascript
this.recordingStream = screenStream;

// Validate stream before proceeding
this.validateStream(this.recordingStream);
```

**Testing**:
- Test with different quality settings (high, medium, low)
- Test on screens with different resolutions
- Verify codec fallback works
- Test stream validation catches issues

---

### PR #5: Cleanup & Resource Management

**Objective**: Ensure proper cleanup of resources and prevent memory leaks.

**Files to Modify**:
- `src/shared/screenRecorder.js`
- `src/renderer/components/RecordingPanel.vue`

**Changes**:

#### 1. Enhance cleanup method in `screenRecorder.js`

Replace `cleanup()` method:

```javascript
cleanup() {
  console.log('[Recording] Cleaning up resources...');
  
  // Stop all streams
  if (this.recordingStream) {
    this.recordingStream.getTracks().forEach(track => {
      console.log('[Recording] Stopping track:', track.kind, track.label);
      track.stop();
    });
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
    // Don't call stop here as it might already be stopped
    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;
  }

  // Clear chunks if recording failed
  if (this.recordedChunks.length > 0) {
    console.log('[Recording] Clearing', this.recordedChunks.length, 'chunks');
  }
  this.recordedChunks = [];
  this.startTime = null;
  
  console.log('[Recording] Cleanup complete');
}
```

#### 2. Add graceful stop for failed recordings

Add method:

```javascript
async stopRecordingWithError(error) {
  console.error('[Recording] Stopping due to error:', error);
  
  try {
    // Try to save partial recording if we have data
    if (this.recordedChunks.length > 0 && this.startTime) {
      console.log('[Recording] Attempting to save partial recording...');
      
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      if (blob.size > 0) {
        const tempPath = await this.saveBlobToFile(blob);
        console.log('[Recording] Partial recording saved:', tempPath);
        
        if (this.callbacks.onComplete) {
          this.callbacks.onComplete(tempPath);
        }
      }
    }
  } catch (saveError) {
    console.error('[Recording] Failed to save partial recording:', saveError);
  }
  
  // Clean up all resources
  this.cleanup();
  
  // Notify of error
  if (this.callbacks.onError) {
    this.callbacks.onError(error);
  }
}
```

#### 3. Update error handlers to use graceful stop

In `startScreenRecording()` catch block:

```javascript
catch (error) {
  this.diagnostics.logRecordingError(error, {
    screenSource,
    microphoneSource,
    quality
  });
  
  // Use graceful stop instead of just cleanup
  await this.stopRecordingWithError(error);
  throw error;
}
```

#### 4. Add source validation before recording

Add method:

```javascript
async validateSourceStillAvailable(sourceId) {
  try {
    const sources = await window.electronAPI.recording.getDesktopSources();
    const sourceExists = sources.some(s => s.id === sourceId);
    
    if (!sourceExists) {
      throw new Error('SOURCE_NOT_FOUND');
    }
    
    return true;
  } catch (error) {
    console.error('[Recording] Source validation failed:', error);
    throw error;
  }
}
```

Call before starting stream:

```javascript
async startScreenRecording(screenSource, microphoneSource, quality, callbacks) {
  this.callbacks = callbacks;
  
  try {
    this.diagnostics.logRecordingAttempt(screenSource, { quality, microphoneSource });
    
    // Validate requirements
    const validation = await this.validateRecordingRequirements(screenSource, microphoneSource);
    if (!validation.valid) {
      const errorMessage = validation.errors.map(e => e.message).join('\n');
      throw new Error(errorMessage);
    }
    
    // Validate source still exists
    await this.validateSourceStillAvailable(screenSource.id);
    
    // ... rest of code
```

#### 5. Update `RecordingPanel.vue` cleanup on unmount

Ensure proper cleanup:

```javascript
onUnmounted(() => {
  console.log('[RecordingPanel] Component unmounting, cleaning up...');
  
  // Stop webcam preview
  stopWebcamPreview();
  
  // Clean up screen recorder
  if (screenRecorder) {
    screenRecorder.cleanup();
    screenRecorder.cleanupAudioMonitoring();
  }
  
  // Cleanup focus listener
  if (window._recordingPanelCleanup) {
    window._recordingPanelCleanup();
  }
  
  // Reset initialization flag
  window._recordingPanelInitialized = false;
  
  console.log('[RecordingPanel] Cleanup complete');
});
```

**Testing**:
- Test cleanup when recording is stopped normally
- Test cleanup when recording fails
- Test cleanup when component unmounts during recording
- Verify no memory leaks with multiple record/stop cycles
- Test partial recording save when errors occur

---

## Acceptance Criteria

After all 5 PRs are implemented:

### Functional Requirements
- [ ] Screen recording starts without errors on macOS and Windows
- [ ] Source list populates with screens and windows
- [ ] Thumbnail previews display correctly
- [ ] Recording captures video at selected quality
- [ ] Microphone audio syncs with video
- [ ] Recording stops cleanly and saves file
- [ ] WebM converts to MP4 successfully
- [ ] Recording imports to media library automatically

### Error Handling Requirements
- [ ] Permission errors show helpful modal with "Open Settings" button
- [ ] Source unavailable errors refresh source list
- [ ] Stream errors clean up resources properly
- [ ] Disk space warnings prevent recording start
- [ ] Low disk space during recording triggers graceful stop
- [ ] All errors display user-friendly messages
- [ ] Failed recordings don't crash the app

### Non-Functional Requirements
- [ ] Existing recording functionality unaffected
- [ ] No performance degradation in other app features
- [ ] Clean error recovery without memory leaks
- [ ] Code changes are well-documented with console logs

---

## Testing Checklist

### Permission Testing (macOS)
- [ ] Test with screen recording permission denied
- [ ] Test with screen recording permission granted
- [ ] Test with microphone permission denied
- [ ] Test with microphone permission granted
- [ ] Test "Open System Preferences" button works

### Source Selection
- [ ] Test selecting different screens
- [ ] Test selecting different windows
- [ ] Test refreshing source list
- [ ] Test when selected source closes/unavailable

### Recording Scenarios
- [ ] Test short recording (30 seconds)
- [ ] Test long recording (5+ minutes)
- [ ] Test with microphone enabled
- [ ] Test with microphone disabled
- [ ] Test different quality settings
- [ ] Test stopping recording manually
- [ ] Test 2-hour limit auto-stop

### Error Scenarios
- [ ] Test insufficient disk space
- [ ] Test source disappears during recording
- [ ] Test closing selected window before recording
- [ ] Test device in use by another app
- [ ] Test network drive with slow write speeds

### Cleanup & Memory
- [ ] Test multiple record/stop cycles
- [ ] Monitor memory usage doesn't grow
- [ ] Test unmounting component during recording
- [ ] Verify all streams/intervals cleaned up
- [ ] Test partial recording save on error

---

## Implementation Order

1. **PR #1** - Foundation for reliability (validation & permission detection)
2. **PR #2** - Observability for debugging issues
3. **PR #3** - User experience improvements (error messages)
4. **PR #4** - Core recording stability (getUserMedia optimization)
5. **PR #5** - Resource management and cleanup

Each PR builds on the previous one and can be tested independently.

