<template>
  <button 
    @click="togglePan" 
    :class="{ active: timelineStore.panMode }"
    class="pan-btn"
    title="Toggle pan mode (H)"
  >
    Pan
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

<style lang="scss" scoped>
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

.pan-btn {
  @include d3-object;
  @include font;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  
  &:hover:not(.active) {
    background: #d0d0d0;
  }
  
  &:active:not(.active) {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
  
  &.active {
    background: #0000ff;
    color: white;
    box-shadow: inset 1px 1px 0 0 #000000, inset -1px -1px 0 0 #ffffff;
  }
}
</style>
