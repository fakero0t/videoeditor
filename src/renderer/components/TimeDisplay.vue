<template>
  <div class="time-display">
    <div class="current-time">{{ formattedCurrentTime }}</div>
    <div class="separator">/</div>
    <div class="total-time">{{ formattedTotalTime }}</div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useTimelineStore } from '../stores/timelineStore';

const timelineStore = useTimelineStore();

const formattedCurrentTime = computed(() => {
  return formatTime(timelineStore.playheadPosition);
});

const formattedTotalTime = computed(() => {
  return formatTime(timelineStore.timelineDuration);
});

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30); // Assuming 30fps
  
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
};
</script>

<style scoped>
.time-display {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Courier New', monospace;
  font-size: 16px;
  color: #ffffff;
  background: #1a1a1a;
  padding: 8px 16px;
  border-radius: 4px;
}

.current-time {
  color: #4a90e2;
  font-weight: bold;
}

.separator {
  color: #666;
}

.total-time {
  color: #999;
}
</style>
