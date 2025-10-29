<template>
  <div v-if="visible" class="export-backdrop">
    <div class="export-modal">
      <div class="export-header">
        <span>Export Timeline</span>
      </div>
      
      <div class="export-content">
        <div class="form-row">
          <label>Resolution:</label>
          <select v-model="resolution">
            <option value="source">Source</option>
            <option value="720p" :disabled="!resolutionAvailable('720p')">720p</option>
            <option value="1080p" :disabled="!resolutionAvailable('1080p')">1080p</option>
            <option value="1440p" :disabled="!resolutionAvailable('1440p')">1440p</option>
            <option value="4k" :disabled="!resolutionAvailable('4k')">4K</option>
          </select>
        </div>

        <div class="form-row">
          <label>FPS:</label>
          <select v-model="fps">
            <option value="source">Source</option>
            <option value="30">30</option>
          </select>
        </div>

        <div class="form-row">
          <label>Quality:</label>
          <select v-model="quality">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="ultra">Ultra</option>
          </select>
        </div>

        <div class="form-row">
          <label>Output:</label>
          <div class="output-row">
            <input type="text" v-model="outputPath" readonly placeholder="Choose output file..." />
            <button @click="chooseOutput" :disabled="exporting">Browse...</button>
          </div>
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>
        <div v-if="exportSuccess" class="success-message">Export completed successfully!</div>

        <div v-if="exporting" class="progress-section">
          <div class="progress-label">Exporting...</div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <div class="progress-text">
            {{ progressPercent }}% • {{ progress.fps ? progress.fps + ' fps' : '' }} {{ progress.currentTime || '' }}
          </div>
        </div>

        <div class="actions">
          <button @click="startExport" :disabled="!canStart || exporting || exportSuccess" class="primary-btn">
            {{ exporting ? 'Exporting...' : 'Start Export' }}
          </button>
          <button @click="cancelExport" v-if="exporting" class="cancel-btn">Cancel</button>
          <button @click="emitClose">Close</button>
        </div>
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
  visible: { type: Boolean, default: false },
  appMode: { type: String, default: 'clipforge' }
});
const emit = defineEmits(['close']);

const timelineStore = useTimelineStore(props.appMode);

const resolution = ref('source');
const fps = ref('source');
const quality = ref('medium');
const outputPath = ref('');
const exporting = ref(false);
const progress = ref({ percent: 0, currentTime: '', fps: 0 });
const unsubscribe = ref(null);
const error = ref('');
const exportSuccess = ref(false);
const maxResolution = ref({ width: Infinity, height: Infinity });

const hasClips = computed(() => timelineStore.tracks.some(t => t.clips.length > 0));
const canStart = computed(() => hasClips.value && !!outputPath.value);
const progressPercent = computed(() => Math.max(0, Math.min(100, progress.value.percent || 0)));

// Compute available resolutions based on timeline clips
const resolutionAvailable = (resOption) => {
  if (resOption === 'source') return true;
  
  const resMap = {
    '720p': { width: 1280, height: 720 },
    '1080p': { width: 1920, height: 1080 },
    '1440p': { width: 2560, height: 1440 },
    '4k': { width: 3840, height: 2160 }
  };
  
  const targetRes = resMap[resOption];
  if (!targetRes) return true;
  
  // Check if this resolution exceeds max available
  return targetRes.width <= maxResolution.value.width;
};

