# Picture-in-Picture (PiP) Recording Implementation

**Objective**: Implement simultaneous screen and webcam recording with PiP overlay

**Priority**: Medium | **Complexity**: High | **Risk**: Medium

## Overview

Enable composite recording that captures screen content with webcam overlay in bottom-right corner (25% width). Uses separate preview approach (screen thumbnail + live webcam) to conserve resources, with fixed 720p webcam quality regardless of screen recording quality.

## Implementation Steps

### Step 1: Create Video Compositor Utility

**File**: `src/shared/videoCompositor.js` (NEW)

Create a canvas-based video composition class that combines screen and webcam streams in real-time.

```javascript
export class VideoCompositor {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.screenVideo = null;
    this.webcamVideo = null;
    this.isComposing = false;
    this.animationFrame = null;
    
    // PiP settings - fixed positioning
    this.pipWidth = 0.25; // 25% of screen width
    this.pipMargin = 16; // 16px margin from edges
  }

  // Initialize compositor with canvas
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    
    // Create video elements for drawing
    this.screenVideo = document.createElement('video');
    this.screenVideo.muted = true;
    this.screenVideo.autoplay = true;
    
    this.webcamVideo = document.createElement('video');
    this.webcamVideo.muted = true;
    this.webcamVideo.autoplay = true;
  }

  // Set screen stream
  async setScreenStream(stream) {
    this.screenVideo.srcObject = stream;
    await this.screenVideo.play();
  }

  // Set webcam stream
  async setWebcamStream(stream) {
    this.webcamVideo.srcObject = stream;
    await this.webcamVideo.play();
  }

  // Start composition loop
  startComposition() {
    if (!this.canvas || !this.screenVideo || !this.webcamVideo) {
      throw new Error('Canvas and both streams required for composition');
    }

    this.isComposing = true;
    this.composite();
  }

  // Stop composition
  stopComposition() {
    this.isComposing = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  // Main composition loop
  composite() {
    if (!this.isComposing) return;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // Clear canvas
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw screen stream (full canvas)
    if (this.screenVideo.readyState >= 2) {
      this.ctx.drawImage(this.screenVideo, 0, 0, canvasWidth, canvasHeight);
    }

    // Draw webcam stream (PiP overlay in bottom-right)
    if (this.webcamVideo.readyState >= 2) {
      // Calculate PiP dimensions maintaining 16:9 aspect ratio
      const pipWidth = canvasWidth * this.pipWidth;
      const pipHeight = pipWidth * (9 / 16);
      
      // Position in bottom-right corner with margin
      const pipX = canvasWidth - pipWidth - this.pipMargin;
      const pipY = canvasHeight - pipHeight - this.pipMargin;
      
      // Draw semi-transparent background
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.fillRect(pipX - 4, pipY - 4, pipWidth + 8, pipHeight + 8);
      
      // Draw webcam video
      this.ctx.drawImage(this.webcamVideo, pipX, pipY, pipWidth, pipHeight);
      
      // Draw white border
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(pipX, pipY, pipWidth, pipHeight);
    }

    // Continue composition
    this.animationFrame = requestAnimationFrame(() => this.composite());
  }

  // Get composite stream from canvas
  getCompositeStream() {
    if (!this.canvas) {
      throw new Error('Canvas not initialized');
    }
    return this.canvas.captureStream(30); // 30 FPS
  }

  // Cleanup
  cleanup() {
    this.stopComposition();
    
    if (this.screenVideo) {
      this.screenVideo.srcObject = null;
      this.screenVideo = null;
    }
    
    if (this.webcamVideo) {
      this.webcamVideo.srcObject = null;
      this.webcamVideo = null;
    }
    
    this.canvas = null;
    this.ctx = null;
  }
}
```

**Why**: Provides real-time canvas-based composition of screen and webcam streams with fixed PiP positioning.

---

### Step 2: Enable Composite Tab in RecordingPanel

**File**: `src/renderer/components/RecordingPanel.vue`

**Change 1**: Enable the composite tab button (around line 29-37)

```vue
<button 
  v-if="props.appMode === 'clipforge'"
  @click="currentTab = 'composite'" 
  :class="{ active: currentTab === 'composite' }"
  class="tab-btn"
>
  🎬 Screen + Webcam
</button>
```

Remove:
- `disabled` attribute
- `title="Coming in PR #25"` attribute

**Why**: Makes the composite tab accessible to users.

---

### Step 3: Add Composite Tab Content

**File**: `src/renderer/components/RecordingPanel.vue`

**Location**: After webcam tab content (after line 302), before microphone tab

