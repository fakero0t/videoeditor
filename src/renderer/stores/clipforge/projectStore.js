import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ClipForgeProjectService } from '../../../shared/clipforge/projectService';

export const useClipForgeProjectStore = defineStore('clipforge-project', () => {
    // State
    const currentProjectPath = ref(null);
    const currentProjectName = ref(null);
    const isDirty = ref(false);
    const isSaving = ref(false);
    const isLoading = ref(false);
    const saveProgress = ref({ current: 0, total: 0, fileName: '' });
    
    const projectService = new ClipForgeProjectService();
    
    // Computed
    const hasProject = computed(() => currentProjectPath.value !== null);
    const projectTitle = computed(() => {
      if (!currentProjectName.value) return 'Untitled Project';
      return isDirty.value ? `${currentProjectName.value}*` : currentProjectName.value;
    });
    
    // Actions
    const markDirty = () => {
      isDirty.value = true;
    };
    
    const markClean = () => {
      isDirty.value = false;
    };
    
    const setCurrentProject = (path, name) => {
      currentProjectPath.value = path;
      currentProjectName.value = name;
    };
    
    const clearProject = () => {
      currentProjectPath.value = null;
      currentProjectName.value = null;
      isDirty.value = false;
    };
    
    const setSaveProgress = (current, total, fileName) => {
      saveProgress.value = { current, total, fileName };
    };
    
    return {
      // State
      currentProjectPath,
      currentProjectName,
      isDirty,
      isSaving,
      isLoading,
      saveProgress,
      projectService,
      
      // Computed
      hasProject,
      projectTitle,
      
      // Actions
      markDirty,
      markClean,
      setCurrentProject,
      clearProject,
      setSaveProgress
    };
});
