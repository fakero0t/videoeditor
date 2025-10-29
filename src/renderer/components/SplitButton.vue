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

<style lang="scss" scoped>
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

.split-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  @include d3-object;
  @include font;
  cursor: pointer;
  font-size: 11px;
  position: relative;
  
  &:hover:not(.disabled) {
    background: #d0d0d0;
  }
  
  &:active:not(.disabled) {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
  
  &.disabled {
    @include font-color('font-disabled');
    cursor: not-allowed;
  }
}

.shortcut {
  font-size: 9px;
  @include background-color('inputs-bg');
  padding: 1px 4px;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

.split-preview {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  @include background-color('inputs-bg');
  padding: 6px;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  min-width: 150px;
  z-index: 1000;
}

.preview-item {
  margin-bottom: 4px;
}

.clip-name {
  font-size: 10px;
  @include font-color('font-color');
  margin-bottom: 2px;
}

.split-details {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: bold;
}

.left {
  @include font-color('font-color');
}

.divider {
  @include font-color('font-disabled');
}

.right {
  @include font-color('font-color');
}
</style>
