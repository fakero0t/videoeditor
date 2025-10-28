<template>
  <div class="transport-controls">
    <button 
      @click="playPause" 
      :disabled="!hasClips"
      class="play-pause-btn"
      :class="{ playing: isPlaying }"
    >
      {{ isPlaying ? '⏸️' : '▶️' }}
    </button>
    
    <button 
      @click="stop" 
      :disabled="!hasClips"
      class="stop-btn"
    >
      ⏹️
    </button>
    
    <div class="time-display">
      {{ formatTime(currentTime) }} / {{ formatTime(totalDuration) }}
    </div>
    
    <div class="playback-speed">
      <label>Speed:</label>
      <select v-model="playbackSpeed" @change="updateSpeed">
        <option value="0.5">0.5x</option>
        <option value="1">1x</option>
        <option value="1.5">1.5x</option>
        <option value="2">2x</option>
      </select>
    </div>

    <button 
      @click="openExport" 
      :disabled="!hasClips"
      class="stop-btn"
    >
      Export
    </button>

    <ExportDialog :visible="showExport" @close="showExport = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useTimelineStore } from '../stores/timelineStore';
import { PlaybackManager } from '../../shared/playbackManager';
import { VideoPlayerPool } from '../../shared/videoPlayerPool';
import ExportDialog from './ExportDialog.vue';

const timelineStore = useTimelineStore();
const videoPlayerPool = new VideoPlayerPool();

// Create playback manager instance
let playbackManager = null;

onMounted(() => {
  playbackManager = new PlaybackManager(timelineStore, videoPlayerPool);
});

const isPlaying = ref(false);
const playbackSpeed = ref(1);
const showExport = ref(false);

const hasClips = computed(() => {
  return timelineStore.tracks.some(track => track.clips.length > 0);
});

const currentTime = computed(() => timelineStore.playheadPosition);

const totalDuration = computed(() => timelineStore.timelineDuration);

const playPause = () => {
  if (!playbackManager) return;
  
  if (isPlaying.value) {
    playbackManager.pause();
    isPlaying.value = false;
  } else {
    playbackManager.play();
    isPlaying.value = true;
  }
};

const stop = () => {
  if (!playbackManager) return;
  
  playbackManager.stop();
  isPlaying.value = false;
};

const updateSpeed = () => {
  if (!playbackManager) return;
  
  playbackManager.setPlaybackSpeed(parseFloat(playbackSpeed.value));
};

const openExport = () => {
  showExport.value = true;
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Keyboard shortcuts
const handleKeyDown = (event) => {
  if (event.code === 'Space' && !event.target.matches('input, textarea, select')) {
    event.preventDefault();
    playPause();
  }
  // Cmd/Ctrl+E for Export
  if ((event.metaKey || event.ctrlKey) && event.code === 'KeyE') {
    event.preventDefault();
    if (hasClips.value) openExport();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
  if (playbackManager) {
    playbackManager.cleanup();
  }
});
</script>

<style scoped>
.transport-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  height: 100%;
  background: #2a2a2a;
  border-top: 1px solid #333;
}

.play-pause-btn,
.stop-btn {
  background: #007acc;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
  min-width: 40px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-pause-btn:hover,
.stop-btn:hover {
  background: #005a9e;
}

.play-pause-btn:disabled,
.stop-btn:disabled {
  background: #555;
  cursor: not-allowed;
  opacity: 0.6;
}

.play-pause-btn.playing {
  background: #f59e0b;
}

.play-pause-btn.playing:hover {
  background: #d97706;
}

.time-display {
  color: #fff;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  min-width: 120px;
  text-align: center;
}

.playback-speed {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ccc;
  font-size: 14px;
}

.playback-speed label {
  font-weight: 500;
}

.playback-speed select {
  background: #444;
  color: #fff;
  border: 1px solid #666;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 14px;
  cursor: pointer;
}

.playback-speed select:focus {
  outline: none;
  border-color: #007acc;
}
</style>
