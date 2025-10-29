<template>
  <div id="app" class="app-container">
    <div class="app-header">
      <BackButton @back="$emit('back')" />
      <h1>ClipForge</h1>
      <ProjectMenu :app-mode="appMode" />
      <button @click="openExport" :disabled="!canExport" class="export-btn" title="Export Timeline">
        Export
      </button>
      <button @click="openRecordingPanel" class="record-toggle-btn" title="Record">
        ● Record
      </button>
    </div>
    
    <div class="app-content">
      <div class="layout-grid">
        <!-- Media Library (left panel) -->
        <aside class="media-library-panel">
          <MediaLibrary :app-mode="appMode" />
          <TrimInfo />
        </aside>
        
        <!-- Main editing area (center) -->
        <main class="main-editor">
          <div class="preview-window">
            <PreviewWindow />
          </div>
          
          <div class="timeline-container">
            <Timeline :app-mode="appMode" />
          </div>
          
          <div class="transport-controls">
            <TransportControls />
            <div class="toolbar-buttons">
              <SplitButton />
            </div>
          </div>
        </main>
      </div>
    </div>
    
    <!-- Recording Panel -->
    <RecordingPanel ref="recordingPanel" :app-mode="appMode" />
    
    <!-- Export Dialog -->
    <ExportDialog :visible="showExport" :app-mode="appMode" @close="showExport = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import BackButton from './BackButton.vue';
import MediaLibrary from './MediaLibrary.vue';
import Timeline from './Timeline.vue';
import PreviewWindow from './PreviewWindow.vue';
import TransportControls from './TransportControls.vue';
import TrimInfo from './TrimInfo.vue';
import SplitButton from './SplitButton.vue';
import ProjectMenu from './ProjectMenu.vue';
import RecordingPanel from './RecordingPanel.vue';
import ExportDialog from './ExportDialog.vue';
import { useProjectStore } from '../stores/projectStore';
import { useRecordingStore } from '../stores/recordingStore';
import { useTimelineStore } from '../stores/timelineStore';
import { useMediaStore } from '../stores/mediaStore';
import { PlaybackManager } from '../../shared/playbackManager';
import { VideoPlayerPool } from '../../shared/videoPlayerPool';

// Props
const props = defineProps({
  appMode: {
    type: String,
    default: 'clipforge'
  }
});

// Emits
defineEmits(['back']);

const appVersion = ref('');

const projectStore = useProjectStore(props.appMode);
const recordingStore = useRecordingStore(props.appMode);
const timelineStore = useTimelineStore(props.appMode);
const mediaStore = useMediaStore(props.appMode);

const showExport = ref(false);
const videoPlayerPool = new VideoPlayerPool();
let playbackManager = null;

// Make project store globally available for timeline store
window[`__projectStore_${props.appMode}`] = projectStore;

// Computed property for export button - disabled during save/recording/empty timeline
const canExport = computed(() => {
  const hasClips = timelineStore.tracks.some(track => track.clips.length > 0);
  return hasClips && !projectStore.isSaving && !recordingStore.isRecording;
});

// Method to open export
const openExport = () => {
  if (canExport.value) {
    // Pause playback if playing
    if (playbackManager && playbackManager.isPlaying) {
      playbackManager.pause();
    }
    showExport.value = true;
  }
};

// Prevent close during save, recording, or with unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (projectStore.isSaving) {
    e.preventDefault();
    e.returnValue = 'Project is being saved. Please wait...';
    return e.returnValue;
  }
  
  if (recordingStore.isRecording) {
    e.preventDefault();
    e.returnValue = 'Recording in progress. Closing will stop and discard the recording.';
    return e.returnValue;
  }
  
  if (projectStore.isDirty) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to close?';
    return e.returnValue;
  }
});

onMounted(async () => {
  // Initialize playback manager
  playbackManager = new PlaybackManager(timelineStore, videoPlayerPool);
  
  // Update window title
  document.title = 'Forge - ClipForge';
  
  if (window.electronAPI) {
    appVersion.value = await window.electronAPI.getVersion();
  }

  // Listen for quit request during recording
  const unsubscribeRecordingQuit = window.electronAPI.onQuitRequestedDuringRecording(async () => {
    if (recordingStore.isRecording) {
      const confirmed = await window.electronAPI.showMessageBox({
        type: 'warning',
        title: 'Recording in Progress',
        message: 'A recording is currently in progress. If you quit now, the recording will be lost.',
        buttons: ['Cancel', 'Stop Recording and Quit'],
        defaultId: 0,
        cancelId: 0
      });
      
      if (confirmed.response === 1) {
        // Stop recording and allow quit
        recordingStore.stopRecording();
        await window.electronAPI.recording.setRecordingState(false);
        window.close();
      }
    }
  });

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribeRecordingQuit();
  });
});

onUnmounted(() => {
  // Reset to base title
  document.title = 'Forge';
});

const recordingPanel = ref(null);

const openRecordingPanel = () => {
  if (window.openRecordingPanel) {
    window.openRecordingPanel();
  }
};
</script>

<style lang="scss">
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  @include font;
  background: #c0c0c0;
  color: #000000;
  overflow: hidden;
  font-size: 11px;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #c0c0c0;
}

.app-header {
  @include d3-window;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  margin: 2px;
  -webkit-app-region: drag; /* Makes header draggable on macOS */
  
  h1 {
    font-size: 12px;
    font-weight: bold;
    @include font-color('header-font-color');
  }
}

.app-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin: 2px;
  gap: 2px;
}

.layout-grid {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  height: 100%;
  gap: 2px;
}

.media-library-panel {
  @include d3-window;
  overflow-y: auto;
  padding: 2px;
}

.main-editor {
  display: flex;
  flex-direction: column;
  @include d3-window;
  padding: 2px;
  gap: 2px;
}

.preview-window {
  flex: 1;
  background: #000;
  min-height: 200px;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

.timeline-container {
  height: 200px;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  @include background-color('inputs-bg');
}

.transport-controls {
  height: 40px;
  @include d3-window;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  margin-top: 2px;
}

.toolbar-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
}

.export-btn {
  @include d3-object;
  @include font;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 11px;
  height: 24px;
  margin-left: 8px;
  -webkit-app-region: no-drag;
  
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

.record-toggle-btn {
  @include d3-object;
  @include font;
  background: #ff0000;
  color: white;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 11px;
  font-weight: bold;
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  
  &:hover {
    background: #cc0000;
  }
  
  &:active {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 16px;
  height: 16px;
}

::-webkit-scrollbar-track {
  background: #c0c0c0;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
}

::-webkit-scrollbar-thumb {
  @include d3-object;
  background: #c0c0c0;
  
  &:hover {
    background: #d0d0d0;
  }
}

::-webkit-scrollbar-corner {
  background: #c0c0c0;
}
</style>
