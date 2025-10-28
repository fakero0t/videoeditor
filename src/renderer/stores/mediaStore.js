import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { generateId } from '../../shared/utils/videoUtils';

export const useMediaStore = defineStore('media', () => {
  // State
  const mediaFiles = ref([]);
  const importStatus = ref('idle'); // 'idle', 'importing', 'error', 'success'
  const importProgress = ref({ current: 0, total: 0 });
  const importErrors = ref([]);

  // Computed
  const hasMediaFiles = computed(() => mediaFiles.value.length > 0);
  const importingProgress = computed(() => {
    if (importProgress.value.total === 0) return 0;
    return Math.round((importProgress.value.current / importProgress.value.total) * 100);
  });

  // Actions
  const addMediaFile = (fileData) => {
    // Check if file already imported (by path)
    const existing = mediaFiles.value.find(f => f.filePath === fileData.filePath);
    if (existing) {
      console.warn('File already imported:', fileData.filePath);
      return existing.id;
    }

    const mediaFile = {
      id: generateId(),
      filePath: fileData.filePath,
      fileName: fileData.fileName,
      duration: fileData.duration,
      width: fileData.width,
      height: fileData.height,
      codec: fileData.codec,
      bitrate: fileData.bitrate,
      frameRate: fileData.frameRate,
      hasAudio: fileData.hasAudio,
      fileSize: fileData.fileSize,
      format: fileData.format,
      thumbnailPath: fileData.thumbnailPath || null,
      createdAt: Date.now()
    };
    
    mediaFiles.value.push(mediaFile);
    return mediaFile.id;
  };

  const removeMediaFile = (id) => {
    const index = mediaFiles.value.findIndex(file => file.id === id);
    if (index > -1) {
      mediaFiles.value.splice(index, 1);
    }
  };

  const clearAllMedia = () => {
    mediaFiles.value = [];
  };

  const setImportStatus = (status) => {
    importStatus.value = status;
  };

  const setImportProgress = (current, total) => {
    importProgress.value = { current, total };
  };

  const addImportError = (error) => {
    importErrors.value.push(error);
  };

  const clearImportErrors = () => {
    importErrors.value = [];
  };

  return {
    // State
    mediaFiles,
    importStatus,
    importProgress,
    importErrors,
    // Computed
    hasMediaFiles,
    importingProgress,
    // Actions
    addMediaFile,
    removeMediaFile,
    clearAllMedia,
    setImportStatus,
    setImportProgress,
    addImportError,
    clearImportErrors
  };
});
