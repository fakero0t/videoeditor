<template>
  <div v-if="isPanelOpen" class="recording-panel" :style="panelStyle" @mousedown="startDrag">
    <div class="panel-header">
      <h3>Record</h3>
      <div class="panel-controls">
        <button @click="minimizePanel" class="minimize-btn" title="Minimize">_</button>
        <button @click="closePanel" class="close-btn" title="Close">×</button>
      </div>
    </div>
    
    <div class="panel-tabs">
      <button 
        v-if="props.appMode === 'clipforge'"
        @click="currentTab = 'screen'" 
        :class="{ active: currentTab === 'screen' }"
        class="tab-btn"
      >
        🖥️ Screen
      </button>
      <button 
        v-if="props.appMode === 'clipforge'"
        @click="currentTab = 'webcam'" 
        :class="{ active: currentTab === 'webcam' }"
        class="tab-btn"
      >
        📹 Webcam
      </button>
      <button 
        v-if="props.appMode === 'clipforge'"
        @click="currentTab = 'composite'" 
        :class="{ active: currentTab === 'composite' }"
        class="tab-btn"
        disabled
        title="Coming in PR #25"
      >
        🎬 Screen + Webcam
      </button>
      <button 
        v-if="props.appMode === 'audioforge'"
        @click="currentTab = 'microphone'" 
        :class="{ active: currentTab === 'microphone' }"
        class="tab-btn"
      >
        🎙️ Microphone
      </button>
    </div>
    
    <!-- Screen Recording Tab -->
    <div v-if="currentTab === 'screen'" class="tab-content">
      <div class="source-selection">
        <label>Screen/Window Source:</label>
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
              @click="selectScreenSource(source)"
              :class="{ 
                'source-item': true, 
                'selected': recordingStore.selectedScreenSource?.id === source.id,
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
      
      <div v-if="recordingStore.selectedScreenSource" class="preview-container">
        <img 
          :src="recordingStore.selectedScreenSource.thumbnail" 
          alt="Preview"
          class="source-preview"
        />
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
          <label>Quality:</label>
          <select 
            v-model="recordingStore.recordingQuality"
            :disabled="recordingStore.isRecording"
          >
            <option value="high">High (1080p)</option>
            <option value="medium">Medium (720p)</option>
            <option value="low">Low (480p)</option>
          </select>
        </div>
      </div>
      
      <div v-if="recordingStore.diskSpaceWarning" class="warning-message">
        ⚠️ Low disk space (< 5GB available). Recording may fail.
      </div>
      
      <div v-if="appMode === 'clipforge' && !recordingStore.hasScreenPermission && recordingStore.availableScreenSources.length === 0" class="warning-message">
        ⚠️ Screen recording permission required. Click "Check Permissions" below.
      </div>
      <div v-if="recordingStore.selectedMicrophoneSource && !recordingStore.hasMicrophonePermission" class="warning-message">
        ⚠️ Microphone permission required for audio recording.
      </div>
      
      <div class="recording-controls">
        <button 
          v-if="!recordingStore.isRecording"
          @click="startRecording"
          :disabled="!canRecord"
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
      
      <!-- Webcam Recording Tab -->
    <div v-if="currentTab === 'webcam'" class="tab-content">
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
              @click="selectWebcamSource(cam)"
              :class="{ 
                'source-item': true, 
                'selected': recordingStore.selectedWebcamSource?.deviceId === cam.deviceId,
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
      
      <div v-if="recordingStore.selectedWebcamSource" class="preview-container">
        <video 
          ref="webcamPreview"
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
          <label>Quality:</label>
          <select 
            v-model="recordingStore.recordingQuality"
            :disabled="recordingStore.isRecording"
          >
            <option value="high">High (1080p)</option>
            <option value="medium">Medium (720p)</option>
            <option value="low">Low (480p)</option>
          </select>
        </div>
      </div>
      
      <div v-if="recordingStore.diskSpaceWarning" class="warning-message">
        ⚠️ Low disk space (< 5GB available). Recording may fail.
      </div>
      
      <div v-if="recordingStore.selectedMicrophoneSource && !recordingStore.hasMicrophonePermission" class="warning-message">
        ⚠️ Microphone permission required for audio recording.
      </div>
      
      <div class="recording-controls">
        <button 
          v-if="!recordingStore.isRecording"
          @click="startWebcamRecording"
          :disabled="!canRecordWebcam"
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
    
    <!-- Microphone Only Recording Tab (AudioForge) -->
    <div v-if="currentTab === 'microphone'" class="tab-content">
      <div class="recording-options">
        <div class="option-group">
          <label>Microphone:</label>
          <select 
            v-model="recordingStore.selectedMicrophoneSource"
            :disabled="recordingStore.isRecording"
          >
            <option :value="null">Select a microphone...</option>
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
          <label>Quality:</label>
          <select 
            v-model="recordingStore.recordingQuality"
            :disabled="recordingStore.isRecording"
          >
            <option value="high">High (48kHz)</option>
            <option value="medium">Medium (44.1kHz)</option>
            <option value="low">Low (22kHz)</option>
          </select>
        </div>
      </div>
      
      <div v-if="recordingStore.diskSpaceWarning" class="warning-message">
        ⚠️ Low disk space (< 5GB available). Recording may fail.
      </div>
      
      <div v-if="recordingStore.selectedMicrophoneSource && !recordingStore.hasMicrophonePermission" class="warning-message">
        ⚠️ Microphone permission required for audio recording.
      </div>
      
      <div class="recording-controls">
        <button 
          v-if="!recordingStore.isRecording"
          @click="startMicrophoneRecording"
          :disabled="!canRecordMicrophone"
          class="record-btn"
        >
          🎙️ Start Recording
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
  </div>
  
  <!-- Recording Widget (shown when minimized during recording) -->
  <RecordingWidget 
    v-if="isWidgetVisible"
    :app-mode="appMode"
    @restore="restorePanel"
    @stop="stopRecording"
  />
  
  <!-- Permission Modal -->
  <PermissionModal
    :is-visible="showPermissionModal"
    :has-screen-permission="recordingStore.hasScreenPermission"
    :has-microphone-permission="recordingStore.hasMicrophonePermission"
    :app-mode="appMode"
    @close="showPermissionModal = false"
    @recheck="showPermissionCheck"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useClipForgeRecordingStore } from '../stores/clipforge/recordingStore';
