<template>
  <div v-if="visible" class="export-backdrop" @click.self="emitClose">
    <div class="export-modal">
      <h3>Export Timeline</h3>

      <div class="form-row">
        <label>Resolution</label>
        <select v-model="resolution">
          <option value="source">Source</option>
          <option value="720p">720p</option>
          <option value="1080p">1080p</option>
          <option value="1440p">1440p</option>
          <option value="4k">4K</option>
        </select>
      </div>

      <div class="form-row">
        <label>FPS</label>
        <select v-model="fps">
          <option value="source">Source</option>
          <option value="30">30</option>
        </select>
      </div>

      <div class="form-row">
        <label>Quality</label>
        <select v-model="quality">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="ultra">Ultra</option>
        </select>
      </div>

      <div class="form-row">
        <label>Output</label>
        <div class="output-row">
          <input type="text" v-model="outputPath" readonly placeholder="Choose output file..." />
          <button @click="chooseOutput" :disabled="exporting">Browse</button>
        </div>
      </div>

      <div v-if="error" class="error">{{ error }}</div>

      <div v-if="exporting" class="progress">
        <div class="bar"><div class="fill" :style="{ width: progressPercent + '%' }"></div></div>
        <div class="meta">{{ progressPercent }}% • {{ progress.fps ? progress.fps + ' fps' : '' }} {{ progress.currentTime || '' }}</div>
      </div>

      <div class="actions">
        <button @click="startExport" :disabled="!canStart || exporting">Start Export</button>
        <button @click="cancelExport" v-if="exporting" class="danger">Cancel</button>
        <button @click="emitClose" :disabled="exporting">Close</button>
      </div>
    </div>
  </div>
  
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import { useTimelineStore } from '../stores/timelineStore';
import ffmpegService from '../../shared/ffmpegService';
import { buildExportPlan } from '../services/exportAssembler';

const props = defineProps({
  visible: { type: Boolean, default: false }
});
const emit = defineEmits(['close']);

const timelineStore = useTimelineStore();

const resolution = ref('source');
const fps = ref('source');
const quality = ref('medium');
const outputPath = ref('');
const exporting = ref(false);
const progress = ref({ percent: 0, currentTime: '', fps: 0 });
const unsubscribe = ref(null);
const error = ref('');

const hasClips = computed(() => timelineStore.tracks.some(t => t.clips.length > 0));
const canStart = computed(() => hasClips.value && !!outputPath.value);
const progressPercent = computed(() => Math.max(0, Math.min(100, progress.value.percent || 0)));

watch(() => props.visible, (v) => {
  if (!v) {
    // reset UI state when hidden
    exporting.value = false;
    progress.value = { percent: 0, currentTime: '', fps: 0 };
    error.value = '';
    if (unsubscribe.value) {
      unsubscribe.value();
      unsubscribe.value = null;
    }
  }
});

const chooseOutput = async () => {
  const defaultName = 'Project-Export.mp4';
  const filePath = await window.electronAPI.saveFile({
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    defaultPath: defaultName
  });
  if (filePath) {
    outputPath.value = filePath.endsWith('.mp4') ? filePath : `${filePath}.mp4`;
  }
};

const startExport = async () => {
  if (!canStart.value) return;
  error.value = '';
  exporting.value = true;
  try {
    await window.electronAPI.setPreventQuit(true);
    // Subscribe to progress
    unsubscribe.value = ffmpegService.onProgress((p) => {
      progress.value = p || { percent: 0 };
    });

    // Build plan
    const plan = await buildExportPlan(timelineStore.tracks, {
      resolution: resolution.value,
      fps: fps.value,
      quality: quality.value,
      output: outputPath.value
    });

    // Kick export
    const result = await ffmpegService.exportVideo(plan);
    if (!result || !result.success) {
      throw new Error('Export failed');
    }
  } catch (e) {
    error.value = e?.message || String(e);
  } finally {
    exporting.value = false;
    if (unsubscribe.value) {
      unsubscribe.value();
      unsubscribe.value = null;
    }
    await window.electronAPI.setPreventQuit(false);
  }
};

const cancelExport = async () => {
  try {
    await ffmpegService.cancelExport();
  } catch (_) {
    // ignore
  }
};

function emitClose() {
  emit('close');
}

onUnmounted(() => {
  if (unsubscribe.value) {
    unsubscribe.value();
    unsubscribe.value = null;
  }
});
</script>

<style scoped>
.export-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.export-modal {
  width: 420px;
  background: #1f1f1f;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 16px;
  color: #fff;
}

.export-modal h3 {
  margin: 0 0 12px 0;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.form-row label {
  color: #ccc;
}

select, input[type="text"] {
  background: #2a2a2a;
  border: 1px solid #444;
  color: #fff;
  padding: 6px 8px;
  border-radius: 4px;
  width: 220px;
}

.output-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.output-row input {
  flex: 1;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

button {
  background: #007acc;
  color: #fff;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background: #555;
  cursor: not-allowed;
}

button.danger {
  background: #ef4444;
}

.progress {
  margin-top: 10px;
}

.bar {
  height: 10px;
  background: #333;
  border-radius: 5px;
  overflow: hidden;
}

.fill {
  height: 10px;
  background: #22c55e;
  width: 0%;
}

.meta {
  margin-top: 6px;
  font-size: 12px;
  color: #ccc;
}

.error {
  color: #f87171;
  font-size: 12px;
  margin-bottom: 8px;
}
</style>


