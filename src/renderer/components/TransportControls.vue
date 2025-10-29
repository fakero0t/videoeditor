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
    
    <PanToggle />
    
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
import PanToggle from './PanToggle.vue';

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

<style lang="scss" scoped>
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

.transport-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  height: 100%;
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

.play-pause-btn,
.stop-btn {
  @include d3-object;
  @include font;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 11px;
  min-width: 32px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  
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
  
  &.playing {
    background: #ffff00;
    @include font-color('font-color');
  }
  
  &.playing:hover {
    background: #ffff80;
  }
}

.time-display {
  @include font-color('font-color');
  font-family: 'Courier New', monospace;
  font-size: 11px;
  min-width: 100px;
  text-align: center;
  padding: 2px 4px;
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

.playback-speed {
  display: flex;
  align-items: center;
  gap: 4px;
  @include font-color('font-color');
  font-size: 11px;
}

.playback-speed label {
  font-weight: bold;
}

.playback-speed select {
  @include background-color('inputs-bg');
  @include font-color('font-color');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  padding: 2px 4px;
  font-size: 11px;
  cursor: pointer;
  font-family: $font-family;
  
  &:focus {
    outline: none;
    box-shadow: inset 1px 1px 0 0 #000000, inset -1px -1px 0 0 #ffffff;
  }
}
</style>