```vue
<!-- Composite Recording Tab -->
<div v-if="currentTab === 'composite'" class="tab-content">
  <div class="source-selection">
    <label>Screen Source:</label>
    <div class="source-list-container">
      <div class="source-list-header">
        <span class="source-count">{{ recordingStore.availableScreenSources?.length || 0 }} sources</span>
        <button @click="refreshSources" class="refresh-btn" :disabled="recordingStore.isRecording">
          Refresh
        </button>
      </div>
      <div class="source-list" :class="{ disabled: recordingStore.isRecording }">
        <div 
          v-if="recordingStore.availableScreenSources.length === 0"
          class="no-sources"
        >
          No sources available
        </div>
        <div 
          v-for="source in (recordingStore.availableScreenSources || [])" 
          :key="source.id"
          @click="selectCompositeScreenSource(source)"
          :class="{ 
            'source-item': true, 
            'selected': compositeScreenSource?.id === source.id,
            'disabled': recordingStore.isRecording
          }"
        >
          <div class="source-icon">
            <span v-if="source.type === 'screen'">🖥️</span>
            <span v-else-if="source.type === 'window'">🪟</span>
            <span v-else>📄</span>
          </div>
          <div class="source-info">
            <div class="source-name">{{ source.name }}</div>
            <div class="source-type">{{ source.type }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div v-if="compositeScreenSource" class="preview-container">
    <img 
      :src="compositeScreenSource.thumbnail" 
      alt="Screen Preview"
      class="source-preview"
    />
  </div>
  
  <div class="source-selection">
    <label>Webcam:</label>
    <div class="source-list-container">
      <div class="source-list-header">
        <span class="source-count">{{ recordingStore.availableWebcamSources.length }} webcams</span>
        <button @click="refreshSources" class="refresh-btn" :disabled="recordingStore.isRecording">
          Refresh
        </button>
      </div>
      <div class="source-list" :class="{ disabled: recordingStore.isRecording }">
        <div 
          v-if="recordingStore.availableWebcamSources.length === 0"
          class="no-sources"
        >
          No webcams available
        </div>
        <div 
          v-for="cam in recordingStore.availableWebcamSources" 
          :key="cam.deviceId"
          @click="selectCompositeWebcamSource(cam)"
          :class="{ 
            'source-item': true, 
            'selected': compositeWebcamSource?.deviceId === cam.deviceId,
            'disabled': recordingStore.isRecording
          }"
        >
          <div class="source-icon">
            <span>📹</span>
          </div>
          <div class="source-info">
            <div class="source-name">{{ cam.label }}</div>
            <div class="source-type">webcam</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <div v-if="compositeWebcamSource" class="preview-container">
    <video 
      ref="compositeWebcamPreview"
      autoplay
      muted
      class="webcam-preview"
    ></video>
  </div>
  
  <div class="recording-options">
    <div class="option-group">
      <label>Microphone:</label>
      <select 
        v-model="recordingStore.selectedMicrophoneSource"
        :disabled="recordingStore.isRecording"
      >
        <option :value="null">None</option>
        <option 
          v-for="mic in recordingStore.availableMicrophoneSources"
          :key="mic.deviceId"
          :value="mic"
        >
          {{ mic.label }}
        </option>
      </select>
    </div>
    
    <div v-if="recordingStore.selectedMicrophoneSource" class="option-group">
      <label>Audio Level:</label>
      <div class="audio-level-meter">
        <div 
          class="audio-level-bar" 
          :style="{ width: recordingStore.audioLevel + '%', backgroundColor: getAudioLevelColor(recordingStore.audioLevel) }"
        ></div>
      </div>
      <span class="audio-level-text">{{ Math.round(recordingStore.audioLevel) }}%</span>
    </div>
    
    <div class="option-group">
      <label>Screen Quality:</label>
      <select 
        v-model="recordingStore.recordingQuality"
        :disabled="recordingStore.isRecording"
      >
        <option value="high">High (1080p)</option>
        <option value="medium">Medium (720p)</option>
        <option value="low">Low (480p)</option>
      </select>
      <small style="display: block; margin-top: 2px; font-size: 10px; color: #666;">
        Webcam: Fixed 720p
      </small>
    </div>
  </div>
  
  <div v-if="recordingStore.diskSpaceWarning" class="warning-message">
    ⚠️ Low disk space (< 5GB available). Recording may fail.
  </div>
  
  <div v-if="!compositeScreenSource || !compositeWebcamSource" class="warning-message">
    ℹ️ Select both screen source and webcam to enable recording.
  </div>
  
  <div v-if="recordingStore.selectedMicrophoneSource && !recordingStore.hasMicrophonePermission" class="warning-message">
    ⚠️ Microphone permission required for audio recording.
  </div>
  
  <div class="recording-controls">
    <button 
      v-if="!recordingStore.isRecording"
      @click="startCompositeRecording"
      :disabled="!canRecordComposite"
      class="record-btn"
    >
      ● Start Recording
    </button>
    <button 
      v-else
      @click="stopRecording"
      class="stop-btn"
    >
      ■ Stop Recording
    </button>
    
    <button 
      v-if="!recordingStore.permissionsChecked"
      @click="showPermissionCheck"
      class="secondary-btn"
    >
      Check Permissions
    </button>
  </div>
</div>
```