import { useAudioForgeRecordingStore } from '../stores/audioforge/recordingStore';
import { useClipForgeMediaStore } from '../stores/clipforge/mediaStore';
import { useAudioForgeMediaStore } from '../stores/audioforge/mediaStore';
import { ScreenRecorder } from '../../shared/screenRecorder';
import RecordingWidget from './RecordingWidget.vue';
import PermissionModal from './PermissionModal.vue';

// Props
const props = defineProps({
  appMode: {
    type: String,
    default: 'clipforge'
  }
});

const recordingStore = props.appMode === 'clipforge' 
  ? useClipForgeRecordingStore() 
  : useAudioForgeRecordingStore();

const mediaStore = props.appMode === 'clipforge' 
  ? useClipForgeMediaStore() 
  : useAudioForgeMediaStore();

const isPanelOpen = ref(false);
const isWidgetVisible = ref(false);
const currentTab = ref(props.appMode === 'audioforge' ? 'microphone' : 'screen');
const showPermissionModal = ref(false);

// Webcam preview
const webcamPreview = ref(null);
let previewStream = null;

const screenRecorder = new ScreenRecorder();

// Panel dragging
const panelStyle = ref({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

const canRecord = computed(() => {
  return !recordingStore.isRecording &&
         recordingStore.selectedScreenSource !== null &&
         recordingStore.hasRequiredPermissions &&
         recordingStore.hasEnoughDiskSpace;
});

const canRecordWebcam = computed(() => {
  return !recordingStore.isRecording &&
         recordingStore.selectedWebcamSource !== null &&
         recordingStore.hasRequiredPermissions &&
         recordingStore.hasEnoughDiskSpace;
});

const canRecordMicrophone = computed(() => {
  return !recordingStore.isRecording &&
         recordingStore.selectedMicrophoneSource !== null &&
         recordingStore.hasMicrophonePermission &&
         recordingStore.hasEnoughDiskSpace;
});

// Open/close panel
const openPanel = async () => {
  isPanelOpen.value = true;
  isWidgetVisible.value = false;
  
  // Reset position to center
  panelStyle.value = { 
    top: '50%', 
    left: '50%', 
    transform: 'translate(-50%, -50%)' 
  };
  
  // Initialize recording functionality only when panel opens
  if (!recordingStore.permissionsChecked) {
    // Check permissions first
    await checkPermissions();
    
    // Refresh sources (this also tests screen capture permissions)
    await refreshSources();
    
    // Check disk space
    const diskSpace = await screenRecorder.checkDiskSpace();
    recordingStore.setAvailableDiskSpace(diskSpace);
    
    // Force a permission recheck after sources are loaded
    await checkPermissionsSilently();
    
    // Set up focus listener only once
    if (!window._recordingPanelInitialized) {
      const handleFocus = () => {
        // Silently check permissions when user returns to app
        // This updates the UI without showing the modal
        checkPermissionsSilently();
      };
      
      window.addEventListener('focus', handleFocus);
      window._recordingPanelInitialized = true;
      
      // Store cleanup function for later
      window._recordingPanelCleanup = () => {
        window.removeEventListener('focus', handleFocus);
      };
    }
  } else {
    // Just do a silent permission check if already initialized
    await checkPermissionsSilently();
  }
};

const closePanel = () => {
  if (recordingStore.isRecording) {
    // Don't allow closing during recording
    return;
  }
  isPanelOpen.value = false;
};

const minimizePanel = () => {
  if (recordingStore.isRecording) {
    isPanelOpen.value = false;
    isWidgetVisible.value = true;
  }
};

const restorePanel = () => {
  isPanelOpen.value = true;
  isWidgetVisible.value = false;
};

// Dragging
const startDrag = (event) => {
  if (!event.target.classList.contains('panel-header')) return;
  
  isDragging.value = true;
  const rect = event.currentTarget.getBoundingClientRect();
  dragOffset.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
  
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
};

const handleDrag = (event) => {
  if (!isDragging.value) return;
  
  const newLeft = event.clientX - dragOffset.value.x;
  const newTop = event.clientY - dragOffset.value.y;
  
  panelStyle.value = {
    top: newTop + 'px',
    left: newLeft + 'px',
    transform: 'none'
  };
};

const stopDrag = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
};

// Permission checking
const checkPermissions = async () => {
  const permissions = await screenRecorder.checkPermissions();
  if (props.appMode === 'clipforge') {
    recordingStore.setPermissions(permissions.screen, permissions.microphone);
  } else {
    recordingStore.setPermissions(false, permissions.microphone);
  }
  
  // Don't automatically show modal - let user manually trigger it
  // The modal should only show when user explicitly clicks "Check Permissions"
};

// Silent permission check - updates UI without showing modal
const checkPermissionsSilently = async () => {
  const permissions = await screenRecorder.checkPermissions();
  
  // Test actual screen capture capability first (only for ClipForge)
  if (props.appMode === 'clipforge') {
    const canCaptureScreen = await testScreenCapturePermissions();
    
    // If we can actually capture screen, we definitely have permission
    if (canCaptureScreen) {
      console.log('Screen capture test successful - screen permission is definitely granted');
      permissions.screen = true;
    }
  } else if (props.appMode === 'clipforge' && !permissions.screen && recordingStore.availableScreenSources?.length > 0) {
    console.log('Main process says screen permission denied, but we have screen sources - assuming permission is granted');
    permissions.screen = true;
  }
  
  // Always trust the actual capability test over the API response (only for ClipForge)
  if (props.appMode === 'clipforge') {
    const canCaptureScreen = await testScreenCapturePermissions();
    if (canCaptureScreen && !permissions.screen) {
      console.log('Overriding API response - screen capture works, so permission is granted');
      permissions.screen = true;
    }
  }
  
  if (props.appMode === 'clipforge') {
    recordingStore.setPermissions(permissions.screen, permissions.microphone);
  } else {
    recordingStore.setPermissions(false, permissions.microphone);
  }
};

// Show permission modal only when user explicitly requests it
const showPermissionCheck = async () => {
  const permissions = await screenRecorder.checkPermissions();
  
  // Test actual screen capture capability first (only for ClipForge)
  if (props.appMode === 'clipforge') {
    const canCaptureScreen = await testScreenCapturePermissions();
    
    // If we can actually capture screen, we definitely have permission
    if (canCaptureScreen) {
      console.log('Screen capture test successful - screen permission is definitely granted');
      permissions.screen = true;
    }
  } else if (props.appMode === 'clipforge' && !permissions.screen && recordingStore.availableScreenSources?.length > 0) {
    console.log('Main process says screen permission denied, but we have screen sources - assuming permission is granted');
    permissions.screen = true;
  }
  
  // Always trust the actual capability test over the API response (only for ClipForge)
  if (props.appMode === 'clipforge') {
    const canCaptureScreen = await testScreenCapturePermissions();
    if (canCaptureScreen && !permissions.screen) {
      console.log('Overriding API response - screen capture works, so permission is granted');
      permissions.screen = true;
    }
  }
  
  if (props.appMode === 'clipforge') {
    recordingStore.setPermissions(permissions.screen, permissions.microphone);
  } else {
    recordingStore.setPermissions(false, permissions.microphone);
  }
  
  // Only show modal if permissions are actually missing
  const needsScreenPermission = props.appMode === 'clipforge' && currentTab.value === 'screen' && !permissions.screen;
  const needsMicrophonePermission = recordingStore.selectedMicrophoneSource && !permissions.microphone;
  
  if (needsScreenPermission || needsMicrophonePermission) {
    showPermissionModal.value = true;
  } else {
    // All required permissions are granted
    console.log('All required permissions are granted!');
  }
};

// Test screen capture permissions by trying to get screen sources
const testScreenCapturePermissions = async () => {
  try {
    const sources = await window.electronAPI.recording.getDesktopSources();
    return sources.length > 0;
  } catch (error) {
    console.error('Screen capture test failed:', error);
    return false;
  }
};

// Test screen recording with a specific source
const testScreenRecording = async (screenSource) => {
  try {
    console.log('Testing screen recording with source:', screenSource);
    
    const videoConstraints = screenRecorder.getVideoConstraints('medium');
    console.log('Using constraints:', videoConstraints);
    
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: screenSource.id,
        width: { ideal: videoConstraints.width.ideal },
        height: { ideal: videoConstraints.height.ideal }
      }
    });
    
    console.log('Screen recording test successful:', {
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length
    });
    
    // Clean up the test stream
    stream.getTracks().forEach(track => track.stop());
    
    return true;
  } catch (error) {
    console.error('Screen recording test failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      constraint: error.constraint
    });
    return false;
  }
};

