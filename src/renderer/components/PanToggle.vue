<template>
  <button 
    @click="togglePan" 
    :class="{ active: timelineStore.panMode }"
    class="pan-btn"
    title="Toggle pan mode (H)"
  >
    <span class="icon">✋</span> Pan
  </button>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useTimelineStore } from '../stores/timelineStore';

const timelineStore = useTimelineStore();

const togglePan = () => {
  timelineStore.setPanMode(!timelineStore.panMode);
};

// Listen for H key globally
const handleKeyDown = (event) => {
  if (event.key.toLowerCase() === 'h' && !event.target.matches('input, textarea')) {
    event.preventDefault();
    togglePan();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.pan-btn {
  background: #444;
  border: 1px solid #666;
  color: white;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 3px;
  font-size: 12px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.pan-btn:hover {
  background: #555;
}

.pan-btn.active {
  background: #007acc;
  border-color: #005a9e;
}

.icon {
  font-size: 14px;
}
</style>