**Why**: Provides UI for selecting both screen and webcam sources with separate previews.

---

### Step 4: Add Composite State and Methods to RecordingPanel

**File**: `src/renderer/components/RecordingPanel.vue`

**Location**: In `<script setup>` section, after existing refs (around line 435)

```javascript
// Composite recording state (separate from main screen/webcam sources)
const compositeScreenSource = ref(null);
const compositeWebcamSource = ref(null);
const compositeWebcamPreview = ref(null);
let compositeWebcamStream = null;

// Computed property for composite recording
const canRecordComposite = computed(() => {
  return !recordingStore.isRecording &&
         compositeScreenSource.value !== null &&
         compositeWebcamSource.value !== null &&
         recordingStore.hasRequiredPermissions &&
         recordingStore.hasEnoughDiskSpace;
});

// Select screen source for composite
const selectCompositeScreenSource = (source) => {
  if (recordingStore.isRecording) return;
  compositeScreenSource.value = source;
};

// Select webcam source for composite
const selectCompositeWebcamSource = (cam) => {
  if (recordingStore.isRecording) return;
  compositeWebcamSource.value = cam;
  startCompositeWebcamPreview();
};

// Start webcam preview for composite tab
const startCompositeWebcamPreview = async () => {
  // Stop existing preview
  stopCompositeWebcamPreview();
  
  if (!compositeWebcamSource.value) return;
  
  try {
    // Fixed 720p for webcam
    compositeWebcamStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: compositeWebcamSource.value.deviceId,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    
    if (compositeWebcamPreview.value) {
      compositeWebcamPreview.value.srcObject = compositeWebcamStream;
    }
  } catch (error) {
    console.error('Failed to start composite webcam preview:', error);
    recordingStore.setLastError('Failed to access webcam');
  }
};

// Stop webcam preview for composite tab
const stopCompositeWebcamPreview = () => {
  if (compositeWebcamStream) {
    compositeWebcamStream.getTracks().forEach(track => track.stop());
    compositeWebcamStream = null;
  }
  if (compositeWebcamPreview.value) {
    compositeWebcamPreview.value.srcObject = null;
  }
};

// Start composite recording
const startCompositeRecording = async () => {
  try {
    // Clear previous errors
    recordingStore.setLastError(null);
    
    // Stop preview before recording
    stopCompositeWebcamPreview();
    
    // Validate sources
    if (!compositeScreenSource.value || !compositeWebcamSource.value) {
      await window.electronAPI.showMessageBox({
        type: 'warning',
        title: 'Sources Required',
        message: 'Please select both a screen source and webcam before starting.',
        buttons: ['OK']
      });
      return;
    }
    
    // Force a fresh permission check
    await checkPermissionsSilently();
    
    // Check permissions
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
    
    // Check disk space
    const diskSpace = await screenRecorder.checkDiskSpace();
    if (diskSpace < 5 * 1024 * 1024 * 1024) {
      alert('Insufficient disk space. Need at least 5GB available.');
      return;
    }
    
    // Notify main process
    await window.electronAPI.recording.setRecordingState(true);
    
    // Start recording
    const recordingId = 'rec_' + Date.now();
    await screenRecorder.startCompositeRecording(
      compositeScreenSource.value,
      compositeWebcamSource.value,
      recordingStore.selectedMicrophoneSource,
      recordingStore.recordingQuality,
      {
        onStart: () => {
          recordingStore.startRecording('composite', recordingId);
          minimizePanel();
        },
        onProgress: (duration) => {
          // Duration tracked by recordingStore timer
        },
        onAudioLevel: (level) => {
          recordingStore.setAudioLevel(level);
        },
        onComplete: async (filePath) => {
          await handleRecordingComplete(filePath);
        },
        onError: async (error) => {
          console.error('Composite recording error:', error);
          recordingStore.setLastError(error.message);
          recordingStore.stopRecording();
          await window.electronAPI.recording.setRecordingState(false);
          await showRecordingError(error);
        }
      }
    );
    
  } catch (error) {
    console.error('Failed to start composite recording:', error);
    recordingStore.setLastError(error.message);
    await showRecordingError(error);
  }
};
```

**Why**: Manages composite-specific state and recording flow, keeping it separate from individual screen/webcam recording.

---

### Step 5: Add Composite Tab Watchers

**File**: `src/renderer/components/RecordingPanel.vue`

**Location**: In the watch section at bottom of script (around line 1370)

