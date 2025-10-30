<template>
  <div class="media-library">
    <!-- Drop Zone Overlay -->
    <div 
      v-if="isDragOver" 
      class="drop-overlay"
      @drop.prevent="handleDrop"
      @dragover.prevent="handleDropOverlay"
      @dragleave.prevent="handleDropLeave"
    >
      <div class="drop-message">
        <div class="drop-icon">📁</div>
        <p>{{ dropMessage }}</p>
      </div>
    </div>

    <!-- Import Status -->
    <div v-if="mediaStore && mediaStore.importStatus === 'importing'" class="import-progress-bar">
      <div class="progress-fill" :style="{ width: mediaStore.importingProgress + '%' }"></div>
      <span class="progress-text">
        Importing {{ mediaStore.importProgress.current }} of {{ mediaStore.importProgress.total }} files...
      </span>
    </div>

    <!-- Import Errors -->
    <div v-if="mediaStore && mediaStore.importErrors.length > 0" class="import-errors">
      <div class="error-header">
        <span>Failed to import {{ mediaStore.importErrors.length }} file(s)</span>
        <button @click="mediaStore.clearImportErrors" class="close-btn">×</button>
      </div>
      <ul class="error-list">
        <li v-for="(error, index) in mediaStore.importErrors" :key="index">
          <strong>{{ error.fileName }}</strong>: {{ error.error }}
        </li>
      </ul>
    </div>

    <!-- Header with import button -->
    <div class="library-header">
      <h3>{{ libraryTitle }}</h3>
      <div class="header-actions">
        <button @click="handleImportClick" class="import-btn" :disabled="mediaStore && mediaStore.importStatus === 'importing'">
          + Import Files
        </button>
      </div>
    </div>

    <!-- Clips Grid -->
    <div v-if="mediaStore && mediaStore.hasMediaFiles" class="clips-grid">
      <div 
        v-for="clip in mediaStore.mediaFiles" 
        :key="clip.id"
        class="clip-item"
        :class="{ 
          'selected': selectedClip === clip.id,
          'dragging': draggingClip === clip.id,
          'is-recording': clip.isRecording
        }"
        @click="selectClip(clip)"
        @dragstart="handleDragStart($event, clip)"
        @dragend="handleDragEnd"
        draggable="true"
      >
        <!-- Thumbnail -->
        <div class="thumbnail-container">
          <img 
            v-if="clip.thumbnailPath" 
            :src="getThumbnailSrc(clip.thumbnailPath)" 
            :alt="clip.fileName"
            class="thumbnail"
            @error="handleThumbnailError"
          />
          <div v-else class="thumbnail-placeholder">
            <svg v-if="appMode === 'clipforge'" class="icon-video" viewBox="0 0 24 24">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
            <svg v-else class="icon-audio" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
          <div v-if="clip.isRecording" class="recording-badge">REC</div>
        </div>
        
        <!-- Clip Info -->
        <div class="clip-info">
          <div class="filename" :title="clip.fileName">{{ clip.fileName }}</div>
          <div class="metadata">
            <span class="duration">{{ formatDuration(clip.duration) }}</span>
            <span class="separator">•</span>
            <span class="resolution">{{ clip.width }}×{{ clip.height }}</span>
          </div>
          <div class="metadata-secondary">
            <span class="codec">{{ getCodecName(clip.codec) }}</span>
            <span class="separator">•</span>
            <span class="file-size">{{ formatFileSize(clip.fileSize) }}</span>
          </div>
        </div>
        
        <!-- Remove Button -->
        <button 
          @click.stop="removeClip(clip.id)" 
          class="remove-btn"
          title="Remove from library"
          aria-label="Remove clip"
        >
          ×
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <svg v-if="appMode === 'clipforge'" class="empty-icon" viewBox="0 0 24 24">
        <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9.5L9.5 15 8 13l-2 3h12l-3.5-4.5z"/>
      </svg>
      <svg v-else class="empty-icon" viewBox="0 0 24 24">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
      </svg>
      <h4>{{ emptyStateTitle }}</h4>
      <p>{{ emptyStateDescription }}</p>
      <button @click="handleImportClick" class="import-btn-large">
        Import Files
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useClipForgeMediaStore } from '../stores/clipforge/mediaStore';
import { useClipForgeTimelineStore } from '../stores/clipforge/timelineStore';
import ImportService from '../services/importService';
import { formatDuration, formatFileSize, getVideoCodecName } from '../../shared/utils/videoUtils';

// Props
const props = defineProps({
  appMode: {
    type: String,
    required: true
  }
});

const mediaStore = useClipForgeMediaStore();
const timelineStore = useClipForgeTimelineStore();

const importService = new ImportService(props.appMode);
const isDragOver = ref(false);
const selectedClip = ref(null);
const draggingClip = ref(null);


// Computed properties for dynamic text based on appMode
const libraryTitle = computed(() => {
  return 'Media Library';
});

