<template>
  <div class="preview-window">
    <div class="preview-header">
      <h3>Preview</h3>
      <div class="time-display">{{ formatTime(currentTime) }}</div>
    </div>
    
    <div class="preview-container" ref="previewContainer">
      <div 
        v-if="currentClip"
        class="video-wrapper"
        :style="videoWrapperStyle"
      >
        <video
          ref="videoElement"
          :src="videoSrc"
          preload="metadata"
          controls
          @loadedmetadata="onVideoLoaded"
          @error="onVideoError"
          @timeupdate="onTimeUpdate"
          @loadeddata="onVideoLoadedData"
          @canplay="onVideoCanPlay"
          @play="onVideoPlay"
          @pause="onVideoPause"
          @waiting="onVideoWaiting"
          @stalled="onVideoStalled"
        ></video>
      </div>
      
      <div v-else class="no-preview">
        <div class="no-preview-content">
          <div class="no-preview-icon">🎬</div>
          <p>No clip selected</p>
          <p class="no-preview-subtitle">Click on a clip in the timeline to preview</p>
        </div>
      </div>
      
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <p>Loading video...</p>
      </div>
      
      <div v-if="hasError" class="error-overlay">
        <div class="error-icon">⚠️</div>
        <p>Error loading video</p>
        <button @click="retryLoad" class="retry-button">Retry</button>
      </div>
    </div>
    
    <div class="preview-controls">
      <div class="time-info">
        <span class="current-time">{{ formatTime(currentTime) }}</span>
        <span v-if="currentClip" class="duration">/ {{ formatTime(currentClip.duration) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useTimelineStore } from '../stores/timelineStore';
import { VideoPlayerPool } from '../../shared/videoPlayerPool';

const timelineStore = useTimelineStore();
const previewContainer = ref(null);
const videoElement = ref(null);
const playerPool = new VideoPlayerPool();

const currentTime = ref(0);
const isPlaying = ref(false);
const videoAspectRatio = ref(16/9);
const isLoading = ref(false);
const hasError = ref(false);

const currentClip = computed(() => {
  const playheadTime = timelineStore.playheadPosition;
  
  // Find which clip is at the current playhead position
  for (const track of timelineStore.tracks) {
    for (const clip of track.clips) {
      if (playheadTime >= clip.startTime && playheadTime < (clip.startTime + clip.duration)) {
        return clip;
      }
    }
  }
  return null;
});

const videoSrc = computed(() => {
  if (!currentClip.value?.filePath) return '';
  
  // Convert file path to proper file:// URL for Electron
  const filePath = currentClip.value.filePath;
  
  console.log('Original file path:', filePath);
  
  // Check if it's already a file:// URL
  if (filePath.startsWith('file://')) {
    console.log('Using existing file:// URL:', filePath);
    return filePath;
  }
  
  // Convert absolute path to file:// URL
  if (filePath.startsWith('/')) {
    // Encode the file path to handle spaces and special characters
    const encodedPath = filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const fileUrl = `file://${encodedPath}`;
    console.log('Converted to file:// URL:', fileUrl);
    return fileUrl;
  }
  
  // For relative paths, convert to absolute first
  const encodedPath = filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
  const fileUrl = `file://${encodedPath}`;
  console.log('Converted relative path to file:// URL:', fileUrl);
  return fileUrl;
});

const videoWrapperStyle = computed(() => {
  if (!videoAspectRatio.value || !previewContainer.value) return {};
  
  const container = previewContainer.value;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  const containerAspectRatio = containerWidth / containerHeight;
  
  if (videoAspectRatio.value > containerAspectRatio) {
    // Video is wider - fit to width (letterbox)
    return {
      width: '100%',
      height: `${containerWidth / videoAspectRatio.value}px`,
      margin: '0 auto'
    };
  } else {
    // Video is taller - fit to height (pillarbox)
    return {
      width: `${containerHeight * videoAspectRatio.value}px`,
      height: '100%',
      margin: '0 auto'
    };
  }
});

const onVideoLoaded = () => {
  const video = videoElement.value;
  if (!video) return;
  
  console.log('Video loaded metadata:', {
    duration: video.duration,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    readyState: video.readyState,
    networkState: video.networkState
  });
  
  videoAspectRatio.value = video.videoWidth / video.videoHeight;
  isLoading.value = false;
  hasError.value = false;
  
  // Set video time to match timeline position
  const playheadTime = timelineStore.playheadPosition;
  const clip = currentClip.value;
  if (clip) {
    const relativeTime = playheadTime - clip.startTime;
    video.currentTime = Math.max(0, Math.min(relativeTime, clip.duration));
  }
};

const onVideoLoadedData = () => {
  isLoading.value = false;
};

const onVideoCanPlay = () => {
  console.log('Video can play');
  isLoading.value = false;
};

const onVideoPlay = () => {
  console.log('Video started playing');
  isPlaying.value = true;
};

const onVideoPause = () => {
  console.log('Video paused');
  isPlaying.value = false;
};

const onVideoWaiting = () => {
  console.log('Video waiting for data');
  isLoading.value = true;
};

const onVideoStalled = () => {
  console.log('Video stalled');
  isLoading.value = true;
};

const onVideoError = (event) => {
  const video = event.target;
  const error = video.error;
  
  console.error('Video playback error:', {
    event,
    error,
    errorCode: error?.code,
    errorMessage: error?.message,
    networkState: video.networkState,
    readyState: video.readyState,
    src: video.src,
    currentSrc: video.currentSrc,
    originalFilePath: currentClip.value?.filePath,
    computedVideoSrc: videoSrc.value
  });
  
  // Additional debugging for common issues
  if (error?.code === 4) {
    console.error('DEMUXER_ERROR: This usually means the video file format is not supported or the file is corrupted');
    console.error('File path being used:', video.src);
    console.error('Original file path:', currentClip.value?.filePath);
  }
  
  isLoading.value = false;
  hasError.value = true;
};

const onTimeUpdate = () => {
  if (videoElement.value) {
    currentTime.value = videoElement.value.currentTime;
  }
};


const retryLoad = () => {
  hasError.value = false;
  if (videoElement.value) {
    videoElement.value.load();
  }
};

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Watch for timeline changes
watch(() => timelineStore.playheadPosition, (newTime) => {
  const video = videoElement.value;
  if (!video || !currentClip.value) return;
  
  const clip = currentClip.value;
  const relativeTime = newTime - clip.startTime;
  
  if (relativeTime >= 0 && relativeTime < clip.duration) {
    // Only update if difference is significant (avoid unnecessary seeks)
    if (Math.abs(video.currentTime - relativeTime) > 0.1) {
      video.currentTime = relativeTime;
    }
  }
});

watch(() => currentClip.value, async (newClip, oldClip) => {
  if (newClip && newClip.id !== oldClip?.id) {
    console.log('Loading new clip:', {
      id: newClip.id,
      filePath: newClip.filePath,
      fileName: newClip.fileName,
      duration: newClip.duration,
      videoSrc: videoSrc.value
    });
    
    isLoading.value = true;
    hasError.value = false;
    isPlaying.value = false;
    
    await nextTick();
    
    // Update video source
    if (videoElement.value) {
      console.log('Setting video src to:', videoSrc.value);
      
      // Clear previous source first
      videoElement.value.src = '';
      videoElement.value.load();
      
      // Set new source
      videoElement.value.src = videoSrc.value;
      videoElement.value.load();
      
      // Reset current time
      videoElement.value.currentTime = 0;
    }
  } else if (!newClip) {
    // No clip selected
    if (videoElement.value) {
      videoElement.value.pause();
      videoElement.value.src = '';
      isPlaying.value = false;
    }
  }
});

onMounted(() => {
  // Initialize video element
  if (currentClip.value) {
    isLoading.value = true;
  }
});

onUnmounted(() => {
  // Cleanup video players
  playerPool.cleanup();
});
</script>

<style scoped>
.preview-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #000;
  color: white;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: #1a1a1a;
  border-bottom: 1px solid #333;
}

.preview-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.time-display {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #ccc;
}

.preview-container {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  overflow: hidden;
}

.video-wrapper {
  position: relative;
  max-width: 100%;
  max-height: 100%;
}

.video-wrapper video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.no-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
}

.no-preview-content {
  text-align: center;
}

.no-preview-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.no-preview p {
  margin: 8px 0;
  font-size: 14px;
}

.no-preview-subtitle {
  color: #888;
  font-size: 12px;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  color: white;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #333;
  border-top: 3px solid #007acc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.retry-button {
  background: #007acc;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  margin-top: 8px;
}

.retry-button:hover {
  background: #005a9e;
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 15px;
  background: #1a1a1a;
  border-top: 1px solid #333;
}


.time-info {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #ccc;
  text-align: center;
  width: 100%;
}

.current-time {
  color: #fff;
}

.duration {
  color: #888;
}
</style>
