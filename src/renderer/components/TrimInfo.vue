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
import { useTimelineStore } from '../stores/timelineStore';

const timelineStore = useTimelineStore();

const selectedClip = computed(() => {
  if (timelineStore.selectedClips.length === 1) {
    return timelineStore.getClipById(timelineStore.selectedClips[0]);
  }
  return null;
});

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${mins}:${secs.padStart(5, '0')}`;
};
</script>

<style scoped>
.trim-info {
  background: #2a2a2a;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.label {
  color: #999;
}

.value {
  color: #4a90e2;
  font-weight: bold;
}
</style>