// Source management
const refreshSources = async () => {
  try {
    // Get desktop sources (only for ClipForge)
    if (props.appMode === 'clipforge') {
      const sources = await window.electronAPI.recording.getDesktopSources();
      recordingStore.setAvailableScreenSources(sources);
    }
    
    // Test screen capture permissions and update accordingly (only for ClipForge)
    if (props.appMode === 'clipforge') {
      const canCaptureScreen = await testScreenCapturePermissions();
      if (canCaptureScreen) {
        console.log('Screen capture test successful - screen permission is definitely granted');
        recordingStore.setPermissions(true, recordingStore.hasMicrophonePermission);
      } else {
        const sources = await window.electronAPI.recording.getDesktopSources();
        if (sources.length > 0 && !recordingStore.hasScreenPermission) {
          console.log('Screen sources available but permission false - forcing permission update');
          recordingStore.setPermissions(true, recordingStore.hasMicrophonePermission);
        }
      }
    }
    
    // Get microphone and webcam sources
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter(device => device.kind === 'audioinput');
    const webcams = devices.filter(device => device.kind === 'videoinput');
    recordingStore.setAvailableMicrophoneSources(mics);
    recordingStore.setAvailableWebcamSources(webcams);
    
  } catch (error) {
    console.error('Failed to refresh sources:', error);
    recordingStore.setError('Failed to list recording sources');
  }
};

