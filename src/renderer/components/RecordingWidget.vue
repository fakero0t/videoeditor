<template>
  <div 
    class="recording-widget" 
    :style="widgetStyle"
    @mousedown="startDrag"
  >
    <div class="widget-content">
      <div class="recording-indicator">
        <span class="recording-dot">●</span>
        <span class="recording-text">REC</span>
      </div>
      
      <div class="recording-time">
        {{ recordingStore.recordingDurationFormatted }}
      </div>
      
      <div v-if="recordingStore.selectedMicrophoneSource" class="audio-level-mini">
        <div 
          class="audio-bar" 
          :style="{ width: recordingStore.audioLevel + '%', backgroundColor: getAudioLevelColor() }"
        ></div>
      </div>
      
      <div class="widget-controls">
        <button @click="$emit('restore')" class="widget-btn" title="Restore">
          ⬆
        </button>
        <button @click="$emit('stop')" class="widget-btn stop" title="Stop">
          ■
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useClipForgeRecordingStore } from '../stores/clipforge/recordingStore';

const props = defineProps({
  appMode: {
    type: String,
    default: 'clipforge'
  }
});

const recordingStore = useClipForgeRecordingStore();

const emit = defineEmits(['restore', 'stop']);

// Widget positioning (resets to center on mount)
const widgetStyle = ref({
  top: '20px',
  right: '20px'
});

const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

const startDrag = (event) => {
  if (event.target.classList.contains('widget-btn')) return;
  
  isDragging.value = true;
  const rect = event.currentTarget.getBoundingClientRect();
  dragOffset.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
  
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
};

const handleDrag = (event) => {
  if (!isDragging.value) return;
  
  const newLeft = event.clientX - dragOffset.value.x;
  const newTop = event.clientY - dragOffset.value.y;
  
  widgetStyle.value = {
    top: newTop + 'px',
    left: newLeft + 'px',
    right: 'auto'
  };
};

const stopDrag = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
};

const getAudioLevelColor = () => {
  const level = recordingStore.audioLevel;
  if (level > 80) return '#ff4444';
  if (level > 60) return '#ffaa00';
  return '#00ff00';
};

onMounted(() => {
  // Widget resets to default position on each recording
  widgetStyle.value = {
    top: '20px',
    right: '20px'
  };
});
</script>

<style scoped>
.recording-widget {
  position: fixed;
  background: #1a1a1a;
  border: 2px solid #ff0000;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7);
  z-index: 2000;
  cursor: move;
  user-select: none;
}

.widget-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.recording-dot {
  color: #ff0000;
  font-size: 16px;
  animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.recording-text {
  color: #ff0000;
  font-weight: bold;
  font-size: 14px;
}

.recording-time {
  color: #fff;
  font-family: monospace;
  font-size: 16px;
  font-weight: bold;
  min-width: 80px;
}

.audio-level-mini {
  width: 60px;
  height: 8px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
}

.audio-bar {
  height: 100%;
  transition: width 0.1s ease, background-color 0.2s ease;
}

.widget-controls {
  display: flex;
  gap: 6px;
}

.widget-btn {
  background: #444;
  border: 1px solid #666;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.widget-btn:hover {
  background: #555;
}

.widget-btn.stop {
  background: #ff4444;
  border-color: #ff0000;
}

.widget-btn.stop:hover {
  background: #ff0000;
}
</style>
