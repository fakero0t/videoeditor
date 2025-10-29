<template>
  <div class="project-menu">
    <button @click="newProject" class="menu-btn" title="New Project">
      <span class="icon">📄</span> New
    </button>
    
    <button @click="openProject" class="menu-btn" title="Open Project">
      <span class="icon">📂</span> Open
    </button>
    
    <button @click="saveProject" class="menu-btn" title="Save Project" :disabled="isSaving">
      <span class="icon">💾</span> Save
    </button>
    
    <button @click="saveProjectAs" class="menu-btn" title="Save Project As...">
      <span class="icon">💾</span> Save As...
    </button>
    
    <span v-if="projectStore.isDirty" class="unsaved-indicator" title="Unsaved changes">●</span>
    <span class="project-name">{{ projectStore.projectTitle }}</span>
  </div>
  
  <!-- Save Progress Dialog -->
  <SaveProgressDialog
    :is-visible="showSaveProgress"
    title="Saving Project..."
    :current="saveProgress.current"
    :total="saveProgress.total"
    :current-file="saveProgress.fileName"
    :error="saveError"
    :can-cancel="false"
  />
</template>

<script setup>
import { ref, computed } from 'vue';
import { useProjectStore } from '../stores/projectStore';
import { useTimelineStore } from '../stores/timelineStore';
import { useMediaStore } from '../stores/mediaStore';
import SaveProgressDialog from './SaveProgressDialog.vue';

const projectStore = useProjectStore();
const timelineStore = useTimelineStore();
const mediaStore = useMediaStore();

const isSaving = ref(false);
const showSaveProgress = ref(false);
const saveProgress = ref({ current: 0, total: 0, fileName: '' });
const saveError = ref(null);

const newProject = async () => {
  // Check for unsaved changes
  if (projectStore.isDirty) {
    const confirmed = await window.electronAPI.showMessageBox({
      type: 'warning',
      title: 'Unsaved Changes',
      message: 'You have unsaved changes. Do you want to save before creating a new project?',
      buttons: ['Save and Continue', 'Don\'t Save', 'Cancel'],
      defaultId: 0,
      cancelId: 2
    });
    
    if (confirmed.response === 2) return; // Cancelled
    
    if (confirmed.response === 0) {
      // Save first
      await saveProject();
    }
  }
  
  // Clear timeline and media
  timelineStore.tracks.forEach(track => track.clips = []);
  mediaStore.clearAllMedia();
  timelineStore.setPlayheadPosition(0);
  timelineStore.setZoomLevel(1);
  
  // Clear project
  projectStore.clearProject();
};

const openProject = async () => {
  // Check for unsaved changes
  if (projectStore.isDirty) {
    const confirmed = await window.electronAPI.showMessageBox({
      type: 'warning',
      title: 'Unsaved Changes',
      message: 'You have unsaved changes. Do you want to save before opening another project?',
      buttons: ['Save and Open', 'Don\'t Save', 'Cancel'],
      defaultId: 0,
      cancelId: 2
    });
    
    if (confirmed.response === 2) return;
    
    if (confirmed.response === 0) {
      await saveProject();
    }
  }
  
  // Show open dialog
  const result = await window.electronAPI.showOpenDialog({
    filters: [
      { name: 'ClipForge Projects', extensions: ['cfproj'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return;
  
  const projectPath = result.filePaths[0];
  
  try {
    projectStore.isLoading = true;
    
    // Load project file
    const projectJSON = await window.electronAPI.fileSystem.readFile(projectPath);
    const projectData = JSON.parse(projectJSON);
    
    // Load project
    const loadResult = await projectStore.projectService.loadProject(
      projectPath,
      projectData,
      timelineStore,
      mediaStore
    );
    
    // Extract project name
    const projectName = projectData.projectName;
    projectStore.setCurrentProject(projectPath, projectName);
    projectStore.markClean();
    
    // Show warning if any files are missing
    if (loadResult.missingFiles.length > 0) {
      await window.electronAPI.showMessageBox({
        type: 'warning',
        title: 'Missing Media Files',
        message: `${loadResult.missingFiles.length} media file(s) could not be found. They will be marked as "Bad Media" and cannot be played.`,
        buttons: ['OK']
      });
    }
    
  } catch (error) {
    console.error('Failed to load project:', error);
    await window.electronAPI.showMessageBox({
      type: 'error',
      title: 'Load Failed',
      message: `Failed to load project: ${error.message}`,
      buttons: ['OK']
    });
  } finally {
    projectStore.isLoading = false;
  }
};

const saveProject = async () => {
  if (projectStore.currentProjectPath) {
    await performSave(projectStore.currentProjectPath);
  } else {
    await saveProjectAs();
  }
};

const saveProjectAs = async () => {
  // Show save dialog
  const result = await window.electronAPI.showSaveDialog({
    filters: [
      { name: 'ClipForge Projects', extensions: ['cfproj'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: 'Untitled.cfproj'
  });
  
  if (result.canceled || !result.filePath) return;
  
  await performSave(result.filePath);
};

const performSave = async (projectPath) => {
  try {
    isSaving.value = true;
    showSaveProgress.value = true;
    saveError.value = null;
    saveProgress.value = { current: 0, total: 0, fileName: '' };
    
    // Prepare project data
    const { projectData, filesToCopy } = await projectStore.projectService.prepareProjectForSave(
      projectPath,
      timelineStore,
      mediaStore
    );
    
    saveProgress.value.total = filesToCopy.length + 1; // +1 for project file
    
    // Listen for copy progress
    const unsubscribe = window.electronAPI.onFileCopyProgress((data) => {
      saveProgress.value.current++;
      saveProgress.value.fileName = data.source;
    });
    
    try {
      // Save project (this will copy files and write JSON)
      const saveResult = await window.electronAPI.project.save(
        projectPath,
        projectData,
        filesToCopy
      );
      
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Save failed');
      }
      
      // Update project store
      const projectName = projectData.projectName;
      projectStore.setCurrentProject(projectPath, projectName);
      projectStore.markClean();
      
      // Success
      saveProgress.value.fileName = 'Done!';
      setTimeout(() => {
        showSaveProgress.value = false;
      }, 1000);
      
    } finally {
      unsubscribe();
    }
    
  } catch (error) {
    console.error('Save failed:', error);
    saveError.value = error.message;
    
    // Keep dialog open to show error
    setTimeout(() => {
      showSaveProgress.value = false;
    }, 3000);
  } finally {
    isSaving.value = false;
  }
};
</script>

<style lang="scss" scoped>
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

.project-menu {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
}

.menu-btn {
  @include d3-object;
  @include font;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  
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

.icon {
  font-size: 12px;
}

.unsaved-indicator {
  color: #ff0000;
  font-size: 16px;
  line-height: 1;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.project-name {
  @include font-color('font-color');
  font-size: 11px;
  margin-left: 8px;
  font-weight: bold;
}
</style>
