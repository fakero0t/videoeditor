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
      >
        🎬 Screen + Webcam
      </button>
    </div>
    
    <!-- Screen Recording Tab -->
    <div v-if="currentTab === 'screen'" class="tab-content">
      <div class="option-group">
        <label>Screen/Window Source:</label>
        <div style="display: flex; gap: 4px; align-items: center;">
          <select 
            v-model="recordingStore.selectedScreenSource"
            :disabled="recordingStore.isRecording"
            style="flex: 1;"
          >
            <option :value="null">Select a source...</option>
            <option 
              v-for="source in (recordingStore.availableScreenSources || [])" 
              :key="source.id"
              :value="source"
            >
              {{ source.type === 'screen' ? '🖥️' : source.type === 'window' ? '🪟' : '📄' }} {{ source.name }}
            </option>
          </select>
          <button @click="refreshSources" class="refresh-btn" :disabled="recordingStore.isRecording">
            Refresh
          </button>
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
      <div class="option-group">
        <label>Webcam:</label>
        <div style="display: flex; gap: 4px; align-items: center;">
          <select 
            v-model="recordingStore.selectedWebcamSource"
            :disabled="recordingStore.isRecording"
            style="flex: 1;"
          >
            <option :value="null">Select a webcam...</option>
            <option 
              v-for="cam in recordingStore.availableWebcamSources" 
              :key="cam.deviceId"
              :value="cam"
            >
              📹 {{ cam.label }}
            </option>
          </select>
          <button @click="refreshSources" class="refresh-btn" :disabled="recordingStore.isRecording">
            Refresh
          </button>
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
    
    <!-- Composite Recording Tab -->
    <div v-if="currentTab === 'composite'" class="tab-content">
      <div class="option-group">
        <label>Screen Source:</label>
        <div style="display: flex; gap: 4px; align-items: center;">
          <select 
            v-model="compositeScreenSource"
            :disabled="recordingStore.isRecording"
            style="flex: 1;"
          >
            <option :value="null">Select a source...</option>
            <option 
              v-for="source in (recordingStore.availableScreenSources || [])" 
              :key="source.id"
              :value="source"
            >
              {{ source.type === 'screen' ? '🖥️' : source.type === 'window' ? '🪟' : '📄' }} {{ source.name }}
            </option>
          </select>
          <button @click="refreshSources" class="refresh-btn" :disabled="recordingStore.isRecording">
            Refresh
          </button>
        </div>
      </div>
      
      <div v-if="compositeScreenSource" class="preview-container">
        <img 
          :src="compositeScreenSource.thumbnail" 
          alt="Screen Preview"
          class="source-preview"
        />
      </div>
      
      <div class="option-group">
        <label>Webcam:</label>
        <div style="display: flex; gap: 4px; align-items: center;">
          <select 
            v-model="compositeWebcamSource"
            :disabled="recordingStore.isRecording"
            style="flex: 1;"
          >
            <option :value="null">Select a webcam...</option>
            <option 
              v-for="cam in recordingStore.availableWebcamSources" 
              :key="cam.deviceId"
              :value="cam"
            >
              📹 {{ cam.label }}
            </option>
          </select>
          <button @click="refreshSources" class="refresh-btn" :disabled="recordingStore.isRecording">
            Refresh
          </button>
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
import { useClipForgeMediaStore } from '../stores/clipforge/mediaStore';
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

const recordingStore = useClipForgeRecordingStore();
const mediaStore = useClipForgeMediaStore();

const isPanelOpen = ref(false);
const isWidgetVisible = ref(false);
const currentTab = ref('screen');
const showPermissionModal = ref(false);

// Webcam preview
const webcamPreview = ref(null);
let previewStream = null;

// Composite recording state (separate from main screen/webcam sources)
const compositeScreenSource = ref(null);
const compositeWebcamSource = ref(null);
const compositeWebcamPreview = ref(null);
let compositeWebcamStream = null;

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

