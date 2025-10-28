<template>
  <button
    @click="handleSplit"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    :disabled="!canSplit"
    :class="{ 'split-btn': true, 'disabled': !canSplit }"
    :title="splitTooltip"
  >
    <svg width="20" height="20" viewBox="0 0 20 20">
      <path d="M2 10 L18 10" stroke="currentColor" stroke-width="2"/>
      <path d="M10 2 L10 18" stroke="currentColor" stroke-width="2"/>
      <circle cx="10" cy="10" r="3" fill="currentColor"/>
    </svg>
    <span>Split</span>
    <span class="shortcut">S</span>
  </button>
  
  <!-- Split preview tooltip -->
  <div v-if="splitPreview && showPreview" class="split-preview">
    <div v-for="preview in splitPreview" :key="preview.clipId" class="preview-item">
      <div class="clip-name">{{ preview.clipName }}</div>
      <div class="split-details">
        <span class="left">← {{ formatDuration(preview.leftDuration) }}</span>
        <span class="divider">|</span>
        <span class="right">{{ formatDuration(preview.rightDuration) }} →</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useTimelineStore } from '../stores/timelineStore';
import SplitManager from '../../shared/splitManager';
import ClipSelectionManager from '../../shared/clipSelectionManager';

const timelineStore = useTimelineStore();
const clipSelectionManager = new ClipSelectionManager(timelineStore);
const splitManager = new SplitManager(timelineStore, clipSelectionManager);

const showPreview = ref(false);

const canSplit = computed(() => {
  return splitManager.canSplitAtPlayhead();
});

const splitPreview = computed(() => {
  return splitManager.getSplitPreview();
});

const splitTooltip = computed(() => {
  if (canSplit.value) {
    return 'Split clip(s) at playhead (S)';
  }
  return 'Position playhead over a clip to split';
});

const handleSplit = () => {
  if (canSplit.value) {
    const success = splitManager.splitAtPlayhead();
    if (success) {
      showPreview.value = false;
    }
  }
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Show preview on hover
const handleMouseEnter = () => {
  if (canSplit.value) {
    showPreview.value = true;
    // Show split indicator on timeline
    if (window.setSplitIndicator) {
      window.setSplitIndicator(true);
    }
  }
};

const handleMouseLeave = () => {
  showPreview.value = false;
  // Hide split indicator on timeline
  if (window.setSplitIndicator) {
    window.setSplitIndicator(false);
  }
};
</script>

<style scoped>
.split-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
  position: relative;
}

.split-btn:hover:not(.disabled) {
  background: #357abd;
}

.split-btn.disabled {
  background: #666;
  cursor: not-allowed;
  opacity: 0.5;
}

.shortcut {
  font-size: 11px;
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 3px;
}

.split-preview {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  background: rgba(0, 0, 0, 0.9);
  padding: 12px;
  border-radius: 6px;
  min-width: 200px;
  z-index: 1000;
}

.preview-item {
  margin-bottom: 8px;
}

.clip-name {
  font-size: 12px;
  color: #ccc;
  margin-bottom: 4px;
}

.split-details {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: bold;
}

.left {
  color: #4a90e2;
}

.divider {
  color: #666;
}

.right {
  color: #e24a90;
}
</style>
