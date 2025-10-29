<template>
  <button @click="$emit('back')" class="back-button" title="Back to Launcher">
    <span class="back-arrow">←</span>
    <span class="back-text">Back</span>
  </button>
</template>

<script setup>
// Emit back event
defineEmits(['back']);
</script>

<style lang="scss">
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

.back-button {
  @include d3-object;
  @include font;
  background: #c0c0c0;
  color: #000000;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 11px;
  font-weight: normal;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 8px;
  
  &:hover {
    background: #d0d0d0;
  }
  
  &:active {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
}

.back-arrow {
  font-size: 12px;
  font-weight: bold;
  line-height: 1;
}

.back-text {
  font-size: 11px;
}

/* Focus styles for accessibility */
.back-button:focus {
  outline: 1px solid #000000;
  outline-offset: 1px;
}

/* Disabled state */
.back-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #c0c0c0;
  
  &:hover {
    background: #c0c0c0;
  }
  
  &:active {
    box-shadow: none;
    @include border-shadow('content-shadow');
    @include border-color-tl('content-border-left');
    @include border-color-rb('content-border-right');
  }
}
</style>