const refreshPreview = () => {
  // Preview is shown via thumbnail from source selection
};

// Source selection methods
const selectScreenSource = (source) => {
  if (recordingStore.isRecording) return;
  recordingStore.setSelectedScreenSource(source);
  refreshPreview();
};

const selectWebcamSource = (cam) => {
  if (recordingStore.isRecording) return;
  recordingStore.setSelectedWebcamSource(cam);
  startWebcamPreview();
};

// Recording controls
const startRecording = async () => {
  try {
    // Force a fresh permission check before recording
    await checkPermissionsSilently();
    
    // Final permission check (only for ClipForge)
    if (props.appMode === 'clipforge' && !recordingStore.hasScreenPermission) {
      console.error('Screen permission not granted - cannot start recording');
      showPermissionModal.value = true;
      return;
    }
    
    if (recordingStore.selectedMicrophoneSource && !recordingStore.hasMicrophonePermission) {
      console.error('Microphone permission not granted - cannot start recording');
      showPermissionModal.value = true;
      return;
    }
    
    // Final disk space check
    const diskSpace = await screenRecorder.checkDiskSpace();
    if (diskSpace < 5 * 1024 * 1024 * 1024) {
      alert('Insufficient disk space. Need at least 5GB available.');
      return;
    }
    
    // Notify main process
    await window.electronAPI.recording.setRecordingState(true);
    
    // Start recording
    const recordingId = 'rec_' + Date.now();
    await screenRecorder.startScreenRecording(
      recordingStore.selectedScreenSource,
      recordingStore.selectedMicrophoneSource,
      recordingStore.recordingQuality,
      {
        onStart: () => {
          recordingStore.startRecording('screen', recordingId);
          // Auto-minimize panel
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
          recordingStore.setError(error.message);
          recordingStore.stopRecording();
          await window.electronAPI.recording.setRecordingState(false);
        }
      }
    );
    
  } catch (error) {
    console.error('Failed to start recording:', error);
    recordingStore.setError(error.message);
  }
};

