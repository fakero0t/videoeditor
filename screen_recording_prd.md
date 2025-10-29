# Screen Recording Fix PRD

## Executive Summary

Screen recording is currently broken - when user selects a screen source, the webcam records instead of the screen. This is caused by incorrect `getUserMedia` constraints format. This PRD outlines 3 focused pull requests to fix the core issue and add reliability improvements.

---

## Problem Statement

**Current Bug**: When user selects screen/window source and clicks "Start Recording", the webcam video is captured instead of the selected screen.

**Root Cause**: The `getUserMedia` constraints in `src/shared/screenRecorder.js` (lines 73-81) are not using the correct format for Electron's desktopCapturer integration. When constraints are malformed, getUserMedia falls back to the default video input device (webcam).

**Files Involved**:
- `src/shared/screenRecorder.js` - Contains broken getUserMedia call (lines 73-81)
- `src/main/index.js` - IPC handler for desktopCapturer (lines 438-457) - **NO CHANGES NEEDED**
- `src/renderer/components/RecordingPanel.vue` - UI and error handling

---

## Pull Request Breakdown

### PR #1: Fix Screen Capture Constraints (CRITICAL BUG FIX)

**Objective**: Fix the getUserMedia constraints so screen recording captures the selected screen instead of webcam.

**File to Modify**: `src/shared/screenRecorder.js`

**The Bug** (lines 73-81):

```javascript
// CURRENT BROKEN CODE
const screenStream = await navigator.mediaDevices.getUserMedia({
  audio: false,
  video: {
    chromeMediaSource: 'desktop',
    chromeMediaSourceId: screenSource.id,
    width: videoConstraints.width,
    height: videoConstraints.height
  }
});
```

**Why it's broken**: 
- In Electron, `chromeMediaSource` and `chromeMediaSourceId` MUST be inside a `mandatory` object
- Without `mandatory`, these Chromium-specific constraints are ignored
- getUserMedia then falls back to default video device (webcam)
- The `width` and `height` constraints from `getVideoConstraints()` return objects like `{ ideal: 1920 }` which work, but the chrome-specific ones need mandatory

**The Fix**:

**REPLACE lines 68-86** with:

```javascript
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

// CRITICAL FIX: Use mandatory object for Electron desktopCapturer
const screenStream = await navigator.mediaDevices.getUserMedia({
  audio: false,
  video: {
    mandatory: {
      chromeMediaSource: 'desktop',
      chromeMediaSourceId: screenSource.id,
      minWidth: videoConstraints.width.ideal || 1280,
      maxWidth: videoConstraints.width.ideal || 1920,
      minHeight: videoConstraints.height.ideal || 720,
      maxHeight: videoConstraints.height.ideal || 1080
    }
  }
}).catch(async (error) => {
  console.error('[Recording] Screen capture getUserMedia failed');
  console.error('[Recording] Error details:', {
    name: error.name,
    message: error.message,
    constraint: error.constraint
  });
  console.error('[Recording] Attempted with source:', {
    id: screenSource.id,
    name: screenSource.name,
    type: screenSource.type
  });
  
  throw new Error(`Failed to capture screen: ${error.message}`);
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
```

**Testing**:
1. Open recording panel
2. **FIRST: Verify sources load**:
   - Check console for successful source fetch
   - Verify source list shows screens and windows with thumbnails
   - If NO sources appear, check System Preferences > Privacy > Screen Recording
3. Select a screen source (NOT webcam tab)
4. **Verify preview**: Should show thumbnail image of selected screen
5. Click "Start Recording"
6. **Check console for**: `[Recording] Screen stream obtained successfully`
7. **Check console for**: Video track info should NOT show "FaceTime" or "camera" in label
8. **Check console for**: Width/height should match screen resolution (e.g., 1920x1080)
9. **If you see WARNING about webcam**: The fix didn't work, constraints still wrong
10. Record 10 seconds, stop, verify saved video shows screen content

**If NO sources appear in list**: 
- macOS: System Preferences > Security & Privacy > Screen Recording > Check your app
- Try clicking "Refresh" button
- Check console for errors from `desktopCapturer`

**If still capturing webcam after this fix**: 
- Check if source.id format is correct (should be "screen:0:0" or "window:123:456")
- Check Electron version (should be 28.x based on package.json)
- Verify selected source is screen, not accidentally selecting webcam tab

