<template>
  <AppLauncher v-if="currentApp === null" @select-app="enterApp" />
  <ClipForgeApp v-else-if="currentApp === 'clipforge'" @back="exitToLauncher" />
  <AudioForgeApp v-else-if="currentApp === 'audioforge'" @back="exitToLauncher" />
</template>

<script setup>
import { ref } from 'vue';
import AppLauncher from './components/AppLauncher.vue';
import ClipForgeApp from './ClipForgeApp.vue';
import AudioForgeApp from './AudioForgeApp.vue';
import { useClipForgeProjectStore } from './stores/clipforge/projectStore';
import { useAudioForgeProjectStore } from './stores/audioforge/projectStore';
import { useClipForgeRecordingStore } from './stores/clipforge/recordingStore';
import { useAudioForgeRecordingStore } from './stores/audioforge/recordingStore';

// Navigation state
const currentApp = ref(null);

// Navigation methods
const enterApp = (appName) => {
  currentApp.value = appName;
};

const exitToLauncher = async () => {
  const appName = currentApp.value;
  
  // Check for unsaved changes in project store
  const projectStore = appName === 'clipforge' 
    ? useClipForgeProjectStore() 
    : useAudioForgeProjectStore();
  
  if (projectStore.isDirty) {
    const result = await window.electronAPI.showMessageBox({
      type: 'warning',
      title: 'Unsaved Changes',
      message: 'You have unsaved changes. Do you want to save before leaving?',
      buttons: ['Cancel', 'Discard Changes', 'Save'],
      defaultId: 2,
      cancelId: 0
    });
    
    if (result.response === 0) return; // Cancel
    if (result.response === 2) {
      // TODO: Trigger save - wait for completion
      // Implementation depends on how save is triggered
    }
  }
  
  // Clear modified state from recording store only
  const recordingStore = appName === 'clipforge'
    ? useClipForgeRecordingStore()
    : useAudioForgeRecordingStore();
  recordingStore.reset();
  
  // Return to launcher
  currentApp.value = null;
};
</script>

<style>
/* App router styles - minimal styling for navigation */
</style>