const dropMessage = computed(() => {
  return 'Drop video files to import';
});

const emptyStateTitle = computed(() => {
  return 'No media files yet';
});

const emptyStateDescription = computed(() => {
  return 'Import video files to get started';
});

// File picker button
const handleImportClick = async () => {
  try {
    const filePaths = await importService.openFileDialog();
    if (filePaths.length > 0) {
      await importFiles(filePaths);
    }
  } catch (error) {
    console.error('Import error:', error);
    alert('Failed to import files. Please try again.');
  }
};

// Drag and drop
const handleDrop = async (event) => {
  isDragOver.value = false;
  
  const files = Array.from(event.dataTransfer.files);
  const { validFiles, invalidFiles } = importService.validateDroppedFiles(files);
  
  if (invalidFiles.length > 0) {
    alert(`Skipped ${invalidFiles.length} unsupported file(s): ${invalidFiles.join(', ')}`);
  }
  
  if (validFiles.length > 0) {
    const filePaths = validFiles.map(file => file.path);
    await importFiles(filePaths);
  }
};



// Import logic
const importFiles = async (filePaths) => {
  mediaStore.setImportStatus('importing');
  mediaStore.clearImportErrors();
  mediaStore.setImportProgress(0, filePaths.length);
  
  try {
    const { results, errors } = await importService.processFiles(
      filePaths,
      (current, total) => {
        mediaStore.setImportProgress(current, total);
      }
    );
    
    // Add successfully processed files to store
    const addedFileIds = [];
    results.forEach(fileData => {
      const fileId = mediaStore.addMediaFile(fileData);
      addedFileIds.push(fileId);
    });
    
    // Store errors
    errors.forEach(error => {
      mediaStore.addImportError(error);
    });
    
    mediaStore.setImportStatus(errors.length > 0 ? 'error' : 'success');
    
    
    // Clear success status after 2 seconds
    if (errors.length === 0) {
      setTimeout(() => {
        if (mediaStore.importStatus === 'success') {
          mediaStore.setImportStatus('idle');
        }
      }, 2000);
    }
  } catch (error) {
    console.error('Import failed:', error);
    mediaStore.setImportStatus('error');
    mediaStore.addImportError({
      filePath: 'N/A',
      fileName: 'Import Process',
      error: error.message
    });
  }
};

// Global drop zone
const handleGlobalDragOver = (event) => {
  // Only show import overlay for file drops, not for clip dragging
  if (event.dataTransfer.types.includes('Files')) {
    event.preventDefault();
    isDragOver.value = true;
  }
};

const handleGlobalDragLeave = (event) => {
  // Only set to false if we're leaving the window
  if (event.target === document.body) {
    isDragOver.value = false;
  }
};

// Media actions
const selectClip = (clip) => {
  selectedClip.value = clip.id;
  
  // Validate clip data before adding to timeline
  if (!clip || !clip.filePath || !clip.fileName) {
    console.error('Invalid clip data: missing required properties');
    return;
  }
  
  // Validate duration is a valid number
  const duration = parseFloat(clip.duration);
  if (isNaN(duration) || duration <= 0) {
    console.error('Invalid clip duration:', clip.duration);
    return;
  }
  
  // Validate dimensions with fallbacks
  const width = parseFloat(clip.width) || 1920;
  const height = parseFloat(clip.height) || 1080;
  
  // Add clip to timeline at current playhead position
  const timelineStore = useClipForgeTimelineStore();
  const playheadTime = timelineStore.playheadPosition;
  
  // Add to track 1 (main track)
  const trackId = timelineStore.tracks[0]?.id;
  if (trackId) {
    timelineStore.addClipToTrack(trackId, {
      id: `clip_${Date.now()}`,
      filePath: clip.filePath,
      fileName: clip.fileName,
      duration: duration,
      width: width,
      height: height,
      startTime: playheadTime,
      endTime: playheadTime + duration
    });
    
  } else {
    console.error('No track available to add clip');
  }
};

const handleDragStart = (event, clip) => {
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('application/json', JSON.stringify({
    type: 'media-clip',
    clip: {
      id: clip.id,
      filePath: clip.filePath,
      fileName: clip.fileName,
      duration: clip.duration,
      width: clip.width,
      height: clip.height
    }
  }));
  
  // Set dragging state and ensure import overlay doesn't show
  draggingClip.value = clip.id;
  isDragOver.value = false;
};

const handleDragEnd = (event) => {
  // Reset dragging state and overlay state
  draggingClip.value = null;
  isDragOver.value = false;
};

const handleDropOverlay = (event) => {
  event.preventDefault();
  isDragOver.value = true;
};

const handleDropLeave = (event) => {
  event.preventDefault();
  isDragOver.value = false;
};

const removeClip = (clipId) => {
  if (confirm('Remove this file from the media library?')) {
    mediaStore.removeMediaFile(clipId);
    if (selectedClip.value === clipId) {
      selectedClip.value = null;
    }
  }
};