// Computed property for composite recording
const canRecordComposite = computed(() => {
  return !recordingStore.isRecording &&
         compositeScreenSource.value !== null &&
         compositeWebcamSource.value !== null &&
         recordingStore.hasRequiredPermissions &&
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
    
    // Proactively check if we need to prompt for permissions
    if (props.appMode === 'clipforge') {
      // Check if we have screen recording permission
      const hasScreenSources = recordingStore.availableScreenSources?.length > 0;
      
      if (!hasScreenSources || !recordingStore.hasScreenPermission) {
        // No sources or no permission - show permission prompt
        
        const result = await window.electronAPI.showMessageBox({
          type: 'warning',
          title: 'Screen Recording Permission Required',
          message: 'Forge needs permission to record your screen.',
          detail: 'Please grant screen recording permission in System Preferences to use this feature.',
          buttons: ['Open System Preferences', 'Cancel'],
          defaultId: 0
        });
        
        if (result.response === 0) {
          // User chose to open settings
          await window.electronAPI.recording.openSystemSettings();
          
          // Wait a bit and then recheck
          setTimeout(async () => {
            await refreshSources();
            await checkPermissionsSilently();
            
            // Check if permission was granted
            if (recordingStore.availableScreenSources?.length > 0) {
              await window.electronAPI.showMessageBox({
                type: 'info',
                title: 'Permission Granted',
                message: 'Screen recording permission has been granted successfully!',
                buttons: ['OK']
              });
            }
          }, 3000);
        }
      }
    }
    
    // Set up focus listener only once
    if (!window._recordingPanelInitialized) {
      const handleFocus = async () => {
        // Silently check permissions when user returns to app
        // This updates the UI without showing the modal
        await checkPermissionsSilently();
        
        // If sources appear after returning, user granted permission
        if (props.appMode === 'clipforge' && recordingStore.availableScreenSources?.length > 0) {
        }
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
    
    // Also check if we still need to prompt for permissions
    if (props.appMode === 'clipforge' && recordingStore.availableScreenSources?.length === 0) {
    }
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
      permissions.screen = true;
    }
  } else if (props.appMode === 'clipforge' && !permissions.screen && recordingStore.availableScreenSources?.length > 0) {
    permissions.screen = true;
  }
  
  // Always trust the actual capability test over the API response (only for ClipForge)
  if (props.appMode === 'clipforge') {
    const canCaptureScreen = await testScreenCapturePermissions();
    if (canCaptureScreen && !permissions.screen) {
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
      permissions.screen = true;
    }
  } else if (props.appMode === 'clipforge' && !permissions.screen && recordingStore.availableScreenSources?.length > 0) {
    permissions.screen = true;
  }
  
  // Always trust the actual capability test over the API response (only for ClipForge)
  if (props.appMode === 'clipforge') {
    const canCaptureScreen = await testScreenCapturePermissions();
    if (canCaptureScreen && !permissions.screen) {
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
    
    const videoConstraints = screenRecorder.getVideoConstraints('medium');
    
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: screenSource.id,
        width: { ideal: videoConstraints.width.ideal },
        height: { ideal: videoConstraints.height.ideal }
      }
    });
    
    
    // Clean up the test stream
    stream.getTracks().forEach(track => track.stop());
    
    return true;
  } catch (error) {
    console.error('Screen recording test failed:', error);
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
        recordingStore.setPermissions(true, recordingStore.hasMicrophonePermission);
      } else {
        const sources = await window.electronAPI.recording.getDesktopSources();
        if (sources.length > 0 && !recordingStore.hasScreenPermission) {
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
    recordingStore.setLastError('Failed to list recording sources');
  }
};

const refreshPreview = () => {
  // Preview is shown via thumbnail from source selection
};

// Source selection methods - now handled by v-model, but keeping for any manual calls
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

// Watch for changes in composite sources to trigger previews
watch(compositeWebcamSource, (newCam) => {
  if (newCam) {
    startCompositeWebcamPreview();
  } else {
    stopCompositeWebcamPreview();
  }
});

// Recording controls
const startRecording = async () => {
  try {
    // Clear previous errors
    recordingStore.setLastError(null);
    
    // Validate source is selected
    if (!recordingStore.selectedScreenSource) {
      await window.electronAPI.showMessageBox({
        type: 'warning',
        title: 'No Source Selected',
        message: 'Please select a screen or window to record before starting.',
        buttons: ['OK']
      });
      return;
    }
    
    // Force a fresh permission check before recording
    await checkPermissionsSilently();
    
    // Final permission check (only for ClipForge)
    if (props.appMode === 'clipforge' && !recordingStore.hasScreenPermission) {
      showPermissionModal.value = true;
      return;
    }
    
    if (recordingStore.selectedMicrophoneSource && !recordingStore.hasMicrophonePermission) {
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
          recordingStore.setRecordingType('screen');
          recordingStore.currentRecordingId = recordingId;
          recordingStore.startRecording();
          // Auto-minimize panel
          minimizePanel();
        },
        onProgress: (duration) => {
          // Duration is tracked automatically by recordingStore timer
        },
        onAudioLevel: (level) => {
          recordingStore.setAudioLevel(level);
        },
        onComplete: async (filePath, duration) => {
          await handleRecordingComplete(filePath, duration);
        },
        onError: async (error) => {
          console.error('Recording error:', error);
          recordingStore.setLastError(error.message);
          recordingStore.stopRecording();
          await window.electronAPI.recording.setRecordingState(false);
          await showRecordingError(error);
        }
      }
    );
    
  } catch (error) {
    recordingStore.setLastError(error.message);
    await showRecordingError(error);
  }
};