// Calculate max resolution on mount and when visible changes
watch(() => props.visible, async (isVisible) => {
  if (isVisible) {
    // Reset state
    exportSuccess.value = false;
    error.value = '';
    
    // Calculate max resolution from timeline
    let lowestWidth = Infinity;
    let lowestHeight = Infinity;
    
    for (const track of timelineStore.tracks) {
      for (const clip of track.clips) {
        if (clip.width && clip.height) {
          if (clip.width < lowestWidth) {
            lowestWidth = clip.width;
            lowestHeight = clip.height;
          }
        }
      }
    }
    
    maxResolution.value = {
      width: lowestWidth === Infinity ? 3840 : lowestWidth,
      height: lowestHeight === Infinity ? 2160 : lowestHeight
    };
  } else {
    // Reset UI state when hidden
    exporting.value = false;
    progress.value = { percent: 0, currentTime: '', fps: 0 };
    error.value = '';
    exportSuccess.value = false;
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
  exportSuccess.value = false;
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
    
    // Show success message, let user close
    progress.value.percent = 100;
    exportSuccess.value = true;
    
  } catch (e) {
    console.error('Export error:', e);
    
    // User-friendly error messages
    let errorMsg = 'Could not export video. Please check your output location and try again.';
    
    if (e?.message?.includes('ENOSPC') || e?.message?.includes('disk space')) {
      errorMsg = 'Not enough disk space. Please free up space and try again.';
    } else if (e?.message?.includes('EACCES') || e?.message?.includes('permission')) {
      errorMsg = 'Permission denied. Please choose a different output location.';
    } else if (e?.message?.includes('ENOENT') || e?.message?.includes('not found')) {
      errorMsg = 'Output location not found. Please choose a valid folder.';
    } else if (e?.message?.includes('codec') || e?.message?.includes('format')) {
      errorMsg = 'Video format error. Please ensure your clips are valid video files.';
    } else if (e?.message?.includes('cancel')) {
      errorMsg = 'Export cancelled.';
    } else if (e?.message) {
      // Use the actual error message if available
      errorMsg = e.message;
    }
    
    error.value = errorMsg;
    
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

<style lang="scss" scoped>
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

.export-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.export-modal {
  @include d3-window;
  width: 420px;
  background: #c0c0c0;
  padding: 2px;
}

.export-header {
  @include d3-window;
  background: linear-gradient(90deg, #000080, #1084d0);
  color: white;
  padding: 4px 8px;
  font-weight: bold;
  font-size: 11px;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
}

.export-content {
  padding: 12px 8px 8px 8px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.form-row label {
  @include font-color('font-color');
  font-size: 11px;
  min-width: 70px;
  text-align: right;
}

select {
  @include background-color('inputs-bg');
  @include font-color('font-color');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  padding: 3px 4px;
  font-size: 11px;
  font-family: $font-family;
  cursor: pointer;
  flex: 1;
  
  &:focus {
    outline: 1px dotted #000;
    outline-offset: -2px;
  }
  
  &:disabled {
    @include font-color('font-disabled');
    cursor: not-allowed;
  }
}

input[type="text"] {
  @include background-color('inputs-bg');
  @include font-color('font-color');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  padding: 3px 4px;
  font-size: 11px;
  font-family: $font-family;
  flex: 1;
  
  &:focus {
    outline: 1px dotted #000;
    outline-offset: -2px;
  }
}

.output-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.error-message {
  @include background-color('inputs-bg');
  border: 1px solid #cc0000;
  padding: 8px;
  margin-bottom: 10px;
  font-size: 11px;
  color: #cc0000;
  
  &::before {
    content: '⚠ ';
  }
}

.success-message {
  @include background-color('inputs-bg');
  border: 1px solid #008000;
  padding: 8px;
  margin-bottom: 10px;
  font-size: 11px;
  color: #008000;
  
  &::before {
    content: '✓ ';
  }
}

.progress-section {
  margin: 12px 0;
  padding: 8px;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include background-color('inputs-bg');
}

.progress-label {
  @include font-color('font-color');
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 6px;
}

.progress-bar {
  height: 20px;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  background: white;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: repeating-linear-gradient(
    45deg,
    #000080,
    #000080 10px,
    #1084d0 10px,
    #1084d0 20px
  );
  transition: width 0.3s ease;
  position: relative;
}

.progress-text {
  @include font-color('font-color');
  font-size: 11px;
  margin-top: 4px;
  font-family: 'Courier New', monospace;
  text-align: center;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid;
  @include border-color-tl('content-border-left');
}

button {
  @include d3-object;
  @include font;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 11px;
  min-width: 75px;
  height: 24px;
  
  &:hover:not(:disabled) {
    background: #d0d0d0;
  }
  
  &:active:not(:disabled) {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
  
  &:disabled {
    @include font-color('font-disabled');
    cursor: not-allowed;
  }
}

.primary-btn {
  font-weight: bold;
}

.cancel-btn {
  // Uses default button styling
}
</style>


