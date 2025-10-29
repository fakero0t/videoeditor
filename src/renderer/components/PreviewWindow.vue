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
        style="min-width: 100px; min-height: 100px;"
      >
        <video
          ref="videoElement"
          :src="videoSrc"
          preload="metadata"
          controls
          playsinline
          webkit-playsinline
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
          <p>No clip selected</p>
          <p class="no-preview-subtitle">Click on a clip in the timeline to preview</p>
        </div>
      </div>
      
      <div v-if="isLoading && currentClip" class="loading-overlay">
        <div class="loading-spinner"></div>
        <p>Loading video...</p>
      </div>
      
      <div v-if="hasError && currentClip" class="error-overlay">
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
import MultiTrackCompositor from '../../shared/multiTrackCompositor';

const timelineStore = useTimelineStore();
const previewContainer = ref(null);
const videoElement = ref(null);
const playerPool = new VideoPlayerPool();
const compositor = new MultiTrackCompositor();

// Natural video dimensions and container observer for responsive fitting
const naturalVideoWidth = ref(0);
const naturalVideoHeight = ref(0);
const containerSize = ref({ width: 0, height: 0 });
let resizeObserver = null;

const currentTime = ref(0);
const isPlaying = ref(false);
const videoAspectRatio = ref(16/9);
const isLoading = ref(false);
const hasError = ref(false);

const currentClip = computed(() => {
  const playheadTime = timelineStore.playheadPosition;
  
  // Use multi-track compositor to find the best clip to display
  // Priority: Track 2 (overlay) > Track 1 (background)
  const compositeInfo = compositor.getCompositeInfo(timelineStore.tracks, playheadTime);
  
  return compositeInfo.primaryClip;
});

// Normalize absolute path to exactly file:///...
const buildFileUrl = (absPath) => {
  const encoded = absPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
  const trimmed = encoded.replace(/^\/+/, '');
  return `file:///${trimmed}`;
};

const videoSrc = computed(() => {
  if (!currentClip.value?.filePath) {
    return '';
  }
  
  // Convert file path to proper file:// URL for Electron
  const filePath = currentClip.value.filePath;
  
  // Check if it's already a file:// URL
  if (filePath.startsWith('file://')) {
    return filePath;
  }
  
  // Convert absolute path to file:// URL
  if (filePath.startsWith('/')) {
    const fileUrl = buildFileUrl(filePath);
    return fileUrl;
  }
  
  // For relative paths, convert to absolute first
  const fileUrl = buildFileUrl(filePath);
  return fileUrl;
});

// Force wrapper to fill container to avoid 0×0 visibility issues
// Fit strategy: scale down to fit container, preserve aspect ratio, no upscaling
const videoWrapperStyle = computed(() => {
  const cw = containerSize.value.width || previewContainer.value?.clientWidth || 0;
  const ch = containerSize.value.height || previewContainer.value?.clientHeight || 0;
  const vw = naturalVideoWidth.value || 0;
  const vh = naturalVideoHeight.value || 0;
  
  // If video dimensions not yet available, use full container size
  if (!vw || !vh) {
    return { width: '100%', height: '100%' };
  }
  
  // If container has no size, use min fallback
  if (!cw || !ch) {
    return { width: '320px', height: '240px', margin: '0 auto' };
  }
  
  const scale = Math.min(cw / vw, ch / vh, 1);
  let w = Math.floor(vw * scale);
  let h = Math.floor(vh * scale);
  
  // Ensure minimum size
  w = Math.max(w, 100);
  h = Math.max(h, 100);
  
  return { width: `${w}px`, height: `${h}px`, margin: '0 auto' };
});

// Watch for state changes
watch([currentClip, () => videoSrc.value, isLoading, hasError], 
  ([clip, src, loading, error]) => {
    // State change detected - no logging needed for performance
  }, 
  { immediate: true }
);

const onVideoLoaded = () => {
  const video = videoElement.value;
  if (!video) return;
  
  // Record natural dimensions and aspect ratio for fitting
  naturalVideoWidth.value = video.videoWidth;
  naturalVideoHeight.value = video.videoHeight;
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
  const video = videoElement.value;
  if (video && video.videoWidth && video.videoHeight) {
    naturalVideoWidth.value = video.videoWidth;
    naturalVideoHeight.value = video.videoHeight;
    videoAspectRatio.value = video.videoWidth / video.videoHeight;
  }
  isLoading.value = false;
};