const stopRecording = async () => {
  try {
    await screenRecorder.stopRecording();
    
    // Update recording state
    recordingStore.stopRecording();
    
    // Notify main process that recording stopped
    await window.electronAPI.recording.setRecordingState(false);
    
    // Hide widget and show panel
    isWidgetVisible.value = false;
    isPanelOpen.value = true;
    
    // Show success popup
    await window.electronAPI.dialog.showMessageBox({
      type: 'info',
      title: 'Recording Complete',
      message: 'Screen recording was successful!',
      detail: 'Your recording has been saved and added to the media library.'
    });
    
    // Close the recording panel
    isPanelOpen.value = false;
    
  } catch (error) {
    console.error('Failed to stop recording:', error);
    recordingStore.setError(error.message);
    
    // Force stop even if there was an error
    recordingStore.stopRecording();
    await window.electronAPI.recording.setRecordingState(false);
    isWidgetVisible.value = false;
    isPanelOpen.value = true;
  }
};

const handleRecordingComplete = async (filePath) => {
  try {
    // Convert to MP4 (or keep WebM if conversion fails)
    let finalPath = filePath;
    
    try {
      const mp4Path = await window.electronAPI.ffmpeg.convertWebMToMP4(filePath);
      finalPath = mp4Path;
      
      // Delete WebM after successful conversion
      await window.electronAPI.fileSystem.deleteFile(filePath);
    } catch (conversionError) {
      console.warn('MP4 conversion failed, using WebM:', conversionError);
      // Keep WebM file
    }
    
    // Import to media library
    const videoInfo = await window.electronAPI.ffmpeg.getVideoInfo(finalPath);
    const thumbnail = await window.electronAPI.ffmpeg.generateThumbnail(finalPath, 1);
    
    // Extract filename from path
    const fileName = finalPath.split('/').pop();
    
    mediaStore.addMediaFile({
      filePath: finalPath,
      fileName: fileName,
      duration: videoInfo.duration,
      width: videoInfo.width,
      height: videoInfo.height,
      codec: videoInfo.codec,
      bitrate: videoInfo.bitrate,
      frameRate: videoInfo.frameRate,
      hasAudio: videoInfo.hasAudio,
      fileSize: videoInfo.size,
      format: videoInfo.format,
      thumbnailPath: thumbnail,
      isRecording: true // Mark as recording
    });
    
    // Show success message
    alert('Recording complete and added to media library!');
    
  } catch (error) {
    console.error('Failed to process recording:', error);
    alert('Recording saved but import failed: ' + error.message);
  } finally {
    recordingStore.stopRecording();
    await window.electronAPI.recording.setRecordingState(false);
    isWidgetVisible.value = false;
    isPanelOpen.value = true;
  }
};

const getAudioLevelColor = (level) => {
  if (level > 80) return '#ff4444';
  if (level > 60) return '#ffaa00';
  return '#00ff00';
};

// Audio sync testing (for debugging)
const testAudioSync = () => {
  if (screenRecorder && recordingStore.isRecording) {
    const syncStatus = screenRecorder.testAudioSync();
    console.log('Audio Sync Status:', syncStatus);
    return syncStatus;
  }
  return null;
};

// Get audio quality settings (for verification)
const getAudioQualityInfo = () => {
  if (screenRecorder) {
    const qualitySettings = screenRecorder.getAudioQualitySettings();
    console.log('Audio Quality Settings:', qualitySettings);
    return qualitySettings;
  }
  return null;
};

// Webcam preview methods
const startWebcamPreview = async () => {
  // Stop existing preview
  stopWebcamPreview();
  
  if (!recordingStore.selectedWebcamSource) return;
  
  try {
    const videoConstraints = screenRecorder.getVideoConstraints(recordingStore.recordingQuality);
    previewStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: recordingStore.selectedWebcamSource.deviceId,
        width: videoConstraints.width,
        height: videoConstraints.height
      },
      audio: false
    });
    
    if (webcamPreview.value) {
      webcamPreview.value.srcObject = previewStream;
    }
  } catch (error) {
    console.error('Failed to start webcam preview:', error);
    recordingStore.setError('Failed to access webcam');
  }
};