const getCodecName = (codec) => {
  return getVideoCodecName(codec);
};

const getThumbnailSrc = (thumbnailPath) => {
  // Check if it's already a data URL (base64)
  if (thumbnailPath && thumbnailPath.startsWith('data:')) {
    return thumbnailPath;
  }
  // Fallback for file paths (though this might not work due to security)
  return thumbnailPath;
};

const handleThumbnailError = (event) => {
  // Hide the image and show placeholder
  const img = event.target;
  const placeholder = img.nextElementSibling;
  
  if (img) {
    img.style.display = 'none';
  }
  if (placeholder) {
    placeholder.style.display = 'flex';
  }
};

onMounted(() => {
  document.addEventListener('dragover', handleGlobalDragOver);
  document.addEventListener('dragleave', handleGlobalDragLeave);
});

onUnmounted(() => {
  document.removeEventListener('dragover', handleGlobalDragOver);
  document.removeEventListener('dragleave', handleGlobalDragLeave);
});
</script>

<style lang="scss" scoped>
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

.media-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  @include background-color('inputs-bg');
  padding: 4px;
  overflow: hidden;
  position: relative;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

.drop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 100, 255, 0.1);
  border: 3px dashed #0064ff;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.drop-message {
  text-align: center;
  color: #0064ff;
  @include font;
}

.drop-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.import-progress-bar {
  position: relative;
  height: 20px;
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: #0064ff;
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  @include font-color('font-color');
  font-size: 11px;
  font-weight: bold;
}

.import-errors {
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  padding: 6px;
  margin-bottom: 8px;
}

.error-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  @include font-color('font-color');
  font-weight: bold;
  margin-bottom: 4px;
  font-size: 11px;
}

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

.error-list {
  list-style: none;
  padding: 0;
  margin: 0;
  @include font-color('font-color');
  font-size: 10px;
}

.error-list li {
  padding: 2px 0;
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 2px;
}

.library-header h3 {
  margin: 0;
  @include font-color('font-color');
  font-size: 12px;
  font-weight: bold;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}


@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.import-btn {
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

.clips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 4px;
  overflow-y: auto;
  padding-right: 2px;
}

.clip-item {
  position: relative;
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  padding: 4px;
  cursor: pointer;
  min-height: 100px;
  
  &:hover {
    background: #d0d0d0;
  }
  
  &.selected {
    @include background-color('inputs-bg');
    box-shadow: inset 1px 1px 0 0 #000000, inset -1px -1px 0 0 #ffffff;
  }
  
  &.dragging {
    opacity: 0.5;
    background: #c0c0c0;
  }
}

.thumbnail-container {
  width: 100%;
  height: 60px;
  @include background-color('inputs-bg');
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 4px;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  overflow: hidden;
}

.thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumbnail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  @include background-color('inputs-bg');
  position: absolute;
  top: 0;
  left: 0;
}

.icon-video,
.icon-audio {
  width: 16px;
  height: 16px;
  fill: #808080;
}

.clip-info {
  padding: 2px 4px 4px 4px;
}

.filename {
  font-weight: bold;
  @include font-color('font-color');
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10px;
  line-height: 1.2;
}

.metadata {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 9px;
  @include font-color('font-color');
  margin-bottom: 1px;
}

.metadata-secondary {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 9px;
  @include font-color('font-color');
}

.separator {
  color: #808080;
}

.remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  @include d3-object;
  @include font;
  width: 16px;
  height: 16px;
  cursor: pointer;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  z-index: 10;
  
  &:hover {
    background: #ff0000;
    color: white;
  }
  
  &:active {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
}

.clip-item:hover .remove-btn {
  opacity: 1;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  @include font-color('font-color');
  text-align: center;
  padding: 20px 10px;
}

.empty-icon {
  width: 40px;
  height: 40px;
  fill: #808080;
  margin-bottom: 8px;
}

.empty-state h4 {
  margin: 0 0 4px 0;
  @include font-color('font-color');
  font-size: 12px;
  font-weight: bold;
}

.empty-state p {
  margin: 0 0 12px 0;
  font-size: 10px;
}

.import-btn-large {
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

/* Scrollbar styling */
.clips-grid::-webkit-scrollbar {
  width: 16px;
  height: 16px;
}

.clips-grid::-webkit-scrollbar-track {
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
}

.clips-grid::-webkit-scrollbar-thumb {
  @include d3-object;
  background: #c0c0c0;
  
  &:hover {
    background: #d0d0d0;
  }
}

.clips-grid::-webkit-scrollbar-corner {
  @include background-color('inputs-bg');
}

/* Recording badge styles */
.clip-item.is-recording {
  background: #c0c0c0;
  border-color: #ff0000;
}

.recording-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  background: #ff0000;
  color: white;
  padding: 1px 4px;
  font-size: 8px;
  font-weight: bold;
  z-index: 10;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}
</style>

