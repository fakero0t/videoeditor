<template>
  <AppLauncher v-if="currentApp === null" @select-app="enterApp" />
  <ClipForgeEditor v-else-if="currentApp === 'clipforge'" @back="exitToLauncher" />
  <VoiceForgeEditor v-else-if="currentApp === 'voiceforge'" @back="exitToLauncher" />
</template>

<script setup>
import { ref } from 'vue';
import AppLauncher from './components/AppLauncher.vue';
import ClipForgeEditor from './components/ClipForgeEditor.vue';
import VoiceForgeEditor from './components/VoiceForgeEditor.vue';
import { useProjectStore } from './stores/projectStore';
import { useRecordingStore } from './stores/recordingStore';

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
    ? useProjectStore('clipforge') 
    : useProjectStore('voiceforge');
  
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
    ? useRecordingStore('clipforge')
    : useRecordingStore('voiceforge');
  recordingStore.reset();
  
  // Return to launcher
  currentApp.value = null;
};
</script>

<style>
/* App router styles - minimal styling for navigation */
</style>