const stopWebcamPreview = () => {
  if (previewStream) {
    previewStream.getTracks().forEach(track => track.stop());
    previewStream = null;
  }
  if (webcamPreview.value) {
    webcamPreview.value.srcObject = null;
  }
};

const startWebcamRecording = async () => {
  try {
    // Stop preview before recording
    stopWebcamPreview();
    
    // Force a fresh permission check before recording
    await checkPermissionsSilently();
    
    // Check permissions
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
    await screenRecorder.startWebcamRecording(
      recordingStore.selectedWebcamSource,
      recordingStore.selectedMicrophoneSource,
      recordingStore.recordingQuality,
      {
        onStart: () => {
          recordingStore.startRecording('webcam', recordingId);
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
          recordingStore.setError(error.message);
          recordingStore.stopRecording();
          await window.electronAPI.recording.setRecordingState(false);
        }
      }
    );
    
  } catch (error) {
    console.error('Failed to start webcam recording:', error);
    recordingStore.setError(error.message);
  }
};

const startMicrophoneRecording = async () => {
  try {
    // Force a fresh permission check before recording
    await checkPermissionsSilently();
    
    // Check permissions
    if (!recordingStore.hasMicrophonePermission) {
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
    await screenRecorder.startMicrophoneRecording(
      recordingStore.selectedMicrophoneSource,
      recordingStore.recordingQuality,
      {
        onStart: () => {
          recordingStore.startRecording('microphone', recordingId);
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
          recordingStore.setError(error.message);
          recordingStore.stopRecording();
          await window.electronAPI.recording.setRecordingState(false);
        }
      }
    );
    
  } catch (error) {
    console.error('Failed to start microphone recording:', error);
    recordingStore.setError(error.message);
  }
};

// Debug function to test permissions and audio
const debugPermissions = async () => {
  console.log('=== PERMISSION DEBUG ===');
  console.log('Current permissions:', {
    screen: recordingStore.hasScreenPermission,
    microphone: recordingStore.hasMicrophonePermission,
    selectedMicrophone: recordingStore.selectedMicrophoneSource?.label || 'None',
    selectedWebcam: recordingStore.selectedWebcamSource?.label || 'None',
    currentTab: currentTab.value,
    hasRequiredPermissions: recordingStore.hasRequiredPermissions,
    hasEnoughDiskSpace: recordingStore.hasEnoughDiskSpace,
    canRecordScreen: canRecord.value,
    canRecordWebcam: canRecordWebcam.value,
    audioLevel: recordingStore.audioLevel,
    screenSourcesCount: recordingStore.availableScreenSources.length
  });
  
  // Test screen capture permissions
  const canCaptureScreen = await testScreenCapturePermissions();
  console.log('Screen capture test result:', canCaptureScreen);
  
  // Test screen recording if we have a selected source
  if (recordingStore.selectedScreenSource) {
    const canRecordScreen = await testScreenRecording(recordingStore.selectedScreenSource);
    console.log('Screen recording test result:', canRecordScreen);
  }
  
  // Get main process permission status
  const mainProcessPermissions = await screenRecorder.checkPermissions();
  console.log('Main process permissions:', mainProcessPermissions);
  
  await checkPermissionsSilently();
  console.log('After silent recheck:', {
    screen: recordingStore.hasScreenPermission,
    microphone: recordingStore.hasMicrophonePermission,
    hasRequiredPermissions: recordingStore.hasRequiredPermissions,
    audioLevel: recordingStore.audioLevel
  });
  
  console.log('=== END DEBUG ===');
  console.log('Available functions:');
  console.log('- showPermissionCheck() - Show permission modal');
  console.log('- checkPermissionsSilently() - Silent permission check');
  console.log('- testScreenCapturePermissions() - Test screen capture access');
};

// Expose testing functions globally for debugging
window.testAudioSync = testAudioSync;
window.getAudioQualityInfo = getAudioQualityInfo;
window.debugPermissions = debugPermissions;
window.testScreenRecording = testScreenRecording;
window.showPermissionCheck = showPermissionCheck;
window.checkPermissionsSilently = checkPermissionsSilently;
window.testScreenCapturePermissions = testScreenCapturePermissions;

// Initialize
onMounted(async () => {
  // Load microphone sources immediately for AudioForge
  if (props.appMode === 'audioforge') {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(device => device.kind === 'audioinput');
      recordingStore.setAvailableMicrophoneSources(mics);
      console.log('Loaded microphone sources for AudioForge:', mics.length);
    } catch (error) {
      console.error('Failed to load microphone sources:', error);
    }
  }
  
  // Expose panel control globally
  window.openRecordingPanel = openPanel;
  
  console.log('RecordingPanel mounted - waiting for user to open panel');
});