---

### PR #2: Enhanced Error Handling & Diagnostics

**Objective**: Add comprehensive error handling and logging to quickly identify any remaining issues.

**Files to Modify**:
- `src/shared/screenRecorder.js`
- `src/renderer/components/RecordingPanel.vue`

**Changes**:

#### 1. Verify main process IPC handler (NO CHANGES NEEDED)

**In `src/main/index.js` lines 438-457**, verify this code exists and is correct:

```javascript
ipcMain.handle('recording:getDesktopSources', async () => {
  const { desktopCapturer } = require('electron');
  
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 150, height: 150 }
    });
    
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      type: source.id.startsWith('screen') ? 'screen' : 'window'
    }));
  } catch (error) {
    console.error('Failed to get desktop sources:', error);
    throw error;
  }
});
```

**This code is already correct** - it properly fetches sources with thumbnails and returns them with the correct ID format. If sources aren't appearing, it's a permission issue, not a code issue.

#### 2. Add diagnostic logging class to `screenRecorder.js`

**INSERT at line 1** (before the ScreenRecorder class export):

```javascript
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

```

#### 2. Add diagnostics property to ScreenRecorder constructor

**MODIFY the constructor** (around line 2-23, after adding the diagnostics class above):

```javascript
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
    
    // ADD THIS LINE:
    this.diagnostics = new ScreenRecordingDiagnostics();
    
    // Callbacks
    this.callbacks = {};
    
    // 2 hour max duration
    this.MAX_DURATION = 2 * 60 * 60 * 1000; // milliseconds
    this.maxDurationTimer = null;
    
    // Disk space monitoring
    this.MIN_DISK_SPACE = 500 * 1024 * 1024; // 500MB
  }
```

#### 3. Use diagnostics in startScreenRecording method

**REPLACE lines 49-52** with:

```javascript
async startScreenRecording(screenSource, microphoneSource, quality, callbacks) {
  this.callbacks = callbacks;
  
  try {
    // Log recording attempt with full details
    this.diagnostics.logRecordingAttempt(screenSource, { quality, microphoneSource });
    
    console.log('Starting screen recording with source:', {
      id: screenSource.id,
      name: screenSource.name,
      type: screenSource.type
    });
```

**INSERT after line 88** (right after `this.recordingStream = screenStream;`):

```javascript
this.recordingStream = screenStream;

// Log complete stream information for debugging
this.diagnostics.logStreamInfo(this.recordingStream);
```

**REPLACE lines 132-145** (the catch block) with:

```javascript
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
```

#### 4. Update handleRecordingComplete to log success

**MODIFY handleRecordingComplete** around line 289-321:

Find this section:
```javascript
// Create blob from recorded chunks
const blob = new Blob(this.recordedChunks, { type: 'video/webm' });

// Save to temporary location
const tempPath = await this.saveBlobToFile(blob);
```

**REPLACE with**:

```javascript
// Create blob from recorded chunks
const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
const duration = (Date.now() - this.startTime) / 1000;

// Save to temporary location
const tempPath = await this.saveBlobToFile(blob);

// Log success with metrics
this.diagnostics.logRecordingSuccess(duration, blob.size, tempPath);
```

#### 5. Add user-friendly error handler to RecordingPanel.vue

**INSERT after line 897** (after the `getAudioLevelColor` function):

