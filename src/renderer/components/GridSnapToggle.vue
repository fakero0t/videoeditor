<template>
  <div class="snap-controls">
    <button 
      @click="toggleSnap" 
      :class="{ active: snapEnabled }"
      class="snap-btn"
      title="Toggle snap to clips"
    >
      🧲 Snap
    </button>
    
    <button 
      @click="toggleGridSnap" 
      :class="{ active: gridSnapEnabled }"
      class="grid-snap-btn"
      title="Toggle grid snap"
    >
      ⊞ Grid
    </button>
    
    <div v-if="gridSnapEnabled" class="grid-interval">
      <label>Interval:</label>
      <select v-model="gridInterval" @change="updateGridInterval">
        <option value="0.1">0.1s</option>
        <option value="0.5">0.5s</option>
        <option value="1">1s</option>
        <option value="5">5s</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  dragDropManager: Object
});

const snapEnabled = ref(true);
const gridSnapEnabled = ref(false);
const gridInterval = ref(1);

const toggleSnap = () => {
  snapEnabled.value = !snapEnabled.value;
  if (props.dragDropManager) {
    props.dragDropManager.snapEnabled = snapEnabled.value;
  }
};

const toggleGridSnap = () => {
  gridSnapEnabled.value = !gridSnapEnabled.value;
  if (props.dragDropManager) {
    props.dragDropManager.gridSnapEnabled = gridSnapEnabled.value;
  }
};

const updateGridInterval = () => {
  if (props.dragDropManager) {
    props.dragDropManager.gridInterval = parseFloat(gridInterval.value);
  }
};

// Watch for changes and update the drag drop manager
watch([snapEnabled, gridSnapEnabled, gridInterval], () => {
  if (props.dragDropManager) {
    props.dragDropManager.snapEnabled = snapEnabled.value;
    props.dragDropManager.gridSnapEnabled = gridSnapEnabled.value;
    props.dragDropManager.gridInterval = parseFloat(gridInterval.value);
  }
});
</script>

<style scoped>
.snap-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #2a2a2a;
  border-radius: 4px;
  border: 1px solid #444;
}

.snap-btn,
.grid-snap-btn {
  background: #444;
  border: 1px solid #666;
  color: white;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 3px;
  font-size: 12px;
  transition: all 0.2s;
}

.snap-btn:hover,
.grid-snap-btn:hover {
  background: #555;
}

.snap-btn.active,
.grid-snap-btn.active {
  background: #007acc;
  border-color: #005a9e;
}

.grid-interval {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}

.grid-interval label {
  color: #ccc;
  font-size: 11px;
}

.grid-interval select {
  background: #333;
  border: 1px solid #555;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
}
</style>
