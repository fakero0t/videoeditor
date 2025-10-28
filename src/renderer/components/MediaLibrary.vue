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
        <p>Drop video files to import</p>
      </div>
    </div>

    <!-- Import Status -->
    <div v-if="mediaStore.importStatus === 'importing'" class="import-progress-bar">
      <div class="progress-fill" :style="{ width: mediaStore.importingProgress + '%' }"></div>
      <span class="progress-text">
        Importing {{ mediaStore.importProgress.current }} of {{ mediaStore.importProgress.total }} files...
      </span>
    </div>

    <!-- Import Errors -->
    <div v-if="mediaStore.importErrors.length > 0" class="import-errors">
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
      <h3>Media Library</h3>
      <button @click="handleImportClick" class="import-btn" :disabled="mediaStore.importStatus === 'importing'">
        + Import Files
      </button>
    </div>

    <!-- Clips Grid -->
    <div v-if="mediaStore.hasMediaFiles" class="clips-grid">
      <div 
        v-for="clip in mediaStore.mediaFiles" 
        :key="clip.id"
        class="clip-item"
        :class="{ 
          'selected': selectedClip === clip.id,
          'dragging': draggingClip === clip.id
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
            <svg class="icon-video" viewBox="0 0 24 24">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
          </div>
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
      <svg class="empty-icon" viewBox="0 0 24 24">
        <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9.5L9.5 15 8 13l-2 3h12l-3.5-4.5z"/>
      </svg>
      <h4>No media files yet</h4>
      <p>Import video files to get started</p>
      <button @click="handleImportClick" class="import-btn-large">
        Import Files
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useMediaStore } from '../stores/mediaStore';
import importService from '../services/importService';
import { formatDuration, formatFileSize, getVideoCodecName } from '../../shared/utils/videoUtils';

const mediaStore = useMediaStore();
const isDragOver = ref(false);
const selectedClip = ref(null);
const draggingClip = ref(null);

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
    results.forEach(fileData => {
      mediaStore.addMediaFile(fileData);
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
  console.log('Selected clip:', clip);
  // TODO: Implement media selection for timeline
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

<style scoped>
.media-library {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e293b;
  padding: 16px;
  overflow: hidden;
  position: relative;
}

.drop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(59, 130, 246, 0.1);
  border: 3px dashed #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.drop-message {
  text-align: center;
  color: #3b82f6;
}

.drop-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.import-progress-bar {
  position: relative;
  height: 40px;
  background: #1e293b;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #06b6d4);
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 14px;
  font-weight: 500;
}

.import-errors {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 16px;
}

.error-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #dc2626;
  font-weight: 600;
  margin-bottom: 8px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #dc2626;
}

.error-list {
  list-style: none;
  padding: 0;
  margin: 0;
  color: #7f1d1d;
  font-size: 13px;
}

.error-list li {
  padding: 4px 0;
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.library-header h3 {
  margin: 0;
  color: #f1f5f9;
  font-size: 16px;
  font-weight: 600;
}

.import-btn {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s;
}

.import-btn:hover:not(:disabled) {
  background: #2563eb;
}

.import-btn:disabled {
  background: #6b7280;
  cursor: not-allowed;
}

.clips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  overflow-y: auto;
  padding-right: 4px;
}

.clip-item {
  position: relative;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 140px;
}

.clip-item:hover {
  border-color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.clip-item.selected {
  border-color: #3b82f6;
  background: #1e3a8a;
  box-shadow: 0 0 0 1px #3b82f6;
}

.clip-item.dragging {
  opacity: 0.5;
  transform: scale(0.95);
  border-color: #10b981;
  background: #064e3b;
  box-shadow: 0 0 0 1px #10b981;
}

.thumbnail-container {
  width: 100%;
  height: 90px;
  background: #1f2937;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 6px;
  border-radius: 4px;
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
  background: #1f2937;
  position: absolute;
  top: 0;
  left: 0;
}

.icon-video {
  width: 24px;
  height: 24px;
  fill: #64748b;
}

.clip-info {
  padding: 4px 8px 8px 8px;
}

.filename {
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 1.3;
}

.metadata {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 2px;
}

.metadata-secondary {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #94a3b8;
}

.separator {
  color: #64748b;
}

.media-thumbnail {
  width: 100%;
  height: 90px;
  background: #1f2937;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 6px;
  border-radius: 4px;
  overflow: hidden;
}

.media-thumbnail img {
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
  background: #1f2937;
  position: absolute;
  top: 0;
  left: 0;
}

.play-icon {
  font-size: 24px;
  opacity: 0.7;
  color: #64748b;
}

.media-info {
  padding: 4px 8px 8px 8px;
}

.file-name {
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 1.3;
}

.file-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.4;
}

.duration, .resolution, .codec {
  display: block;
  font-weight: 500;
}

.remove-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s;
  z-index: 10;
}

.clip-item:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: #ef4444;
  transform: scale(1.1);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  width: 80px;
  height: 80px;
  fill: #475569;
  margin-bottom: 16px;
}

.empty-state h4 {
  margin: 0 0 8px 0;
  color: #e2e8f0;
  font-size: 18px;
  font-weight: 600;
}

.empty-state p {
  margin: 0 0 24px 0;
  font-size: 14px;
}

.import-btn-large {
  padding: 12px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: background 0.2s;
}

.import-btn-large:hover {
  background: #2563eb;
}

/* Scrollbar styling */
.clips-grid::-webkit-scrollbar {
  width: 8px;
}

.clips-grid::-webkit-scrollbar-track {
  background: #0f172a;
  border-radius: 4px;
}

.clips-grid::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}

.clips-grid::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>