const stopRecording = async () => {
  try {
    await screenRecorder.stopRecording();
    
    // Update recording state
    recordingStore.stopRecording();
    
    // Notify main process that recording stopped
    await window.electronAPI.recording.setRecordingState(false);
    
    // Hide widget and close panel
    isWidgetVisible.value = false;
    isPanelOpen.value = false;
    
    // Show success popup
    await window.electronAPI.showMessageBox({
      type: 'info',
      title: 'Recording Complete',
      message: 'Screen recording was successful!',
      detail: 'Your recording has been saved and added to the media library.'
    });
    
  } catch (error) {
    recordingStore.setLastError(error.message);
    
    // Force stop even if there was an error
    recordingStore.stopRecording();
    await window.electronAPI.recording.setRecordingState(false);
    isWidgetVisible.value = false;
    isPanelOpen.value = false;
  }
};

const handleRecordingComplete = async (filePath, calculatedDuration = null) => {
  console.log('[RecordingPanel] handleRecordingComplete called with filePath:', filePath, 'calculatedDuration:', calculatedDuration);
  
  try {
    // Convert to MP4 (or keep WebM if conversion fails)
    let finalPath = filePath;
    
    // Skip conversion for now to test media library import
    console.log('[RecordingPanel] Skipping conversion, using WebM file directly');
    finalPath = filePath;
    
    // Import to media library
    console.log('[RecordingPanel] Getting video info...');
    const videoInfo = await window.electronAPI.ffmpeg.getVideoInfo(finalPath);
    console.log('[RecordingPanel] Video info:', videoInfo);
    
    // Use calculated duration as fallback if FFmpeg returns 0 duration
    if (videoInfo.duration === 0 && calculatedDuration && calculatedDuration > 0) {
      console.log('[RecordingPanel] Using calculated duration as fallback:', calculatedDuration);
      videoInfo.duration = calculatedDuration;
    }
    
    // Calculate bitrate as fallback if FFmpeg returns 0 bitrate
    if (videoInfo.bitrate === 0 && videoInfo.duration > 0 && videoInfo.fileSize > 0) {
      videoInfo.bitrate = Math.round((videoInfo.fileSize * 8) / videoInfo.duration);
      console.log('[RecordingPanel] Calculated bitrate as fallback:', videoInfo.bitrate);
    }
    
    console.log('[RecordingPanel] Generating thumbnail...');
    const thumbnail = await window.electronAPI.ffmpeg.generateThumbnail(finalPath, 1);
    console.log('[RecordingPanel] Thumbnail generated:', thumbnail);
    
    // Extract filename from path
    const fileName = finalPath.split('/').pop();
    console.log('[RecordingPanel] Adding to media library:', {
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
      isRecording: true
    });
    
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
    
    console.log('[RecordingPanel] Successfully added to media library');
    
    
    // Show success message
    await window.electronAPI.showMessageBox({
      type: 'info',
      title: 'Recording Complete',
      message: 'Your screen recording has been saved and added to the media library!',
      buttons: ['OK']
    });
    
  } catch (error) {
    console.error('[RecordingPanel] Failed to process recording:', error);
    
    await window.electronAPI.showMessageBox({
      type: 'error',
      title: 'Import Failed',
      message: 'Recording was saved but could not be imported to media library.',
      detail: error.message,
      buttons: ['OK']
    });
  } finally {
    recordingStore.stopRecording();
    await window.electronAPI.recording.setRecordingState(false);
    isWidgetVisible.value = false;
    isPanelOpen.value = false;
  }
};