onUnmounted(() => {
  stopWebcamPreview();
  screenRecorder.cleanup();
  screenRecorder.cleanupAudioMonitoring();
  
  // Cleanup focus listener
  if (window._recordingPanelCleanup) {
    window._recordingPanelCleanup();
  }
  
  // Reset initialization flag
  window._recordingPanelInitialized = false;
});

// Watch for limit reached
watch(() => recordingStore.isApproachingLimit, (approaching) => {
  if (approaching && recordingStore.isRecording) {
    // Auto-stop at 2 hour limit
    stopRecording();
  }
});

// Watch for tab changes to manage preview
watch(currentTab, async (newTab, oldTab) => {
  if (oldTab === 'webcam') {
    stopWebcamPreview();
  }
  if (newTab === 'webcam' && recordingStore.selectedWebcamSource) {
    startWebcamPreview();
  }
  
  // Clean up audio monitoring when switching away from recording tabs
  if (oldTab === 'screen' || oldTab === 'webcam') {
    screenRecorder.cleanupAudioMonitoring();
  }
  
  // Force permission check when switching to screen tab
  if (newTab === 'screen') {
    await checkPermissionsSilently();
  }
});

// Watch for microphone selection changes to silently check permissions and set up audio monitoring
watch(() => recordingStore.selectedMicrophoneSource, async (newMicrophone) => {
  // Silently check permissions when microphone selection changes
  // This updates the UI without showing the modal
  await checkPermissionsSilently();
  
  // Set up audio level monitoring for preview
  if (newMicrophone) {
    try {
      await screenRecorder.setupPreviewAudioLevelMonitoring(
        newMicrophone,
        (level) => {
          recordingStore.updateAudioLevel(level);
        }
      );
    } catch (error) {
      console.error('Failed to setup audio monitoring:', error);
      recordingStore.setError('Failed to access microphone');
    }
  } else {
    // Clean up audio monitoring when no microphone selected
    screenRecorder.cleanupAudioMonitoring();
    recordingStore.updateAudioLevel(0);
  }
});

// Watch for permission changes to log status
watch(() => [recordingStore.hasScreenPermission, recordingStore.hasMicrophonePermission], 
  ([screen, mic]) => {
    console.log('Permission status updated:', { screen, mic });
  }
);
</script>

<style lang="scss" scoped>
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

.recording-panel {
  position: fixed;
  width: 500px;
  max-width: 90vw;
  @include d3-window;
  z-index: 1500;
  padding: 2px;
  background: #c0c0c0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  @include background-color('inputs-bg');
  border-bottom: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  cursor: move;
  margin: 1px;
}

.panel-header h3 {
  margin: 0;
  color: black;
  font-size: 12px;
  font-weight: bold;
}

.panel-controls {
  display: flex;
  gap: 4px;
}

.minimize-btn,
.close-btn {
  @include d3-object;
  @include font;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 11px;
  min-width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: #d0d0d0;
  }
  
  &:active {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
}

.panel-tabs {
  display: flex;
  @include background-color('inputs-bg');
  border-bottom: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  margin: 1px;
}

.tab-btn {
  flex: 1;
  @include background-color('inputs-bg');
  border: none;
  color: black;
  padding: 6px;
  cursor: pointer;
  font-size: 11px;
  border-right: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  
  &:last-child {
    border-right: none;
  }
  
  &:hover:not(:disabled) {
    background: #d0d0d0;
    color: black;
  }
  
  &.active {
    @include background-color('inputs-bg');
    color: black;
    box-shadow: inset 1px 1px 0 0 #000000, inset -1px -1px 0 0 #ffffff;
  }
  
  &:disabled {
    color: #808080;
    cursor: not-allowed;
  }
}

.tab-content {
  padding: 8px;
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  margin: 1px;
}

.source-selection {
  margin-bottom: 8px;
}

.source-selection label {
  color: black;
  font-size: 11px;
  white-space: nowrap;
  font-weight: bold;
  display: block;
  margin-bottom: 4px;
}

.source-list-container {
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  padding: 2px;
}