```javascript
// Watch for composite tab changes to manage preview
watch(currentTab, async (newTab, oldTab) => {
  // ... existing watches ...
  
  // Handle composite tab
  if (oldTab === 'composite') {
    stopCompositeWebcamPreview();
  }
  if (newTab === 'composite' && compositeWebcamSource.value) {
    startCompositeWebcamPreview();
  }
});
```

**Why**: Ensures webcam preview starts/stops when switching to/from composite tab.

---

### Step 6: Cleanup Composite Preview on Unmount

**File**: `src/renderer/components/RecordingPanel.vue`

**Location**: In `onUnmounted` hook (around line 1321)

```javascript
onUnmounted(() => {
  console.log('[RecordingPanel] Component unmounting, cleaning up...');
  
  // Stop webcam preview
  stopWebcamPreview();
  
  // Stop composite webcam preview
  stopCompositeWebcamPreview();
  
  // ... existing cleanup code ...
});
```

**Why**: Prevents webcam stream leaks when component unmounts.

---

### Step 7: Implement Composite Recording in ScreenRecorder

**File**: `src/shared/screenRecorder.js`

**Location 1**: Add import at top (after line 71)

```javascript
import { VideoCompositor } from './videoCompositor.js';
```

**Location 2**: Add method after `startWebcamRecording()` (after line 830)

```javascript
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
```

**Why**: Implements the core composite recording logic using VideoCompositor.

---

### Step 8: Update ScreenRecorder Cleanup

**File**: `src/shared/screenRecorder.js`

**Location**: In `cleanup()` method (around line 832)

```javascript
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
  
  // ... existing cleanup code ...
}
```

**Why**: Ensures all composite recording resources are properly released.

---

## Testing Checklist

### Source Selection
- [ ] Can select screen source in composite tab
- [ ] Can select webcam source in composite tab
- [ ] Both sources required to enable recording button
- [ ] Can refresh sources list
- [ ] Sources persist when switching between tabs

### Preview
- [ ] Screen thumbnail shows selected screen
- [ ] Webcam preview shows live video
- [ ] Webcam preview is 720p quality
- [ ] Preview stops when switching away from composite tab
- [ ] Preview restarts when returning to composite tab

### Recording
- [ ] Can start composite recording with both sources
- [ ] PiP overlay appears in bottom-right corner
- [ ] PiP is 25% of screen width
- [ ] Timer counts up correctly
- [ ] Panel auto-minimizes to widget
- [ ] Widget shows during recording
- [ ] Can stop recording from panel or widget
- [ ] Auto-stops at 2 hour limit
- [ ] Auto-stops if disk space < 500MB

### Audio
- [ ] Microphone selection works
- [ ] Audio level meter shows activity
- [ ] Audio captured in recording
- [ ] No audio if no microphone selected

### Quality
- [ ] High quality screen (1080p) works
- [ ] Medium quality screen (720p) works
- [ ] Low quality screen (480p) works
- [ ] Webcam always records at 720p

### Import
- [ ] Recording auto-imports to media library
- [ ] Recording has red badge/background (isRecording: true)
- [ ] Thumbnail generated correctly
- [ ] Metadata correct (duration, dimensions, etc.)
- [ ] Can drag to timeline
- [ ] Can play in preview

### Edge Cases
- [ ] Screen source disappears during recording
- [ ] Webcam disconnected during recording
- [ ] No screen sources available
- [ ] No webcam sources available
- [ ] Permission denied for screen
- [ ] Permission denied for webcam
- [ ] Switching tabs during recording (should minimize)

## Acceptance Criteria

- [x] Composite tab enabled and functional
- [x] Both screen and webcam sources required
- [x] Separate preview approach (screen thumbnail + webcam video)
- [x] PiP positioned in bottom-right corner
- [x] PiP is 25% of screen width
- [x] Webcam fixed at 720p quality
- [x] Recording starts successfully
- [x] Same controls as other recording types
- [x] Audio capture works
- [x] Auto-imports to media library with red badge
- [x] All existing V1 features still work

## Dependencies

- PR #24 (Webcam Recording) - Must be completed first
- PR #22 (Screen Recording) - Must be completed first

## Notes

- **No real-time preview composition**: To conserve resources, the UI shows separate screen (thumbnail) and webcam (live video) previews instead of a live composite preview. The actual composition happens only during recording.
- **Fixed webcam quality**: Webcam is always recorded at 720p (1280x720) regardless of screen recording quality setting. This prevents excessive file sizes and processing overhead.
- **Separate state**: Composite tab maintains its own source selections (`compositeScreenSource`, `compositeWebcamSource`) independent of the screen/webcam tabs. This prevents confusion when switching between recording modes.
- **PiP positioning**: Fixed at bottom-right corner with 16px margin. The PiP size is 25% of screen width, maintaining 16:9 aspect ratio.