const onVideoCanPlay = () => {
  const video = videoElement.value;
  if (video && video.videoWidth && video.videoHeight) {
    naturalVideoWidth.value = video.videoWidth;
    naturalVideoHeight.value = video.videoHeight;
    videoAspectRatio.value = video.videoWidth / video.videoHeight;
  }
  isLoading.value = false;
};

const onVideoPlay = () => {
  isPlaying.value = true;
};

const onVideoPause = () => {
  isPlaying.value = false;
};

const onVideoWaiting = () => {
  isLoading.value = true;
};

const onVideoStalled = () => {
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

let lastTimeUpdate = 0;
const onTimeUpdate = () => {
  const now = performance.now();
  if (now - lastTimeUpdate > 33) { // 30fps throttling
    if (videoElement.value) {
      currentTime.value = videoElement.value.currentTime;
    }
    lastTimeUpdate = now;
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
    isLoading.value = true;
    hasError.value = false;
    isPlaying.value = false;
    
    await nextTick();
    
    // Update video source only if it actually changed
    if (videoElement.value) {
      const newSrc = videoSrc.value;
      if (videoElement.value.src !== newSrc) {
        videoElement.value.src = newSrc;
        videoElement.value.load();
      }
      // Reset current time
      videoElement.value.currentTime = 0;
    }
  } else if (!newClip) {
    // No clip selected - clear all states
    if (videoElement.value) {
      videoElement.value.pause();
      videoElement.value.src = '';
      isPlaying.value = false;
    }
    // Clear error state when no clip is selected
    hasError.value = false;
    isLoading.value = false;
  }
});

onMounted(() => {
  // Initialize video element
  if (currentClip.value) {
    isLoading.value = true;
  }

  // Initialize container size + observer for responsive fitting
  if (previewContainer.value) {
    const el = previewContainer.value;
    containerSize.value = { width: el.clientWidth, height: el.clientHeight };
    resizeObserver = new ResizeObserver(entries => {
      const cr = entries[0].contentRect;
      containerSize.value = { width: cr.width, height: cr.height };
    });
    resizeObserver.observe(el);
  }
});

onUnmounted(() => {
  // Cleanup video players
  playerPool.cleanup();
  compositor.cleanup();

  // Cleanup observer
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});

// Watch video element for updates
watch(videoElement, (newEl) => {
  // Video element reference updated
}, { immediate: true });
</script>

<style lang="scss" scoped>
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

.preview-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  @include background-color('inputs-bg');
  @include font-color('font-color');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  @include background-color('inputs-bg');
  border-bottom: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

.preview-header h3 {
  margin: 0;
  font-size: 11px;
  font-weight: bold;
  @include font-color('font-color');
}

.time-display {
  font-family: 'Courier New', monospace;
  font-size: 10px;
  @include font-color('font-color');
  padding: 2px 4px;
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

.preview-container {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  overflow: hidden;
  max-height: 100%;
  min-height: 150px;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  margin: 2px;
}

.video-wrapper {
  position: relative;
  max-width: 100% !important;
  max-height: 100% !important;
  background: #000;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

.video-wrapper video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  min-width: 100px;
  min-height: 100px;
  background: #000;
  transition: opacity 0.1s ease-in-out;
}

.no-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  @include font-color('font-disabled');
}

.no-preview-content {
  text-align: center;
}


.no-preview p {
  margin: 4px 0;
  font-size: 11px;
}

.no-preview-subtitle {
  @include font-color('font-disabled');
  font-size: 10px;
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
  @include font-color('font-color');
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid #808080;
  border-top: 2px solid #0000ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 8px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.retry-button {
  @include d3-object;
  @include font;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 10px;
  margin-top: 4px;
  
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

.preview-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  @include background-color('inputs-bg');
  border-top: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

.time-info {
  font-family: 'Courier New', monospace;
  font-size: 10px;
  @include font-color('font-color');
  text-align: center;
  width: 100%;
  padding: 2px 4px;
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

.current-time {
  @include font-color('font-color');
}

.duration {
  @include font-color('font-disabled');
}
</style>
