<template>
  <div id="app" class="app-container">
    <div class="app-header">
      <h1>ClipForge</h1>
      <div class="app-version">v{{ appVersion }} | FFmpeg: {{ ffmpegStatus }}</div>
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
              <button @click="testFFmpeg" class="test-button">Test FFmpeg</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { testFFmpegIntegration } from '@shared/utils/ffmpegTest';
import MediaLibrary from './components/MediaLibrary.vue';
import Timeline from './components/Timeline.vue';
import PreviewWindow from './components/PreviewWindow.vue';
import TransportControls from './components/TransportControls.vue';
import TrimInfo from './components/TrimInfo.vue';
import SplitButton from './components/SplitButton.vue';

const appVersion = ref('');
const ffmpegStatus = ref('Unknown');

onMounted(async () => {
  if (window.electronAPI) {
    appVersion.value = await window.electronAPI.getVersion();
  }
});

const testFFmpeg = async () => {
  try {
    const isWorking = await testFFmpegIntegration();
    ffmpegStatus.value = isWorking ? 'Working ✅' : 'Failed ❌';
    console.log('FFmpeg test result:', ffmpegStatus.value);
  } catch (error) {
    ffmpegStatus.value = 'Error ❌';
    console.error('FFmpeg test error:', error);
  }
};
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
               'Helvetica Neue', Arial, sans-serif;
  background: #1a1a1a;
  color: #ffffff;
  overflow: hidden;
}

#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #0a0a0a;
  border-bottom: 1px solid #333;
  -webkit-app-region: drag; /* Makes header draggable on macOS */
}

.app-header h1 {
  font-size: 18px;
  font-weight: 600;
}

.app-version {
  font-size: 12px;
  color: #666;
}

.app-content {
  flex: 1;
  overflow: hidden;
}

.layout-grid {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  height: 100%;
}

.media-library-panel {
  background: #2a2a2a;
  border-right: 1px solid #333;
  overflow-y: auto;
}

.main-editor {
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
}

.preview-window {
  flex: 1;
  background: #000;
  min-height: 300px;
}

.timeline-container {
  height: 250px;
  border-top: 1px solid #333;
}

.transport-controls {
  height: 60px;
  background: #2a2a2a;
  border-top: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.toolbar-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
}

.panel-placeholder,
.controls-placeholder {
  color: #666;
  font-size: 14px;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: #1a1a1a;
}

::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.test-button {
  background: #007acc;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-top: 10px;
}

.test-button:hover {
  background: #005a9e;
}
</style>
