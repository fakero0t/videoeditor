<template>
  <div v-if="isVisible" class="dialog-overlay">
    <div class="progress-dialog">
      <h3>{{ title }}</h3>
      
      <div class="progress-container">
        <div class="file-info">
          <p v-if="currentFile">Copying: {{ currentFile }}</p>
          <p v-else>Preparing...</p>
        </div>
        
        <div class="progress-bar-container">
          <div class="progress-bar" :style="{ width: progressPercent + '%' }"></div>
        </div>
        
        <div class="progress-text">
          {{ current }} of {{ total }} files ({{ progressPercent }}%)
        </div>
      </div>
      
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
      
      <div v-if="canCancel" class="dialog-actions">
        <button @click="$emit('cancel')" class="cancel-btn">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  isVisible: Boolean,
  title: String,
  current: Number,
  total: Number,
  currentFile: String,
  error: String,
  canCancel: Boolean
});

const emit = defineEmits(['cancel']);

const progressPercent = computed(() => {
  if (props.total === 0) return 0;
  return Math.round((props.current / props.total) * 100);
});
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.progress-dialog {
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 24px;
  min-width: 400px;
  max-width: 600px;
}

.progress-dialog h3 {
  margin: 0 0 20px 0;
  color: #fff;
}

.progress-container {
  margin: 20px 0;
}

.file-info {
  margin-bottom: 12px;
}

.file-info p {
  margin: 0;
  color: #ccc;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-bar-container {
  height: 24px;
  background: #1a1a1a;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #007acc, #00a8ff);
  transition: width 0.3s ease;
}

.progress-text {
  color: #fff;
  font-size: 12px;
  text-align: center;
}

.error-message {
  background: #ff4444;
  color: white;
  padding: 12px;
  border-radius: 4px;
  margin-top: 16px;
}

.dialog-actions {
  margin-top: 20px;
  text-align: right;
}

.cancel-btn {
  background: #666;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn:hover {
  background: #777;
}
</style>