.source-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 4px;
  @include background-color('inputs-bg');
  border-bottom: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  margin-bottom: 1px;
}

.source-count {
  color: black;
  font-size: 10px;
  font-weight: bold;
}

.source-list {
  max-height: 120px;
  overflow-y: auto;
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  
  &.disabled {
    opacity: 0.6;
    pointer-events: none;
  }
  
  /* Windows 98 scrollbar styling */
  &::-webkit-scrollbar {
    width: 16px;
    height: 16px;
  }

  &::-webkit-scrollbar-track {
    @include background-color('inputs-bg');
    border: 1px solid;
    @include border-color-tl('content-border-left');
    @include border-color-rb('content-border-right');
  }

  &::-webkit-scrollbar-thumb {
    @include d3-object;
    background: #c0c0c0;

    &:hover {
      background: #d0d0d0;
    }
  }

  &::-webkit-scrollbar-corner {
    @include background-color('inputs-bg');
  }
}

.no-sources {
  padding: 8px;
  color: black;
  font-size: 11px;
  text-align: center;
  @include font-color('font-disabled');
}

.source-item {
  display: flex;
  align-items: center;
  padding: 4px 6px;
  cursor: pointer;
  border-bottom: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  
  &:hover:not(.disabled) {
    background: #d0d0d0;
    color: black;
  }
  
  &.selected {
    background: #0000ff;
    color: white;
    box-shadow: inset 1px 1px 0 0 #000000, inset -1px -1px 0 0 #ffffff;
    
    .source-name,
    .source-type {
      color: white;
    }
  }
  
  &.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  
  &:last-child {
    border-bottom: none;
  }
}

.source-icon {
  margin-right: 6px;
  font-size: 12px;
  width: 16px;
  text-align: center;
}

.source-info {
  flex: 1;
  min-width: 0;
}

.source-name {
  color: black;
  font-size: 11px;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-type {
  color: black;
  font-size: 10px;
  opacity: 0.8;
  text-transform: capitalize;
}

.refresh-btn {
  @include d3-object;
  @include font;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 11px;
  
  &:hover:not(:disabled) {
    background: #d0d0d0;
  }
  
  &:active:not(:disabled) {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
  
  &:disabled {
    @include font-color('font-disabled');
    cursor: not-allowed;
  }
}

.preview-container {
  margin-bottom: 8px;
  text-align: center;
}

.source-preview {
  max-width: 100%;
  height: auto;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

.webcam-preview {
  width: 100%;
  max-width: 100%;
  height: auto;
  background: #000;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

.recording-options {
  margin-bottom: 8px;
}

.option-group {
  margin-bottom: 6px;
}

.option-group label {
  display: block;
  color: black;
  font-size: 11px;
  margin-bottom: 2px;
  font-weight: bold;
}

.option-group select {
  width: 100%;
  @include background-color('inputs-bg');
  color: black;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  padding: 2px 4px;
  font-size: 11px;
  font-family: $font-family;
  
  &:focus {
    outline: none;
    box-shadow: inset 1px 1px 0 0 #000000, inset -1px -1px 0 0 #ffffff;
  }
}

.audio-level-meter {
  height: 16px;
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  overflow: hidden;
  margin-bottom: 2px;
}

.audio-level-bar {
  height: 100%;
  transition: width 0.1s ease, background-color 0.2s ease;
}

.audio-level-text {
  color: black;
  font-size: 10px;
}

.warning-message {
  background: #ffff00;
  color: black;
  padding: 4px 6px;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: bold;
}

.recording-controls {
  display: flex;
  gap: 4px;
}

.record-btn {
  flex: 1;
  @include d3-object;
  @include font;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 11px;
  font-weight: bold;
  background: #ff0000;
  color: white;
  
  &:hover:not(:disabled) {
    background: #cc0000;
  }
  
  &:active:not(:disabled) {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
  
  &:disabled {
    @include font-color('font-disabled');
    cursor: not-allowed;
  }
}

.stop-btn {
  flex: 1;
  @include d3-object;
  @include font;
  padding: 6px 8px;
  cursor: pointer;
  font-size: 11px;
  font-weight: bold;
  background: #ff4444;
  color: white;
  animation: pulse-red 1.5s ease-in-out infinite;
  
  &:hover {
    background: #ff0000;
  }
  
  &:active {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
}

@keyframes pulse-red {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.secondary-btn {
  @include d3-object;
  @include font;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 11px;
  
  &:hover {
    background: #d0d0d0;
  }
  
  &:active {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
}

</style>
