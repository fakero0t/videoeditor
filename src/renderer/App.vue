<template>
  <div id="app" class="app-container">
    <div class="app-header">
      <h1>ClipForge</h1>
      <ProjectMenu />
      <button @click="openRecordingPanel" class="record-toggle-btn" title="Record (Cmd/Ctrl+R)">
        ● Record
      </button>
    </div>
    
    <div class="app-content">
      <div class="layout-grid">
        <!-- Media Library (left panel) -->
        <aside class="media-library-panel">
          <MediaLibrary />
          <TrimInfo />
        </aside>
        
        <!-- Main editing area (center) -->
        <main class="main-editor">
          <div class="preview-window">
            <PreviewWindow />
          </div>
          
          <div class="timeline-container">
            <Timeline />
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
    <RecordingPanel ref="recordingPanel" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import MediaLibrary from './components/MediaLibrary.vue';
import Timeline from './components/Timeline.vue';
import PreviewWindow from './components/PreviewWindow.vue';
import TransportControls from './components/TransportControls.vue';
import TrimInfo from './components/TrimInfo.vue';
import SplitButton from './components/SplitButton.vue';
import ProjectMenu from './components/ProjectMenu.vue';
import RecordingPanel from './components/RecordingPanel.vue';
import { useProjectStore } from './stores/projectStore';
import { useRecordingStore } from './stores/recordingStore';

const appVersion = ref('');

const projectStore = useProjectStore();
const recordingStore = useRecordingStore();

// Make project store globally available for timeline store
window.__projectStore = projectStore;

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
  if (window.electronAPI) {
    appVersion.value = await window.electronAPI.getVersion();
  }

  // Add keyboard event listener
  document.addEventListener('keydown', handleKeyDown);

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
    document.removeEventListener('keydown', handleKeyDown);
    unsubscribeRecordingQuit();
  });
});

const recordingPanel = ref(null);

const openRecordingPanel = () => {
  if (window.openRecordingPanel) {
    window.openRecordingPanel();
  }
};

// Keyboard shortcut
const handleKeyDown = (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
    event.preventDefault();
    openRecordingPanel();
  }
};

</script>

<style lang="scss">
@import "../styles/plaza/variables";
@import "../styles/plaza/mixins";
@import "../styles/plaza/themes/theme-standard";

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
