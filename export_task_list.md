# Export Button Feature - Task List

## Overview
This task list implements the Export button functionality as outlined in `export_prd.md`. The work is divided into 2 pull requests that add and refine the export feature with Windows 95 styling.

---

## PR #1: Export Dialog Styling & Resolution Capping

**Objective**: Update Export dialog to match Windows 95 theme and implement intelligent resolution capping

### Tasks

#### 1.1 Restyle Export Dialog Component
**File**: `src/renderer/components/ExportDialog.vue`

**Changes Required**:

**Template Structure Update**:
```vue
<template>
  <div v-if="visible" class="export-backdrop" @click.self="emitClose">
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
```

**Script Section - Add Props and Resolution Logic**:
```javascript
const props = defineProps({
  visible: { type: Boolean, default: false },
  appMode: { type: String, default: 'clipforge' } // ADD THIS PROP
});

const timelineStore = useTimelineStore(props.appMode); // PASS appMode

// Add these new refs
const exportSuccess = ref(false);
const maxResolution = ref({ width: Infinity, height: Infinity });

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
  }
});
```

**Style Section - Replace Entire `<style scoped>` Block**:
```vue
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
  @include background-color('inputs-bg');
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
```

#### 1.2 Improve Error Messages
**File**: `src/renderer/components/ExportDialog.vue`

**Update Script Section - `startExport` function error handling**:
```javascript
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
```

#### 1.3 Implement Resolution Capping Logic
**File**: `src/renderer/services/exportAssembler.js`

**Update `deriveGraphDimensionsAndFps` function** (around line 72):
```javascript
async function deriveGraphDimensionsAndFps(tracks, options) {
  // Find the lowest resolution among all clips on timeline
  let lowestWidth = Infinity;
  let lowestHeight = Infinity;
  
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.width && clip.height) {
        if (clip.width < lowestWidth) {
          lowestWidth = clip.width;
          lowestHeight = clip.height;
        }
      } else {
        // If clip doesn't have dimensions stored, try to get them from ffprobe
        try {
          const info = await ffmpegService.getVideoInfo(clip.filePath);
          if (info && info.width && info.height) {
            if (info.width < lowestWidth) {
              lowestWidth = info.width;
              lowestHeight = info.height;
            }
          }
        } catch (_) {
          // Skip if can't get info
        }
      }
    }
  }
  
  // Default if no clips have resolution info
  if (lowestWidth === Infinity) {
    lowestWidth = 1920;
    lowestHeight = 1080;
  }

  // Resolution handling
  let width = 1920;
  let height = 1080;
  
  if (options.resolution && options.resolution !== 'source') {
    const res = RESOLUTION_MAP[options.resolution];
    if (res) {
      width = res.width;
      height = res.height;
    }
    
    // Cap to lowest clip resolution - don't upscale
    if (width > lowestWidth) {
      width = lowestWidth;
      height = lowestHeight;
    }
  } else {
    // Use lowest clip resolution as source
    width = lowestWidth;
    height = lowestHeight;
  }

  // FPS for graph sources (color/anullsrc)
  let fpsForGraph = 30;
  if (options.fps && options.fps !== 'source') {
    fpsForGraph = parseInt(options.fps, 10) || 30;
  } else {
    // Derive from first available media via ffprobe
    let firstPath = null;
    for (const track of tracks) {
      if (track.clips.length > 0) {
        firstPath = track.clips[0].filePath;
        break;
      }
    }
    if (firstPath) {
      try {
        const info = await ffmpegService.getVideoInfo(firstPath);
        if (info && info.frameRate) {
          fpsForGraph = Math.round(info.frameRate) || 30;
        }
      } catch (_) {
        // Fallback to 30
      }
    }
  }

  return { width, height, fpsForGraph };
}
```

**Add import at top of file if not present**:
```javascript
import ffmpegService from '../../shared/ffmpegService';
```

---

## PR #2: Move Export Button to Header

**Objective**: Relocate Export button from transport controls to top header bar and integrate into editor components

### Tasks

#### 2.1 Add Export Button to ClipForge Editor
**File**: `src/renderer/components/ClipForgeEditor.vue`

**Template Update - Modify app-header section** (around line 3):
```vue
<div class="app-header">
  <BackButton @back="$emit('back')" />
  <h1>ClipForge</h1>
  <ProjectMenu :app-mode="appMode" />
  <button @click="openExport" :disabled="!canExport" class="export-btn" title="Export Timeline">
    Export
  </button>
  <button @click="openRecordingPanel" class="record-toggle-btn" title="Record">
    ● Record
  </button>
</div>
```

**Template Update - Add ExportDialog at bottom** (around line 41):
```vue
<!-- Recording Panel -->
<RecordingPanel ref="recordingPanel" :app-mode="appMode" />

<!-- Export Dialog -->
<ExportDialog :visible="showExport" :app-mode="appMode" @close="showExport = false" />
```

**Script Update - Add imports** (after line 56):
```javascript
import { useProjectStore } from '../stores/projectStore';
import { useRecordingStore } from '../stores/recordingStore';
import { useTimelineStore } from '../stores/timelineStore'; // ADD THIS
import { useMediaStore } from '../stores/mediaStore'; // ADD THIS
import ExportDialog from './ExportDialog.vue'; // ADD THIS
```