const getAudioLevelColor = (level) => {
  if (level > 80) return '#ff4444';
  if (level > 60) return '#ffaa00';
  return '#00ff00';
};

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
  await window.electronAPI.showMessageBox({
    type: 'error',
    title: title,
    message: message,
    buttons: ['OK'],
    defaultId: 0
  });
  
  // Offer to open system settings for permission errors
  if (showSettingsButton) {
    const result = await window.electronAPI.showMessageBox({
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

// Audio sync testing (for debugging)
const testAudioSync = () => {
  if (screenRecorder && recordingStore.isRecording) {
    const syncStatus = screenRecorder.testAudioSync();
    return syncStatus;
  }
  return null;
};

// Get audio quality settings (for verification)
const getAudioQualityInfo = () => {
  if (screenRecorder) {
    const qualitySettings = screenRecorder.getAudioQualitySettings();
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
    recordingStore.setLastError('Failed to access webcam');
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

const startWebcamRecording = async () => {
  try {
    // Stop preview before recording
    stopWebcamPreview();
    
    // Force a fresh permission check before recording
    await checkPermissionsSilently();
    
    // Check permissions
    if (recordingStore.selectedMicrophoneSource && !recordingStore.hasMicrophonePermission) {
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
          recordingStore.setRecordingType('webcam');
          recordingStore.currentRecordingId = recordingId;
          recordingStore.startRecording();
          minimizePanel();
        },
        onProgress: (duration) => {
          // Duration is tracked automatically by recordingStore timer
        },
        onAudioLevel: (level) => {
          recordingStore.setAudioLevel(level);
        },
        onComplete: async (filePath, duration) => {
          await handleRecordingComplete(filePath, duration);
        },
        onError: async (error) => {
          console.error('Recording error:', error);
          recordingStore.setLastError(error.message);
          recordingStore.stopRecording();
          await window.electronAPI.recording.setRecordingState(false);
          await showRecordingError(error);
        }
      }
    );
    
  } catch (error) {
    console.error('Failed to start webcam recording:', error);
    recordingStore.setLastError(error.message);
  }
};

const startMicrophoneRecording = async () => {
  try {
    // Force a fresh permission check before recording
    await checkPermissionsSilently();
    
    // Check permissions
    if (!recordingStore.hasMicrophonePermission) {
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
          recordingStore.setRecordingType('microphone');
          recordingStore.currentRecordingId = recordingId;
          recordingStore.startRecording();
          minimizePanel();
        },
        onProgress: (duration) => {
          // Duration is tracked automatically by recordingStore timer
        },
        onAudioLevel: (level) => {
          recordingStore.setAudioLevel(level);
        },
        onComplete: async (filePath, duration) => {
          await handleRecordingComplete(filePath, duration);
        },
        onError: async (error) => {
          console.error('Recording error:', error);
          recordingStore.setLastError(error.message);
          recordingStore.stopRecording();
          await window.electronAPI.recording.setRecordingState(false);
          await showRecordingError(error);
        }
      }
    );
    
  } catch (error) {
    console.error('Failed to start microphone recording:', error);
    recordingStore.setLastError(error.message);
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
      showPermissionModal.value = true;
      return;
    }
    
    if (recordingStore.selectedMicrophoneSource && !recordingStore.hasMicrophonePermission) {
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
          recordingStore.setRecordingType('composite');
          recordingStore.currentRecordingId = recordingId;
          recordingStore.startRecording();
          // Minimize panel after setting recording state
          isPanelOpen.value = false;
          isWidgetVisible.value = true;
        },
        onProgress: (duration) => {
          // Duration tracked by recordingStore timer
        },
        onAudioLevel: (level) => {
          recordingStore.setAudioLevel(level);
        },
        onComplete: async (filePath, duration) => {
          await handleRecordingComplete(filePath, duration);
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

// Debug function to test permissions and audio
const debugPermissions = async () => {
  
  // Test screen capture permissions
  const canCaptureScreen = await testScreenCapturePermissions();
  
  // Test screen recording if we have a selected source
  if (recordingStore.selectedScreenSource) {
    const canRecordScreen = await testScreenRecording(recordingStore.selectedScreenSource);
  }
  
  // Get main process permission status
  const mainProcessPermissions = await screenRecorder.checkPermissions();
  
  await checkPermissionsSilently();
  
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
  
  // Expose panel control globally
  window.openRecordingPanel = openPanel;
  
});

onUnmounted(() => {
  
  // Stop webcam preview
  stopWebcamPreview();
  
  // Stop composite webcam preview
  stopCompositeWebcamPreview();
  
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
  
  // Handle composite tab
  if (oldTab === 'composite') {
    stopCompositeWebcamPreview();
  }
  if (newTab === 'composite' && compositeWebcamSource.value) {
    startCompositeWebcamPreview();
  }
  
  // Clean up audio monitoring when switching away from recording tabs
  if (oldTab === 'screen' || oldTab === 'webcam' || oldTab === 'composite') {
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
          recordingStore.setAudioLevel(level);
        }
      );
    } catch (error) {
      console.error('Failed to setup audio monitoring:', error);
      recordingStore.setLastError('Failed to access microphone');
    }
  } else {
    // Clean up audio monitoring when no microphone selected
    screenRecorder.cleanupAudioMonitoring();
    recordingStore.setAudioLevel(0);
  }
});

// Watch for permission changes to log status
watch(() => [recordingStore.hasScreenPermission, recordingStore.hasMicrophonePermission], 
  ([screen, mic]) => {
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
  width: 50%;
  max-width: 50%;
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