```javascript
// User-friendly error handling
const showRecordingError = async (error) => {
  let title = 'Recording Error';
  let message = error.message || 'An unexpected error occurred while recording.';
  let showSettingsButton = false;
  
  // Parse error type and customize message
  if (error.message.includes('permission') || error.name === 'NotAllowedError') {
    title = 'Screen Recording Permission Required';
    message = 'Please grant screen recording permission in System Preferences to record your screen.';
    showSettingsButton = true;
  } else if (error.message.includes('Invalid source') || error.message.includes('source ID')) {
    title = 'Invalid Screen Source';
    message = 'The selected source cannot be recorded. Please try selecting a different screen or window.';
  } else if (error.message.includes('NotFoundError') || error.message.includes('no longer available')) {
    title = 'Screen Source Not Available';
    message = 'The selected window or screen is no longer available. Please select another source.';
  } else if (error.name === 'NotReadableError') {
    title = 'Screen Capture In Use';
    message = 'Unable to access screen recording. Another application may be using it. Close other recording apps and try again.';
  } else if (error.message.includes('Failed to capture screen')) {
    title = 'Screen Capture Failed';
    message = error.message;
  }
  
  // Show error dialog
  await window.electronAPI.dialog.showMessageBox({
    type: 'error',
    title: title,
    message: message,
    buttons: ['OK'],
    defaultId: 0
  });
  
  // Offer to open system settings for permission errors
  if (showSettingsButton) {
    const result = await window.electronAPI.dialog.showMessageBox({
      type: 'question',
      title: 'Open System Preferences?',
      message: 'Would you like to open System Preferences to grant screen recording permission?',
      buttons: ['Open Settings', 'Cancel'],
      defaultId: 0
    });
    
    if (result.response === 0) {
      await window.electronAPI.recording.openSystemSettings();
      // Recheck permissions after user returns
      setTimeout(() => checkPermissionsSilently(), 2000);
    }
  }
};
```

#### 6. Update startRecording error handler

**FIND line 793-796** (in the catch block of startRecording):

```javascript
} catch (error) {
  console.error('Failed to start recording:', error);
  recordingStore.setError(error.message);
}
```

**REPLACE with**:

```javascript
} catch (error) {
  console.error('Failed to start recording:', error);
  recordingStore.setError(error.message);
  await showRecordingError(error);
}
```

**FIND line 784-789** (in the onError callback):

```javascript
onError: async (error) => {
  console.error('Recording error:', error);
  recordingStore.setError(error.message);
  recordingStore.stopRecording();
  await window.electronAPI.recording.setRecordingState(false);
}
```

**REPLACE with**:

```javascript
onError: async (error) => {
  console.error('Recording error:', error);
  recordingStore.setError(error.message);
  recordingStore.stopRecording();
  await window.electronAPI.recording.setRecordingState(false);
  await showRecordingError(error);
}
```

**Testing**:
1. Start recording and verify console groups appear with organized logs
2. Check stream info shows correct device labels (not webcam)
3. Cause an error by removing permissions - verify user-friendly dialog appears
4. Test "Open Settings" button works
5. Verify all errors show clear messages

---

### PR #3: Validation & Cleanup Improvements

**Objective**: Add pre-recording validation and ensure proper resource cleanup.

**Files to Modify**:
- `src/shared/screenRecorder.js`
- `src/renderer/components/RecordingPanel.vue`

**Changes**:

#### 1. Add validation method to screenRecorder.js

**INSERT before startScreenRecording method** (around line 48):

```javascript
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
  
  // 2. Check permissions
  try {
    const permissions = await this.checkPermissions();
    if (!permissions.screen) {
      errors.push('Screen recording permission not granted');
    }
    if (microphoneSource && !permissions.microphone) {
      errors.push('Microphone permission not granted');
    }
  } catch (error) {
    console.warn('[Validation] Permission check failed:', error);
    // Don't block on permission check failure
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
```

#### 2. Call validation in startScreenRecording

**INSERT after the diagnostics.logRecordingAttempt call** (around line 54):

```javascript
try {
  // Log recording attempt with full details
  this.diagnostics.logRecordingAttempt(screenSource, { quality, microphoneSource });
  
  // ADD VALIDATION HERE:
  console.log('[Recording] Validating requirements...');
  const validation = await this.validateRecordingRequirements(screenSource, microphoneSource);
  if (!validation.valid) {
    const errorMsg = 'Recording validation failed:\n• ' + validation.errors.join('\n• ');
    throw new Error(errorMsg);
  }
  console.log('[Recording] Validation passed');
  
  console.log('Starting screen recording with source:', {
```

#### 3. Improve cleanup method

**REPLACE the entire cleanup method** (lines 535-567) with:

```javascript
cleanup() {
  console.log('[Recording] Starting cleanup...');
  
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
```

#### 4. Add validation feedback to RecordingPanel.vue

**MODIFY startRecording function** around line 765:

**INSERT after line 768** (after `checkPermissionsSilently()`):

```javascript
const startRecording = async () => {
  try {
    // Force a fresh permission check before recording
    await checkPermissionsSilently();
    
    // ADD THIS VALIDATION:
    // Validate source is selected
    if (!recordingStore.selectedScreenSource) {
      await window.electronAPI.dialog.showMessageBox({
        type: 'warning',
        title: 'No Source Selected',
        message: 'Please select a screen or window to record before starting.',
        buttons: ['OK']
      });
      return;
    }
    
    // Final permission check
```

