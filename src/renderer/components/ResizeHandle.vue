<template>
  <div 
    class="resize-handle"
    :class="[`resize-handle--${direction}`, { 'resize-handle--active': isDragging }]"
    @mousedown="startDrag"
    @dblclick="resetSize"
    :title="tooltip"
  >
    <div class="resize-handle__grip"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  direction: {
    type: String,
    required: true,
    validator: (value) => ['horizontal', 'vertical'].includes(value)
  },
  minSize: {
    type: Number,
    default: 100
  },
  maxSize: {
    type: Number,
    default: 800
  },
  tooltip: {
    type: String,
    default: 'Drag to resize'
  }
});

const emit = defineEmits(['resize', 'resize-start', 'resize-end', 'reset']);

const isDragging = ref(false);
const startPosition = ref(0);
const startSize = ref(0);

const startDrag = (event) => {
  event.preventDefault();
  isDragging.value = true;
  startPosition.value = props.direction === 'horizontal' ? event.clientX : event.clientY;
  
  // Get current size from the appropriate panel
  const layoutGrid = event.target.closest('.layout-grid');
  if (props.direction === 'horizontal') {
    const mediaPanel = layoutGrid?.querySelector('.media-library-panel');
    startSize.value = mediaPanel?.offsetWidth || 300;
  } else {
    const previewPanel = layoutGrid?.querySelector('.preview-window');
    startSize.value = previewPanel?.offsetHeight || 200;
  }
  
  emit('resize-start', { direction: props.direction, startPosition: startPosition.value, startSize: startSize.value });
  
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', endDrag);
  document.body.style.cursor = props.direction === 'horizontal' ? 'col-resize' : 'row-resize';
  document.body.style.userSelect = 'none';
};

const handleDrag = (event) => {
  if (!isDragging.value) return;
  
  const currentPosition = props.direction === 'horizontal' ? event.clientX : event.clientY;
  const delta = currentPosition - startPosition.value;
  const newSize = Math.max(props.minSize, Math.min(props.maxSize, startSize.value + delta));
  
  emit('resize', { 
    direction: props.direction, 
    newSize, 
    delta,
    currentPosition 
  });
};

const endDrag = () => {
  if (!isDragging.value) return;
  
  isDragging.value = false;
  emit('resize-end');
  
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', endDrag);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
};

const resetSize = () => {
  emit('reset', { direction: props.direction });
};

onUnmounted(() => {
  if (isDragging.value) {
    endDrag();
  }
});
</script>

<style lang="scss" scoped>
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

.resize-handle {
  position: relative;
  background: #c0c0c0;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  cursor: col-resize;
  z-index: 10;
  transition: background-color 0.1s ease;
  user-select: none;
  
  &:hover {
    background: #d0d0d0;
    box-shadow: inset 0 0 0 1px #808080;
  }
  
  &--active {
    background: #b0b0b0;
    box-shadow: inset 0 0 0 1px #606060;
  }
  
  &--horizontal {
    width: 4px;
    height: 100%;
    cursor: col-resize;
    
    .resize-handle__grip {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 2px;
      height: 20px;
      background: #808080;
      border-radius: 1px;
    }
  }
  
  &--vertical {
    width: 100%;
    height: 4px;
    cursor: row-resize;
    
    .resize-handle__grip {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 20px;
      height: 2px;
      background: #808080;
      border-radius: 1px;
    }
  }
}

.resize-handle:hover .resize-handle__grip {
  background: #606060;
}

.resize-handle--active .resize-handle__grip {
  background: #404040;
}
</style>