**Script Update - Add refs and computed** (after line 72):
```javascript
const projectStore = useProjectStore(props.appMode);
const recordingStore = useRecordingStore(props.appMode);
const timelineStore = useTimelineStore(props.appMode); // ADD THIS
const mediaStore = useMediaStore(props.appMode); // ADD THIS

const showExport = ref(false); // ADD THIS
let playbackManager = null; // Should already exist

// Computed property for export button - disabled during save/recording/empty timeline
const canExport = computed(() => {
  const hasClips = timelineStore.tracks.some(track => track.clips.length > 0);
  return hasClips && !projectStore.isSaving && !recordingStore.isRecording;
});

// Method to open export
const openExport = () => {
  if (canExport.value) {
    // Pause playback if playing
    if (playbackManager && playbackManager.isPlaying) {
      playbackManager.pause();
    }
    showExport.value = true;
  }
};
```

**Script Update - Initialize playbackManager** (should already exist around line 62):
```javascript
onMounted(() => {
  playbackManager = new PlaybackManager(timelineStore, videoPlayerPool);
  // ... rest of existing onMounted code
});
```

**Style Update - Add export button styles** (in the style section, around line 256):
```scss
.export-btn {
  @include d3-object;
  @include font;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 11px;
  height: 24px;
  margin-left: 8px;
  -webkit-app-region: no-drag;
  
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
```

#### 2.2 Add Export Button to VoiceForge Editor
**File**: `src/renderer/components/VoiceForgeEditor.vue`

**Apply the same changes as in 2.1**, but:
- Keep the title as "VoiceForge" instead of "ClipForge"
- Keep the record button text as "🎙️ Record Audio"
- Use `props.appMode` (should already be 'voiceforge')

**All other changes identical to ClipForgeEditor.vue**

#### 2.3 Remove Export from Transport Controls
**File**: `src/renderer/components/TransportControls.vue`

**Remove Import** (line 53):
```javascript
// DELETE THIS LINE:
import ExportDialog from './ExportDialog.vue';
```

**Remove Export Button from Template** (lines 36-44):
```vue
<!-- DELETE THESE LINES:
<button 
  @click="openExport" 
  :disabled="!hasClips"
  class="stop-btn"
>
  Export
</button>

<ExportDialog :visible="showExport" @close="showExport = false" />
-->
```

**Remove Script Variables and Methods** (lines 68, 103-105):
```javascript
// DELETE THIS:
const showExport = ref(false);

// DELETE THIS:
const openExport = () => {
  showExport.value = true;
};
```

**Remove Keyboard Shortcut** (lines 119-123):
```javascript
// DELETE THIS SECTION (keyboard shortcut not needed):
// Cmd/Ctrl+E for Export
if ((event.metaKey || event.ctrlKey) && event.code === 'KeyE') {
  event.preventDefault();
  if (hasClips.value) openExport();
}
```

**Note**: No keyboard shortcuts are being added in PR #2.

---

## Acceptance Criteria

### PR #1
- [ ] Export dialog has Windows 95 styling with 3D borders
- [ ] Progress bar uses diagonal blue stripe pattern
- [ ] Form controls match existing app styling
- [ ] Error messages are user-friendly and specific
- [ ] Resolution capping works: selecting "Source" uses lowest clip resolution
- [ ] Preset resolutions exceeding lowest clip are disabled in dropdown
- [ ] Dialog header has gradient blue background
- [ ] All buttons use d3-object styling
- [ ] Export success shows "Export completed successfully!" message
- [ ] User can close dialog after success (doesn't auto-close)
- [ ] ExportDialog receives appMode prop and passes it to timelineStore

### PR #2
- [ ] Export button appears in top header next to ProjectMenu
- [ ] Export button disabled when timeline is empty
- [ ] Export button disabled during project save (projectStore.isSaving)
- [ ] Export button disabled during active recording (recordingStore.isRecording)
- [ ] Export button enabled when clips are on timeline and not saving/recording
- [ ] Clicking Export button opens dialog
- [ ] Clicking Export button auto-pauses playback if playing
- [ ] Export button has proper styling matching other header buttons
- [ ] Export button works in both ClipForge and VoiceForge
- [ ] No export button in TransportControls
- [ ] No keyboard shortcuts added
- [ ] No console errors or warnings

## Testing Notes

### Manual Testing Checklist
1. **Visual Testing**:
   - Open app, verify Export button in header
   - Check button is disabled with empty timeline
   - Add clips, verify button becomes enabled
   - Click Export, verify dialog has Windows 95 styling
   - Check all form controls match app theme
   - Verify progress bar has diagonal stripes during export

2. **Functional Testing**:
   - Test export with Source resolution
   - Test export with 720p, 1080p presets
   - Verify resolution capping (add low-res clip, check max export resolution)
   - Test cancel during export
   - Test error scenarios (invalid path, disk full if possible)
   - Verify error messages are user-friendly

3. **Button State Testing**:
   - Export button disabled with empty timeline
   - Export button disabled during project save
   - Export button disabled during active recording
   - Clicking Export auto-pauses video playback

4. **Cross-Editor Testing**:
   - Test in ClipForge editor
   - Test in VoiceForge editor
   - Verify both work identically

## Dependencies
- FFmpeg binary (already present)
- Window 95 theme SCSS mixins (already present)
- Timeline store (already present)
- Media store (already present)

## Notes
- Keep all 5 resolution options (Source, 720p, 1080p, 1440p, 4K)
- No emoji in Export button, text only
- Dialog width stays at 420px
- Resolution capping prevents upscaling beyond lowest timeline clip
- Resolutions exceeding lowest clip are disabled in dropdown
- Error messages should guide users to solutions
- Export button disabled during save/recording operations
- Playback auto-pauses when export dialog opens
- Success message displayed, user manually closes dialog
- No keyboard shortcuts for export
- ExportDialog receives appMode prop and uses it for timelineStore