#### 5. Ensure cleanup on component unmount

**VERIFY this code exists** in onUnmounted (around line 1133-1145):

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

**If it doesn't exist or is different, replace it with the above code.**

**Testing**:
1. Try to start recording without selecting source - should see warning dialog
2. Select source, close that window, try to record - should see validation error
3. Check console shows validation checks running
4. Start and stop recording 5 times - verify memory doesn't grow
5. Unmount component (close recording panel) - verify cleanup logs appear
6. Check no errors in console about stopped tracks or intervals

---

## Acceptance Criteria

After all 3 PRs are implemented and tested:

### Core Functionality Fixed
- [ ] Screen recording captures the SCREEN, not webcam
- [ ] Selected screen/window is the content in the recording
- [ ] Console logs confirm correct source ID format
- [ ] Video track label does NOT contain "camera" or "webcam"
- [ ] Stream settings show screen dimensions, not webcam dimensions

### Error Handling
- [ ] Clear, user-friendly error messages when recording fails
- [ ] Permission errors offer to open System Preferences
- [ ] Source unavailable errors caught before recording starts
- [ ] All errors logged to console with full context and grouping

### Resource Management
- [ ] All streams/tracks stopped properly when recording ends
- [ ] No memory leaks after multiple record/stop cycles
- [ ] Component unmount cleans up all resources
- [ ] Failed recordings clean up properly

### User Experience
- [ ] User can select any screen or window from list
- [ ] Recording starts without delay
- [ ] Recorded file plays back screen content correctly
- [ ] Validation prevents common mistakes (no source selected, etc.)

---

## Critical Testing Plan

### Test 1: Verify Screen Recording Works (MOST IMPORTANT)

1. Open the app in dev mode (so you can see console)
2. Click record button to open recording panel
3. **Verify**: Screen sources list appears with thumbnails
4. Select a SCREEN source (not a window, not webcam)
5. Click "Start Recording"
6. **Check Console**:
   - Should see: `[Recording] Starting Recording Attempt` group
   - Should see: `[Recording] Validation passed`
   - Should see: `[Recording] Screen stream obtained successfully`
   - Should see: `[Recording] Stream Information` group
   - **CRITICAL**: Video track label should NOT contain "FaceTime", "Camera", or "Webcam"
   - **CRITICAL**: Video track width/height should match screen (e.g., 1920x1080, not 1280x720)
7. Move some windows around on screen for 10 seconds
8. Click "Stop Recording"
9. Wait for recording to save and appear in media library
10. **Drag recording to timeline** and play it
11. **PASS CRITERIA**: Recording shows your screen content (windows moving), NOT your face
12. **FAIL CRITERIA**: Recording shows webcam view of your face

### Test 2: Different Sources

- Test recording from primary monitor
- Test recording from specific window
- Test recording from secondary monitor (if available)
- Each should capture the correct source

### Test 3: Error Handling

- Remove screen recording permission (System Preferences)
- Try to record - should show permission error with Settings button
- Click "Open Settings" - should open System Preferences
- Grant permission and try again - should work

### Test 4: Validation

- Don't select any source, click record - should see "No Source Selected" warning
- Select a window, close it, click record - should see validation error
- Select screen with <5GB disk space - should see disk space error

### Test 5: Resource Cleanup

- Record and stop 10 times in a row
- Check Activity Monitor - memory should not keep growing
- Close recording panel - check console for cleanup logs
- No errors about tracks or intervals

---

## Summary

**3 Pull Requests** to fix screen recording:

1. **PR #1: Fix Screen Capture Constraints** - Adds `mandatory` object to getUserMedia so Electron captures screen instead of webcam (**THE CRITICAL FIX**)
2. **PR #2: Enhanced Error Handling & Diagnostics** - Adds logging to verify the fix works and shows user-friendly errors
3. **PR #3: Validation & Cleanup** - Prevents common errors and ensures proper resource management

**Expected Outcome**: Screen recording will capture the selected screen/window content instead of webcam video.

**If PR #1 doesn't fix it**: The issue is elsewhere (permission problem, Electron version, or source ID format from main process).
