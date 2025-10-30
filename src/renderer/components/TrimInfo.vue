<template>
  <div v-if="selectedClip" class="trim-info">
    <div class="info-row">
      <span class="label">Trim Start:</span>
      <span class="value">{{ formatTime(selectedClip.trimStart || 0) }}</span>
    </div>
    <div class="info-row">
      <span class="label">Trim End:</span>
      <span class="value">{{ formatTime(selectedClip.trimEnd || selectedClip.sourceDuration) }}</span>
    </div>
    <div class="info-row">
      <span class="label">Clip Duration:</span>
      <span class="value">{{ formatTime(selectedClip.duration) }}</span>
    </div>
    <div class="info-row">
      <span class="label">Source Duration:</span>
      <span class="value">{{ formatTime(selectedClip.sourceDuration) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useClipForgeTimelineStore } from '../stores/clipforge/timelineStore';

const props = defineProps({
  appMode: {
    type: String,
    default: 'clipforge'
  }
});

const timelineStore = useClipForgeTimelineStore();

const selectedClip = computed(() => {
  if (timelineStore.selectedClips.length === 1) {
    return timelineStore.getClipById(timelineStore.selectedClips[0]);
  }
  return null;
});

const formatTime = (seconds) => {
  // Validate input
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) {
    return '0:00.00';
  }
  
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${mins}:${secs.padStart(5, '0')}`;
};
</script>

<style lang="scss" scoped>
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

.trim-info {
  @include background-color('inputs-bg');
  padding: 6px;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  font-size: 10px;
  margin: 4px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 3px;
}

.label {
  @include font-color('font-disabled');
}

.value {
  @include font-color('font-color');
  font-weight: bold;
  font-family: 'Courier New', monospace;
}
</style>
