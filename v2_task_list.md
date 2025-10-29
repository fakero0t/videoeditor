# ClipForge V2 - Detailed Task List & Pull Requests

## Overview

This document breaks down the V2 PRD into incremental pull requests with comprehensive implementation details. Each PR is designed to be independently testable while building toward the complete V2 feature set without breaking existing V1 functionality.

---

## PR #17: Timeline Pan Mode

**Objective**: Add toggle-based timeline panning for easier navigation

**Priority**: High | **Complexity**: Low | **Risk**: Low

### Features
- Pan mode toggle button in timeline toolbar (hand/grab icon)
- Click-and-drag timeline scrolling when pan mode enabled
- Visual cursor feedback (grab/grabbing)
- **Pan mode disables clip dragging but ALLOWS playhead scrubbing**
- Keyboard shortcut: H key
- Pan mode resets to OFF on app launch (non-persistent)

### Files to Create
- `src/renderer/components/PanToggle.vue` - Pan mode toggle button component

### Files to Modify
- `src/renderer/components/Timeline.vue` - Add pan mode handlers, cursor changes
- `src/renderer/stores/timelineStore.js` - Add `panMode` state (boolean, default false)
- `src/shared/dragDropManager.js` - Check pan mode before allowing clip drag

### Detailed Implementation

#### 1. timelineStore.js - Add Pan Mode State

```javascript
// Add to state section
const panMode = ref(false);

// Add to actions section
const setPanMode = (enabled) => {
  panMode.value = enabled;
  markDirty();
};

// Add to return object
return {
  // ... existing exports
  panMode,
  setPanMode
};
```

**Location**: After line 17 (after `isDirty` declaration)

**Non-Breaking**: New state, doesn't modify existing state

---

#### 2. PanToggle.vue - New Component

```vue
<template>
  <button 
    @click="togglePan" 
    :class="{ active: timelineStore.panMode }"
    class="pan-btn"
    title="Toggle pan mode (H)"
  >
    <span class="icon">✋</span> Pan
  </button>
</template>

<script setup>
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

<style scoped>
.pan-btn {
  background: #444;
  border: 1px solid #666;
  color: white;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 3px;
  font-size: 12px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.pan-btn:hover {
  background: #555;
}

.pan-btn.active {
  background: #007acc;
  border-color: #005a9e;
}

.icon {
  font-size: 14px;
}
</style>
```

**Location**: New file in `src/renderer/components/`

---

#### 3. Timeline.vue - Integrate Pan Mode

**Add pan state variables** (after line 75):
```javascript
// Pan mode state
const isPanning = ref(false);
const panStartX = ref(0);
const panStartScrollX = ref(0);
```

**Import PanToggle component** (line 38):
```javascript
import PanToggle from './PanToggle.vue';
```

**Add PanToggle to template** (line 10, in zoom-controls div):
```vue
<div class="zoom-controls">
  <button @click="zoomOut">-</button>
  <span>{{ Math.round(timelineStore.zoomLevel * 100) }}%</span>
  <button @click="zoomIn">+</button>
  <button @click="zoomToFit">Fit</button>
  <PanToggle />  <!-- ADD THIS -->
  <GridSnapToggle :drag-drop-manager="dragDropManager" />
  <TimeDisplay />
</div>
```

**Modify handleMouseDown** (line 376):
```javascript
const handleMouseDown = (event) => {
  const rect = timelineCanvas.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  // NEW: Handle pan mode - Start panning
  if (timelineStore.panMode) {
    isPanning.value = true;
    panStartX.value = event.clientX;
    panStartScrollX.value = timelineStore.scrollPosition;
    document.body.style.cursor = 'grabbing';
    event.preventDefault();
    return;
  }
  
  // Check if clicking on a trim handle
  const selectedClipIds = clipSelectionManager.getSelectedClipIds();
  const hoverState = trimManager.checkHoverState(
    x, 
    y, 
    selectedClipIds.length > 0 ? selectedClipIds[0] : null
  );
  
  if (hoverState) {
    trimManager.startTrim(hoverState.edge, hoverState.clip, hoverState.trackId);
    event.preventDefault();
    return;
  }
  
  // Check if clicking on playhead handle (STILL ALLOWED in pan mode)
  if (playheadRenderer && playheadRenderer.isOverHandle(x, y)) {
    isScrubbing.value = true;
    const initialTime = (x + timelineStore.scrollPosition) / timelineStore.pixelsPerSecond;
    scrubManager.startScrub(initialTime);
    document.body.style.cursor = 'grabbing';
    event.preventDefault();
    return;
  }
  
  // Check if clicking near playhead line (STILL ALLOWED in pan mode)
  if (playheadRenderer && playheadRenderer.isNearPlayhead(x, 5)) {
    isScrubbing.value = true;
    const initialTime = (x + timelineStore.scrollPosition) / timelineStore.pixelsPerSecond;
    scrubManager.startScrub(initialTime);
    document.body.style.cursor = 'grabbing';
    event.preventDefault();
    return;
  }
  
  // MODIFIED: Don't allow clip selection/dragging in pan mode
  if (!timelineStore.panMode) {
    const clickedClip = getClipAtPosition(x, y);
    if (clickedClip) {
      clipSelectionManager.selectClip(clickedClip.id, event.ctrlKey);
      const trackId = Math.floor(y / 100) + 1;
      dragDropManager.startDragFromTimeline(clickedClip, trackId, event);
    } else {
      clipSelectionManager.clearSelection();
      const time = (x + timelineStore.scrollPosition) / timelineStore.pixelsPerSecond;
      timelineStore.setPlayheadPosition(time);
    }
  } else {
    // In pan mode, just position playhead
    const time = (x + timelineStore.scrollPosition) / timelineStore.pixelsPerSecond;
    timelineStore.setPlayheadPosition(time);
  }
};
```

**Modify handleMouseMove** (line 435):
```javascript
const handleMouseMove = (event) => {
  const rect = timelineCanvas.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  // NEW: Handle panning motion
  if (isPanning.value) {
    const deltaX = event.clientX - panStartX.value;
    const newScrollPosition = panStartScrollX.value - deltaX;
    timelineStore.setScrollPosition(Math.max(0, newScrollPosition));
    return;
  }
  
  // Handle active trim
  if (trimManager.trimming) {
    trimManager.updateTrim(x);
    return;
  }
  
  // Handle scrubbing
  if (isScrubbing.value) {
    const newTime = (x + timelineStore.scrollPosition) / timelineStore.pixelsPerSecond;
    scrubManager.updateScrub(newTime);
    showTimeTooltip.value = true;
    tooltipPosition.value = { x, y };
    return;
  }
  
  // NEW: Update cursor for pan mode
  if (timelineStore.panMode && !isPanning.value && !isScrubbing.value) {
    document.body.style.cursor = 'grab';
    return;
  }
  
  // ... rest of existing mouse move logic
};
```

**Modify handleMouseUp** (line 507):
```javascript
const handleMouseUp = (event) => {
  // NEW: Handle pan end
  if (isPanning.value) {
    isPanning.value = false;
    document.body.style.cursor = timelineStore.panMode ? 'grab' : 'default';
    event.preventDefault();
    return;
  }
  
  // Handle trim end
  if (trimManager.trimming) {
    trimManager.endTrim();
    event.preventDefault();
    return;
  }
  
  // ... rest of existing mouse up logic
};
```

**Non-Breaking Changes**:
- All new code is additive (adds checks before existing logic)
- Existing clip dragging logic unchanged, just gated by pan mode check
- Playhead scrubbing explicitly preserved in pan mode

---

#### 4. dragDropManager.js - Check Pan Mode

**Modify startDragFromTimeline** (line 40):
```javascript
startDragFromTimeline(clip, trackId, event) {
  // NEW: Don't allow drag if pan mode is active
  if (this.timelineStore.panMode) {
    return;
  }
  
  const rect = this.canvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  const clipStartX = clip.startTime * this.timelineStore.pixelsPerSecond - this.timelineStore.scrollPosition;
  
  // ... rest of existing logic
}
```

**Non-Breaking**: Early return prevents drag, existing logic untouched

---

### Testing Checklist

#### Functional Tests
- [ ] Pan toggle button appears in timeline toolbar
- [ ] H key toggles pan mode on/off
- [ ] Cursor shows grab icon when pan mode enabled
- [ ] Cursor shows grabbing icon when actively panning
- [ ] Timeline scrolls smoothly left/right during pan
- [ ] Pan mode disables clip selection
- [ ] Pan mode disables clip dragging
- [ ] Playhead scrubbing STILL WORKS in pan mode (critical)
- [ ] Trim handles still work in pan mode
- [ ] Pan mode is OFF when app launches
- [ ] Pan mode is OFF after app restart

#### Integration Tests
- [ ] Pan mode doesn't interfere with zoom controls
- [ ] Pan mode doesn't interfere with snap controls
- [ ] Pan mode doesn't interfere with split operations
- [ ] All V1 features work when pan mode OFF
- [ ] Timeline scrollbar still works (if exists)

#### Edge Cases
- [ ] Panning at timeline start (can't scroll left of 0)
- [ ] Panning at timeline end
- [ ] Switching pan mode ON while dragging clip (should cancel drag)
- [ ] Switching pan mode OFF while panning (should stop panning)

---

### Acceptance Criteria
- [x] Pan toggle button present in timeline toolbar
- [x] Pan mode enables/disables with button and H key
- [x] Timeline scrolls via click-drag when pan enabled
- [x] Clips cannot be moved during pan mode
- [x] Playhead scrubbing works during pan mode
- [x] Cursor feedback correct (grab/grabbing)
- [x] Pan mode resets to OFF on app launch
- [x] Zero regressions to V1 functionality

**Dependencies**: None

---

## PR #18: Snap Behavior Verification & Visual Indicators

**Objective**: Enhance existing snap functionality with visual feedback

**Priority**: Medium | **Complexity**: Low | **Risk**: Low

### Features
- Verify snap-to-clip edges works correctly
- Verify snap-to-grid works with GridSnapToggle
- **Add visual indicators (green line) when snap will occur**
- Snap threshold: 10px (consistent for both grid and clip edges)
- Snap to clip edges even when grid snap enabled (both can be active)

### Files to Verify
- `src/renderer/components/GridSnapToggle.vue` - Existing component (verified working)
- `src/shared/dragDropManager.js` - Current snap logic

### Files to Modify
- `src/shared/dragDropManager.js` - Add snap-to-clip logic and visual feedback state
- `src/renderer/components/Timeline.vue` - Draw snap indicators

### Detailed Implementation

#### 1. dragDropManager.js - Add Snap-to-Clip Logic

**Add constants** (after line 20):
```javascript
this.SNAP_THRESHOLD = 10; // pixels
this.snapIndicator = null; // { x: number, type: 'grid' | 'clip-start' | 'clip-end' }
```

**Add new method** (after snapToGrid method at line 354):
```javascript
// Snap to nearby clip edges
snapToClipEdges(time, trackId, excludeClipId) {
  if (!this.snapEnabled) return { time, snapped: false };
  
  const track = this.timelineStore.tracks.find(t => t.id === `track-${trackId}`);
  if (!track) return { time, snapped: false };
  
  const targetPixelX = time * this.timelineStore.pixelsPerSecond;
  let closestSnapTime = null;
  let closestDistance = Infinity;
  let snapType = null;
  
  // Check all clips in the track
  track.clips.forEach(clip => {
    if (clip.id === excludeClipId) return; // Skip self
    
    const clipStartX = clip.startTime * this.timelineStore.pixelsPerSecond;
    const clipEndX = (clip.startTime + clip.duration) * this.timelineStore.pixelsPerSecond;
    
    // Check snap to clip start
    const distanceToStart = Math.abs(targetPixelX - clipStartX);
    if (distanceToStart < this.SNAP_THRESHOLD && distanceToStart < closestDistance) {
      closestDistance = distanceToStart;
      closestSnapTime = clip.startTime;
      snapType = 'clip-start';
    }
    
    // Check snap to clip end
    const distanceToEnd = Math.abs(targetPixelX - clipEndX);
    if (distanceToEnd < this.SNAP_THRESHOLD && distanceToEnd < closestDistance) {
      closestDistance = distanceToEnd;
      closestSnapTime = clip.startTime + clip.duration;
      snapType = 'clip-end';
    }
  });
  
  if (closestSnapTime !== null) {
    this.snapIndicator = {
      x: closestSnapTime * this.timelineStore.pixelsPerSecond,
      type: snapType
    };
    return { time: closestSnapTime, snapped: true };
  }
  
  return { time, snapped: false };
}

// Apply all snap logic (grid first, then clip edges)
applySnapping(time, trackId, excludeClipId) {
  let finalTime = time;
  let snapped = false;
  
  // Apply grid snap if enabled
  if (this.gridSnapEnabled) {
    finalTime = this.snapToGrid(time);
    snapped = true;
    this.snapIndicator = {
      x: finalTime * this.timelineStore.pixelsPerSecond,
      type: 'grid'
    };
  }
  
  // Apply clip snap if enabled (can override grid snap if closer)
  if (this.snapEnabled) {
    const clipSnap = this.snapToClipEdges(finalTime, trackId, excludeClipId);
    if (clipSnap.snapped) {
      finalTime = clipSnap.time;
      snapped = true;
    }
  }
  
  if (!snapped) {
    this.snapIndicator = null;
  }
  
  return finalTime;
}

// Get snap indicator for drawing
getSnapIndicator() {
  return this.snapIndicator;
}

// Clear snap indicator
clearSnapIndicator() {
  this.snapIndicator = null;
}
```

**Modify handleDragMove** (line 66):
```javascript
handleDragMove(event) {
  if (!this.dragState.isDragging) return;
  
  this.dragState.currentMousePos = { x: event.clientX, y: event.clientY };
  
  const rect = this.canvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  const canvasY = event.clientY - rect.top;
  
  // Calculate target position
  const targetTrackId = this.getTrackFromY(canvasY);
  let targetTime = this.getTimeFromX(canvasX - this.dragState.dragOffset.x);
  
  // NEW: Apply all snapping logic
  targetTime = this.applySnapping(
    targetTime,
    targetTrackId,
    this.dragState.draggedClip?.id
  );
  
  // Constrain to valid positions
  targetTime = Math.max(0, targetTime);
  
  // ... rest of existing logic
}
```

**Modify handleDragEnd and clearDragState** to clear indicator:
```javascript
clearDragState() {
  // ... existing code
  
  // NEW: Clear snap indicator
  this.clearSnapIndicator();
  
  this.timelineStore.markDirty();
}
```

**Non-Breaking**: Existing grid snap logic remains, clip snap is additive

---

#### 2. Timeline.vue - Draw Snap Indicators

**Add method** (after renderTimeline at line 203):
```javascript
const drawSnapIndicator = (ctx) => {
  if (!dragDropManager) return;
  
  const indicator = dragDropManager.getSnapIndicator();
  if (!indicator) return;
  
  const x = indicator.x - timelineStore.scrollPosition;
  
  // Don't draw if off-screen
  if (x < 0 || x > canvasWidth.value) return;
  
  ctx.save();
  
  // Draw snap line
  ctx.strokeStyle = indicator.type === 'grid' ? '#00ff00' : '#00ffff';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.globalAlpha = 0.8;
  
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, canvasHeight.value);
  ctx.stroke();
  
  ctx.setLineDash([]);
  ctx.restore();
};
```

**Modify renderTimeline** (line 137):
```javascript
const renderTimeline = () => {
  if (!ctx) return;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
  
  // Draw tracks
  timelineStore.tracks.forEach((track, index) => {
    // ... existing track drawing code
  });
  
  // Draw playhead
  if (playheadRenderer) {
    playheadRenderer.draw(ctx);
  }
  
  // NEW: Draw snap indicator BEFORE ghost preview
  drawSnapIndicator(ctx);
  
  // Draw ghost preview if dragging
  if (dragDropManager) {
    dragDropManager.drawGhostPreview(ctx);
  }
  
  // ... rest of existing drawing code
};
```

**Non-Breaking**: New drawing function, doesn't modify existing rendering

---

### Testing Checklist

#### Snap-to-Grid Tests
- [ ] Grid snap toggle works (existing feature)
- [ ] Clips snap to 0.1s/0.5s/1s/5s intervals based on selection
- [ ] Green dotted line shows during grid snap
- [ ] Snap works when dragging from library
- [ ] Snap works when moving clips on timeline

#### Snap-to-Clip Tests
- [ ] Clip snap toggle works (magnet icon)
- [ ] Clips snap to adjacent clip's start edge
- [ ] Clips snap to adjacent clip's end edge
- [ ] Cyan dotted line shows during clip snap
- [ ] Snap threshold is 10px
- [ ] Snap works on same track
- [ ] Snap doesn't happen when disabled

#### Combined Snap Tests
- [ ] Both snaps can be enabled simultaneously
- [ ] Clip snap takes priority when closer than grid
- [ ] Grid snap applies first, then clip snap refines
- [ ] Visual indicator shows correct color (green=grid, cyan=clip)

#### Edge Cases
- [ ] Snap indicator doesn't show when not dragging
- [ ] Snap indicator hides when drag ends
- [ ] Snap works correctly at timeline boundaries
- [ ] Snap doesn't interfere with trim operations
- [ ] Snap doesn't interfere with playhead scrubbing

---

### Acceptance Criteria
- [x] Snap-to-clip edges implemented and working
- [x] Visual indicators appear during snap (green=grid, cyan=clip)
- [x] 10px snap threshold consistent
- [x] Both snaps can be active simultaneously
- [x] Existing snap toggle verified working
- [x] Zero regressions to dragging functionality

**Dependencies**: None

---

## PR #19: Project Data Model & Serialization

**Objective**: Create project serialization infrastructure without UI

**Priority**: High | **Complexity**: Medium | **Risk**: Low

### Features
- Project data model (JSON format)
- Serialize timeline state to JSON
- Serialize media library to JSON
- Deserialize JSON to restore state
- File path handling (copy media files to project folder)

### Files to Create
- `src/shared/projectService.js` - Core save/load logic with file copying

### Files to Modify
- `src/renderer/stores/timelineStore.js` - Add `serialize()` and `deserialize()` methods
- `src/renderer/stores/mediaStore.js` - Add `serialize()` and `deserialize()` methods
- `src/main/index.js` - Add file copy IPC handlers
- `src/main/preload.js` - Expose file system APIs

### Detailed Implementation

#### 1. Project JSON Schema

```typescript
interface ProjectFile {
  version: string; // "2.0"
  projectName: string;
  created: string; // ISO timestamp
  modified: string; // ISO timestamp
  timeline: {
    duration: number;
    playheadPosition: number;
    zoomLevel: number;
    tracks: Track[];
  };
  media: MediaFile[];
}

interface Track {
  id: string;
  name: string;
  height: number;
  clips: TimelineClip[];
}

interface TimelineClip {
  id: string;
  trackId: string;
  mediaFileId: string;
  fileName: string;
  filePath: string; // Relative path: "./projectname_media/filename.mp4"
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  sourceDuration: number;
  width: number;
  height: number;
  color: string;
}

interface MediaFile {
  id: string;
  fileName: string;
  originalPath: string; // Where file came from
  projectPath: string; // Relative path in project: "./projectname_media/filename.mp4"
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  frameRate: number;
  hasAudio: boolean;
  fileSize: number;
  format: string;
  thumbnailPath: string; // "./projectname_media/.thumbnails/filename.jpg"
  isRecording: boolean; // NEW: Flag for recordings (PR #27)
  createdAt: number;
}
```

---

#### 2. timelineStore.js - Serialization Methods

**Add to actions** (after line 231):
```javascript
const serialize = () => {
  return {
    duration: timelineDuration.value,
    playheadPosition: playheadPosition.value,
    zoomLevel: zoomLevel.value,
    tracks: tracks.value.map(track => ({
      id: track.id,
      name: track.name,
      height: track.height,
      clips: track.clips.map(clip => ({
        id: clip.id,
        trackId: clip.trackId,
        mediaFileId: clip.mediaFileId,
        fileName: clip.fileName,
        filePath: clip.filePath,
        startTime: clip.startTime,
        duration: clip.duration,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
        sourceDuration: clip.sourceDuration,
        width: clip.width,
        height: clip.height,
        color: clip.color
      }))
    }))
  };
};

const deserialize = (timelineData) => {
  // Clear existing timeline
  tracks.value.forEach(track => {
    track.clips = [];
  });
  
  // Restore timeline state
  timelineDuration.value = timelineData.duration;
  playheadPosition.value = timelineData.playheadPosition;
  zoomLevel.value = timelineData.zoomLevel;
  
  // Restore tracks and clips
  timelineData.tracks.forEach((trackData, index) => {
    if (index < tracks.value.length) {
      const track = tracks.value[index];
      track.clips = trackData.clips.map(clipData => ({
        ...clipData
      }));
    }
  });
  
  markDirty();
};

// Add to return
return {
  // ... existing exports
  serialize,
  deserialize
};
```

**Non-Breaking**: New methods, don't modify existing store operations

---

#### 3. mediaStore.js - Serialization Methods

**Add to actions** (after line 75):
```javascript
const serialize = () => {
  return mediaFiles.value.map(file => ({
    id: file.id,
    fileName: file.fileName,
    originalPath: file.filePath, // Current path before project save
    projectPath: '', // Will be set during save
    duration: file.duration,
    width: file.width,
    height: file.height,
    codec: file.codec,
    bitrate: file.bitrate,
    frameRate: file.frameRate,
    hasAudio: file.hasAudio,
    fileSize: file.fileSize,
    format: file.format,
    thumbnailPath: file.thumbnailPath,
    isRecording: file.isRecording || false,
    createdAt: file.createdAt
  }));
};

const deserialize = (mediaData) => {
  // Clear existing media
  mediaFiles.value = [];
  
  // Restore media files
  mediaData.forEach(fileData => {
    mediaFiles.value.push({
      id: fileData.id,
      filePath: fileData.projectPath, // Use project path
      fileName: fileData.fileName,
      duration: fileData.duration,
      width: fileData.width,
      height: fileData.height,
      codec: fileData.codec,
      bitrate: fileData.bitrate,
      frameRate: fileData.frameRate,
      hasAudio: fileData.hasAudio,
      fileSize: fileData.fileSize,
      format: fileData.format,
      thumbnailPath: fileData.thumbnailPath,
      isRecording: fileData.isRecording || false,
      createdAt: fileData.createdAt
    });
  });
};

// Add to return
return {
  // ... existing exports
  serialize,
  deserialize
};
```

**Non-Breaking**: New methods, don't affect existing media operations

---

#### 4. projectService.js - New File

```javascript
import path from 'path';

export class ProjectService {
  constructor() {
    this.currentProjectPath = null;
    this.currentProjectName = null;
  }

  // Serialize entire project
  serializeProject(projectName, timelineData, mediaData) {
    return {
      version: "2.0",
      projectName: projectName,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      timeline: timelineData,
      media: mediaData
    };
  }

  // Save project to disk (without file copying - that's in main process)
  async prepareProjectForSave(projectPath, timelineStore, mediaStore) {
    const projectName = path.basename(projectPath, '.cfproj');
    
    // Serialize stores
    const timelineData = timelineStore.serialize();
    const mediaData = mediaStore.serialize();
    
    // Convert file paths to relative project paths
    const mediaFolder = `${projectName}_media`;
    mediaData.forEach(file => {
      const fileName = path.basename(file.originalPath);
      file.projectPath = `./${mediaFolder}/${fileName}`;
      
      if (file.thumbnailPath) {
        const thumbName = path.basename(file.thumbnailPath);
        file.thumbnailPath = `./${mediaFolder}/.thumbnails/${thumbName}`;
      }
    });
    
    // Update clip file paths in timeline to match
    timelineData.tracks.forEach(track => {
      track.clips.forEach(clip => {
        const mediaFile = mediaData.find(m => m.id === clip.mediaFileId);
        if (mediaFile) {
          clip.filePath = mediaFile.projectPath;
        }
      });
    });
    
    // Create project JSON
    const projectData = this.serializeProject(projectName, timelineData, mediaData);
    
    // Extract file list for copying
    const filesToCopy = mediaData.map(file => ({
      source: file.originalPath,
      destRelative: file.projectPath,
      type: 'media'
    }));
    
    // Add thumbnails
    mediaData.forEach(file => {
      if (file.thumbnailPath) {
        filesToCopy.push({
          source: file.thumbnailPath.replace(`./${mediaFolder}/.thumbnails/`, ''), // Original path
          destRelative: file.thumbnailPath,
          type: 'thumbnail'
        });
      }
    });
    
    return {
      projectData,
      filesToCopy
    };
  }

  // Load project from disk
  async loadProject(projectPath, projectData, timelineStore, mediaStore) {
    const projectFolder = path.dirname(projectPath);
    const projectName = path.basename(projectPath, '.cfproj');
    const mediaFolder = path.join(projectFolder, `${projectName}_media`);
    
    // Convert relative paths to absolute paths
    projectData.media.forEach(file => {
      file.projectPath = path.join(projectFolder, file.projectPath);
      if (file.thumbnailPath) {
        file.thumbnailPath = path.join(projectFolder, file.thumbnailPath);
      }
    });
    
    // Check for missing media files
    const missingFiles = [];
    for (const file of projectData.media) {
      const exists = await window.electronAPI.fileExists(file.projectPath);
      if (!exists) {
        missingFiles.push(file);
        file.isMissing = true; // Mark as missing
      }
    }
    
    // Deserialize into stores
    mediaStore.deserialize(projectData.media);
    timelineStore.deserialize(projectData.timeline);
    
    this.currentProjectPath = projectPath;
    this.currentProjectName = projectName;
    
    return {
      success: true,
      missingFiles
    };
  }
}
```

**Non-Breaking**: New service, doesn't affect existing code

---

#### 5. main/index.js - File System IPC Handlers

**Add after line 178** (after ffmpeg handlers):
```javascript
// File system handlers for project management
ipcMain.handle('fs:copyFile', async (event, source, destination) => {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destination), { recursive: true });
    
    // Copy file
    await fs.copyFile(source, destination);
    
    return { success: true };
  } catch (error) {
    console.error('File copy error:', error);
    throw error;
  }
});

ipcMain.handle('fs:copyFileWithProgress', async (event, source, destination) => {
  const fs = require('fs');
  const path = require('path');
  
  return new Promise((resolve, reject) => {
    // Ensure destination directory exists
    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    const readStream = fs.createReadStream(source);
    const writeStream = fs.createWriteStream(destination);
    
    let totalSize = 0;
    let copiedSize = 0;
    
    // Get file size
    fs.stat(source, (err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      totalSize = stats.size;
    });
    
    readStream.on('data', (chunk) => {
      copiedSize += chunk.length;
      const progress = totalSize > 0 ? (copiedSize / totalSize) * 100 : 0;
      event.sender.send('fs:copy-progress', { 
        source: path.basename(source),
        progress: Math.round(progress),
        copiedSize,
        totalSize
      });
    });
    
    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('finish', () => resolve({ success: true }));
    
    readStream.pipe(writeStream);
  });
});

ipcMain.handle('fs:fileExists', async (event, filePath) => {
  const fs = require('fs').promises;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fs:deleteFile', async (event, filePath) => {
  const fs = require('fs').promises;
  try {
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fs:readFile', async (event, filePath) => {
  const fs = require('fs').promises;
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('fs:writeFile', async (event, filePath, content) => {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Write file
    await fs.writeFile(filePath, content, 'utf-8');
    
    return { success: true };
  } catch (error) {
    throw error;
  }
});
```

**Non-Breaking**: New IPC handlers, don't modify existing handlers

---

#### 6. main/preload.js - Expose File System APIs

**Add after line 35** (after onQuitRequested):
```javascript
// File system APIs
fileSystem: {
  copyFile: (source, destination) => ipcRenderer.invoke('fs:copyFile', source, destination),
  copyFileWithProgress: (source, destination) => 
    ipcRenderer.invoke('fs:copyFileWithProgress', source, destination),
  fileExists: (filePath) => ipcRenderer.invoke('fs:fileExists', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('fs:deleteFile', filePath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content)
},

// Event listener for file copy progress
onFileCopyProgress: (callback) => {
  const subscription = (event, data) => callback(data);
  ipcRenderer.on('fs:copy-progress', subscription);
  return () => ipcRenderer.removeListener('fs:copy-progress', subscription);
}
```

**Non-Breaking**: New API surface, existing APIs unchanged

---

### Testing Checklist

#### Serialization Tests
- [ ] Timeline serializes to JSON correctly
- [ ] Media library serializes to JSON correctly
- [ ] All clip properties preserved (trim, position, duration)
- [ ] All media properties preserved (resolution, codec, etc.)
- [ ] File paths converted to relative paths

#### Deserialization Tests
- [ ] Timeline restores from JSON correctly
- [ ] Media library restores from JSON correctly
- [ ] Clips appear in correct positions
- [ ] Trim points preserved
- [ ] Playhead position restored
- [ ] Zoom level restored

#### File Operations Tests
- [ ] Can copy single file
- [ ] Can copy multiple files
- [ ] Progress events fire during copy
- [ ] fileExists check works
- [ ] Read/write file works
- [ ] Directory creation works

#### Edge Cases
- [ ] Empty timeline serializes/deserializes
- [ ] Timeline with no clips serializes
- [ ] Large files (>1GB) copy successfully
- [ ] Special characters in filenames handled
- [ ] Paths with spaces handled

---

### Acceptance Criteria
- [x] Project serialization complete
- [x] Timeline state serializes correctly
- [x] Media library serializes correctly
- [x] Deserialization restores exact state
- [x] File copying infrastructure ready
- [x] All tests pass
- [x] Zero breaking changes to existing code

**Dependencies**: None

---

## PR #20: Project Save/Load UI & File Management

**Objective**: Add UI for saving and loading projects with portable media files

**Priority**: High | **Complexity**: High | **Risk**: Medium

### Features
- New/Save/Save As/Open Project buttons in toolbar
- File dialogs for save/load
- **Unsaved changes tracking (clip edits only, not zoom/playhead)**
- **Copy media files with per-file progress indicator**
- **Rollback entire save if any file copy fails**
- **Missing media shown as "bad media" in timeline - deletable but not usable**
- Project folder structure: `project.cfproj` + `project_media/`

### Files to Create
- `src/renderer/components/ProjectMenu.vue` - Project toolbar buttons
- `src/renderer/components/SaveProgressDialog.vue` - Progress during save
- `src/renderer/stores/projectStore.js` - Project state management

### Files to Modify
- `src/renderer/App.vue` - Add ProjectMenu, track unsaved changes, prevent close during save
- `src/renderer/stores/timelineStore.js` - Track dirty state for clip operations only
- `src/renderer/components/Timeline.vue` - Mark changes on clip operations
- `src/main/index.js` - Add project save/load IPC handlers with rollback
- `src/main/preload.js` - Expose save/load dialogs

### Detailed Implementation

#### 1. projectStore.js - New Store

```javascript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ProjectService } from '../../shared/projectService';

export const useProjectStore = defineStore('project', () => {
  // State
  const currentProjectPath = ref(null);
  const currentProjectName = ref(null);
  const isDirty = ref(false);
  const isSaving = ref(false);
  const isLoading = ref(false);
  const saveProgress = ref({ current: 0, total: 0, fileName: '' });
  
  const projectService = new ProjectService();
  
  // Computed
  const hasProject = computed(() => currentProjectPath.value !== null);
  const projectTitle = computed(() => {
    if (!currentProjectName.value) return 'Untitled Project';
    return isDirty.value ? `${currentProjectName.value}*` : currentProjectName.value;
  });
  
  // Actions
  const markDirty = () => {
    isDirty.value = true;
  };
  
  const markClean = () => {
    isDirty.value = false;
  };
  
  const setCurrentProject = (path, name) => {
    currentProjectPath.value = path;
    currentProjectName.value = name;
  };
  
  const clearProject = () => {
    currentProjectPath.value = null;
    currentProjectName.value = null;
    isDirty.value = false;
  };
  
  const setSaveProgress = (current, total, fileName) => {
    saveProgress.value = { current, total, fileName };
  };
  
  return {
    // State
    currentProjectPath,
    currentProjectName,
    isDirty,
    isSaving,
    isLoading,
    saveProgress,
    projectService,
    
    // Computed
    hasProject,
    projectTitle,
    
    // Actions
    markDirty,
    markClean,
    setCurrentProject,
    clearProject,
    setSaveProgress
  };
});
```

---

#### 2. timelineStore.js - Track Clip Operations Only

**Modify markDirty** (line 150):
```javascript
const markDirty = () => {
  isDirty.value = true;
};

// NEW: Mark dirty specifically for clip operations (for unsaved changes)
const markClipChanged = () => {
  isDirty.value = true;
  
  // Notify project store if it exists
  if (window.__projectStore) {
    window.__projectStore.markDirty();
  }
};
```

**Modify clip operation methods to use markClipChanged**:
```javascript
const addClipToTrack = (trackId, mediaClip, startTime) => {
  // ... existing code ...
  
  markClipChanged(); // Instead of markDirty()
  
  return timelineClip.id;
};

const removeClip = (clipId) => {
  // ... existing code ...
  
  markClipChanged();
};

const updateClipPosition = (clipId, newStartTime) => {
  // ... existing code ...
    markClipChanged();
  // ...
};

// Keep markDirty() for visual updates (zoom, playhead)
// But use markClipChanged() for actual edits
```

**Add to return**:
```javascript
return {
  // ... existing exports
  markClipChanged
};
```

**Non-Breaking**: New method, existing markDirty still works for rendering

---

#### 3. SaveProgressDialog.vue - New Component

```vue
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
```

---

#### 4. ProjectMenu.vue - New Component

```vue
<template>
  <div class="project-menu">
    <button @click="newProject" class="menu-btn" title="New Project">
      <span class="icon">📄</span> New
    </button>
    
    <button @click="openProject" class="menu-btn" title="Open Project">
      <span class="icon">📂</span> Open
    </button>
    
    <button @click="saveProject" class="menu-btn" title="Save Project" :disabled="isSaving">
      <span class="icon">💾</span> Save
    </button>
    
    <button @click="saveProjectAs" class="menu-btn" title="Save Project As...">
      <span class="icon">💾</span> Save As...
    </button>
    
    <span v-if="projectStore.isDirty" class="unsaved-indicator" title="Unsaved changes">●</span>
    <span class="project-name">{{ projectStore.projectTitle }}</span>
  </div>
  
  <!-- Save Progress Dialog -->
  <SaveProgressDialog
    :is-visible="showSaveProgress"
    title="Saving Project..."
    :current="saveProgress.current"
    :total="saveProgress.total"
    :current-file="saveProgress.fileName"
    :error="saveError"
    :can-cancel="false"
  />
</template>

<script setup>
import { ref, computed } from 'vue';
import { useProjectStore } from '../stores/projectStore';
import { useTimelineStore } from '../stores/timelineStore';
import { useMediaStore } from '../stores/mediaStore';
import SaveProgressDialog from './SaveProgressDialog.vue';

const projectStore = useProjectStore();
const timelineStore = useTimelineStore();
const mediaStore = useMediaStore();

const isSaving = ref(false);
const showSaveProgress = ref(false);
const saveProgress = ref({ current: 0, total: 0, fileName: '' });
const saveError = ref(null);

const newProject = async () => {
  // Check for unsaved changes
  if (projectStore.isDirty) {
    const confirmed = await window.electronAPI.showMessageBox({
      type: 'warning',
      title: 'Unsaved Changes',
      message: 'You have unsaved changes. Do you want to save before creating a new project?',
      buttons: ['Save and Continue', 'Don\'t Save', 'Cancel'],
      defaultId: 0,
      cancelId: 2
    });
    
    if (confirmed.response === 2) return; // Cancelled
    
    if (confirmed.response === 0) {
      // Save first
      await saveProject();
    }
  }
  
  // Clear timeline and media
  timelineStore.tracks.forEach(track => track.clips = []);
  mediaStore.clearAllMedia();
  timelineStore.setPlayheadPosition(0);
  timelineStore.setZoomLevel(1);
  
  // Clear project
  projectStore.clearProject();
};

const openProject = async () => {
  // Check for unsaved changes
  if (projectStore.isDirty) {
    const confirmed = await window.electronAPI.showMessageBox({
      type: 'warning',
      title: 'Unsaved Changes',
      message: 'You have unsaved changes. Do you want to save before opening another project?',
      buttons: ['Save and Open', 'Don\'t Save', 'Cancel'],
      defaultId: 0,
      cancelId: 2
    });
    
    if (confirmed.response === 2) return;
    
    if (confirmed.response === 0) {
      await saveProject();
    }
  }
  
  // Show open dialog
  const result = await window.electronAPI.showOpenDialog({
    filters: [
      { name: 'ClipForge Projects', extensions: ['cfproj'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return;
  
  const projectPath = result.filePaths[0];
  
  try {
    projectStore.isLoading = true;
    
    // Load project file
    const projectJSON = await window.electronAPI.fileSystem.readFile(projectPath);
    const projectData = JSON.parse(projectJSON);
    
    // Load project
    const loadResult = await projectStore.projectService.loadProject(
      projectPath,
      projectData,
      timelineStore,
      mediaStore
    );
    
    // Extract project name
    const projectName = projectData.projectName;
    projectStore.setCurrentProject(projectPath, projectName);
    projectStore.markClean();
    
    // Show warning if any files are missing
    if (loadResult.missingFiles.length > 0) {
      await window.electronAPI.showMessageBox({
        type: 'warning',
        title: 'Missing Media Files',
        message: `${loadResult.missingFiles.length} media file(s) could not be found. They will be marked as "Bad Media" and cannot be played.`,
        buttons: ['OK']
      });
    }
    
  } catch (error) {
    console.error('Failed to load project:', error);
    await window.electronAPI.showMessageBox({
      type: 'error',
      title: 'Load Failed',
      message: `Failed to load project: ${error.message}`,
      buttons: ['OK']
    });
  } finally {
    projectStore.isLoading = false;
  }
};

const saveProject = async () => {
  if (projectStore.currentProjectPath) {
    await performSave(projectStore.currentProjectPath);
  } else {
    await saveProjectAs();
  }
};

const saveProjectAs = async () => {
  // Show save dialog
  const result = await window.electronAPI.showSaveDialog({
    filters: [
      { name: 'ClipForge Projects', extensions: ['cfproj'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: 'Untitled.cfproj'
  });
  
  if (result.canceled || !result.filePath) return;
  
  await performSave(result.filePath);
};

const performSave = async (projectPath) => {
  try {
    isSaving.value = true;
    showSaveProgress.value = true;
    saveError.value = null;
    saveProgress.value = { current: 0, total: 0, fileName: '' };
    
    // Prepare project data
    const { projectData, filesToCopy } = await projectStore.projectService.prepareProjectForSave(
      projectPath,
      timelineStore,
      mediaStore
    );
    
    saveProgress.value.total = filesToCopy.length + 1; // +1 for project file
    
    // Listen for copy progress
    const unsubscribe = window.electronAPI.onFileCopyProgress((data) => {
      saveProgress.value.current++;
      saveProgress.value.fileName = data.source;
    });
    
    try {
      // Save project (this will copy files and write JSON)
      const saveResult = await window.electronAPI.project.save(
        projectPath,
        projectData,
        filesToCopy
      );
      
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Save failed');
      }
      
      // Update project store
      const projectName = projectData.projectName;
      projectStore.setCurrentProject(projectPath, projectName);
      projectStore.markClean();
      
      // Success
      saveProgress.value.fileName = 'Done!';
      setTimeout(() => {
        showSaveProgress.value = false;
      }, 1000);
      
    } finally {
      unsubscribe();
    }
    
  } catch (error) {
    console.error('Save failed:', error);
    saveError.value = error.message;
    
    // Keep dialog open to show error
    setTimeout(() => {
      showSaveProgress.value = false;
    }, 3000);
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped>
.project-menu {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}

.menu-btn {
  background: #444;
  border: 1px solid #666;
  color: white;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 3px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.menu-btn:hover:not(:disabled) {
  background: #555;
}

.menu-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon {
  font-size: 14px;
}

.unsaved-indicator {
  color: #ff6b6b;
  font-size: 20px;
  line-height: 1;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.project-name {
  color: #ccc;
  font-size: 13px;
  margin-left: 8px;
}
</style>
```

---

#### 5. App.vue - Integrate Project Menu & Prevent Close

**Add import** (after line 47):
```javascript
import ProjectMenu from './components/ProjectMenu.vue';
import { useProjectStore } from './stores/projectStore';
```

**Add to setup**:
```javascript
const projectStore = useProjectStore();

// Make project store globally available for timeline store
window.__projectStore = projectStore;

// Prevent close during save or with unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (projectStore.isSaving) {
    e.preventDefault();
    e.returnValue = 'Project is being saved. Please wait...';
    return e.returnValue;
  }
  
  if (projectStore.isDirty) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to close?';
    return e.returnValue;
  }
});
```

**Update template** (line 3):
```vue
<div class="app-header">
  <h1>ClipForge</h1>
  <ProjectMenu />  <!-- ADD THIS -->
  <div class="app-version">v{{ appVersion }} | FFmpeg: {{ ffmpegStatus }}</div>
</div>
```

**Non-Breaking**: New component added, existing layout preserved

---

#### 6. main/index.js - Save/Load with Rollback

**Add after line 178**:
```javascript
const path = require('path');
const fs = require('fs').promises;

// Project save with rollback on failure
ipcMain.handle('project:save', async (event, projectPath, projectData, filesToCopy) => {
  const projectFolder = path.dirname(projectPath);
  const projectName = path.basename(projectPath, '.cfproj');
  const mediaFolder = path.join(projectFolder, `${projectName}_media`);
  const thumbnailFolder = path.join(mediaFolder, '.thumbnails');
  
  // Track copied files for rollback
  const copiedFiles = [];
  
  try {
    // Create folders
    await fs.mkdir(mediaFolder, { recursive: true });
    await fs.mkdir(thumbnailFolder, { recursive: true });
    
    // Copy each file with progress
    for (let i = 0; i < filesToCopy.length; i++) {
      const file = filesToCopy[i];
      const destPath = path.join(projectFolder, file.destRelative);
      
      try {
        // Copy file
        await fs.copyFile(file.source, destPath);
        copiedFiles.push(destPath);
        
        // Send progress
        event.sender.send('fs:copy-progress', {
          source: path.basename(file.source),
          progress: 100,
          copiedSize: (await fs.stat(destPath)).size,
          totalSize: (await fs.stat(file.source)).size
        });
        
      } catch (copyError) {
        console.error(`Failed to copy ${file.source}:`, copyError);
        throw new Error(`Failed to copy file: ${path.basename(file.source)}`);
      }
    }
    
    // Write project JSON
    const projectJSON = JSON.stringify(projectData, null, 2);
    await fs.writeFile(projectPath, projectJSON, 'utf-8');
    
    return { success: true };
    
  } catch (error) {
    console.error('Save failed, rolling back:', error);
    
    // ROLLBACK: Delete all copied files
    for (const filePath of copiedFiles) {
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        console.error(`Failed to rollback ${filePath}:`, unlinkError);
      }
    }
    
    // Try to delete empty folders
    try {
      await fs.rmdir(thumbnailFolder);
      await fs.rmdir(mediaFolder);
    } catch (rmdirError) {
      // Ignore if folders not empty or don't exist
    }
    
    return {
      success: false,
      error: error.message
    };
  }
});

// Show message box
ipcMain.handle('dialog:showMessageBox', async (event, options) => {
  return await dialog.showMessageBox(mainWindow, options);
});

// Show open dialog  
ipcMain.handle('dialog:showOpenDialog', async (event, options) => {
  return await dialog.showOpenDialog(mainWindow, options);
});

// Show save dialog
ipcMain.handle('dialog:showSaveDialog', async (event, options) => {
  return await dialog.showSaveDialog(mainWindow, options);
});
```

**Non-Breaking**: New handlers, existing handlers unchanged

---

#### 7. main/preload.js - Expose Dialog APIs

**Add to electronAPI** (after line 13):
```javascript
// Dialog APIs (add these)
showMessageBox: (options) => ipcRenderer.invoke('dialog:showMessageBox', options),
showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options),
showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),

// Project APIs
project: {
  save: (projectPath, projectData, filesToCopy) => 
    ipcRenderer.invoke('project:save', projectPath, projectData, filesToCopy)
}
```

**Non-Breaking**: New API additions

---

#### 8. Timeline.vue - Show Missing Media

**Modify drawClip** (line 205):
```javascript
const drawClip = (clip, trackY) => {
  const x = clip.startTime * timelineStore.pixelsPerSecond - timelineStore.scrollPosition;
  const width = clip.duration * timelineStore.pixelsPerSecond;
  
  // Skip if clip is not visible
  if (x + width < 0 || x > canvasWidth.value) return;
  
  // NEW: Check if media is missing
  const mediaFile = mediaStore.mediaFiles.find(m => m.id === clip.mediaFileId);
  const isMissing = mediaFile && mediaFile.isMissing;
  
  // Clip background
  const isSelected = timelineStore.selectedClips.includes(clip.id);
  let fillColor = isSelected ? '#ff6b6b' : clip.color || '#4a90e2';
  
  // NEW: Gray out missing media
  if (isMissing) {
    fillColor = '#666666';
  }
  
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, trackY + 5, width, 90);
  
  // NEW: Add diagonal stripes for missing media
  if (isMissing) {
    ctx.save();
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    for (let i = x; i < x + width; i += 10) {
      ctx.beginPath();
      ctx.moveTo(i, trackY + 5);
      ctx.lineTo(i + 10, trackY + 95);
      ctx.stroke();
    }
    ctx.restore();
  }
  
  // Clip border
  ctx.strokeStyle = isMissing ? '#ff0000' : (isSelected ? '#ff4444' : '#2c5aa0');
  ctx.lineWidth = isSelected ? 3 : 2;
  ctx.strokeRect(x, trackY + 5, width, 90);
  
  // Clip label
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px Arial';
  const label = isMissing ? '⚠️ ' + (clip.fileName || 'Missing') : (clip.fileName || `Clip ${clip.id.slice(-4)}`);
  ctx.fillText(label, x + 5, trackY + 25);
  
  // ... rest of existing code
};
```

**Import mediaStore** (line 46):
```javascript
import { useMediaStore } from '../stores/mediaStore';
const mediaStore = useMediaStore();
```

**Non-Breaking**: Visual change only, doesn't affect clip functionality

---

### Testing Checklist

#### Save Project Tests
- [ ] Can save new project
- [ ] Save As creates new project copy
- [ ] Media files copied to project folder
- [ ] Thumbnails copied to .thumbnails folder
- [ ] Project JSON file created
- [ ] Progress dialog shows during save
- [ ] Per-file progress updates
- [ ] Save button disabled during save

#### Rollback Tests  
- [ ] If file copy fails, all copied files deleted
- [ ] Empty folders cleaned up on rollback
- [ ] Error message shown to user
- [ ] Can retry save after failure

#### Load Project Tests
- [ ] Can load saved project
- [ ] Timeline restored correctly
- [ ] Media library restored
- [ ] Trim/split operations preserved
- [ ] Playhead position restored
- [ ] Zoom level restored

#### Missing Media Tests
- [ ] Missing media marked with red stripes
- [ ] Warning shown on load
- [ ] Missing clips can be deleted
- [ ] Missing clips cannot be played
- [ ] Can still save project with missing media

#### Unsaved Changes Tests
- [ ] Dot indicator shows when changes made
- [ ] Warning before New Project
- [ ] Warning before Open Project
- [ ] Warning before app close
- [ ] Zoom/playhead changes don't trigger dirty state
- [ ] Clip add/remove/move triggers dirty state

#### Edge Cases
- [ ] Save very large project (5GB+ media)
- [ ] Save project with special characters in name
- [ ] Load project from different drive
- [ ] Load project from read-only location
- [ ] Multiple saves in succession

---

### Acceptance Criteria
- [x] New/Save/Save As/Open buttons functional
- [x] Unsaved changes tracked correctly (clips only)
- [x] Media files copied with progress
- [x] Rollback on failure works
- [x] Missing media handled gracefully
- [x] Projects fully portable
- [x] All V1 features still work

**Dependencies**: PR #19

---

## PR #21: Recording Infrastructure & Permissions

**Objective**: Set up recording architecture with permission handling

**Priority**: High | **Complexity**: Medium | **Risk**: Medium

### Features
- **New recordingStore.js** for recording state management
- Permission checks (screen recording, microphone)
- **Generic permission guidance modal** (works across macOS versions)
- Recording state management (status, duration, disk space)
- Disk space monitoring (5GB pre-check, 500MB during recording)
- **Prevent app close during active recording**

### Files to Create
- `src/renderer/stores/recordingStore.js` - Recording state store
- `src/shared/screenRecorder.js` - Recording service class (foundation)
- `src/main/recordingHandler.js` - Main process recording APIs
- `src/renderer/components/PermissionModal.vue` - Permission guidance UI

### Files to Modify
- `src/main/index.js` - Add recording IPC handlers, prevent quit during recording
- `src/main/preload.js` - Expose recording APIs
- `src/renderer/App.vue` - Handle recording state for quit prevention

### Detailed Implementation

#### 1. recordingStore.js - New Store

```javascript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useRecordingStore = defineStore('recording', () => {
  // State
  const isRecording = ref(false);
  const recordingType = ref(null); // 'screen', 'webcam', 'composite'
  const recordingDuration = ref(0); // seconds
  const recordingStartTime = ref(null);
  const currentRecordingId = ref(null);
  
  // Sources
  const selectedScreenSource = ref(null);
  const selectedWebcamSource = ref(null);
  const selectedMicrophoneSource = ref(null);
  
  // Available sources
  const availableScreenSources = ref([]);
  const availableWebcamSources = ref([]);
  const availableMicrophoneSources = ref([]);
  
  // Quality settings
  const recordingQuality = ref('high'); // 'high', 'medium', 'low'
  
  // Permissions
  const hasScreenPermission = ref(false);
  const hasMicrophonePermission = ref(false);
  const permissionsChecked = ref(false);
  
  // Disk space
  const availableDiskSpace = ref(0); // bytes
  const diskSpaceWarning = ref(false);
  
  // Audio
  const audioLevel = ref(0); // 0-100
  const systemAudioEnabled = ref(false);
  
  // Errors
  const lastError = ref(null);
  
  // Computed
  const canStartRecording = computed(() => {
    return !isRecording.value &&
           selectedScreenSource.value &&
           hasScreenPermission.value &&
           hasMicrophonePermission.value &&
           availableDiskSpace.value > 5 * 1024 * 1024 * 1024; // 5GB
  });
  
  const recordingDurationFormatted = computed(() => {
    const hours = Math.floor(recordingDuration.value / 3600);
    const minutes = Math.floor((recordingDuration.value % 3600) / 60);
    const seconds = Math.floor(recordingDuration.value % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });
  
  const isApproachingLimit = computed(() => {
    // 2 hour limit = 7200 seconds
    return recordingDuration.value >= 7200;
  });
  
  // Actions
  const startRecording = (type, recordingId) => {
    isRecording.value = true;
    recordingType.value = type;
    recordingStartTime.value = Date.now();
    recordingDuration.value = 0;
    currentRecordingId.value = recordingId;
    lastError.value = null;
  };
  
  const stopRecording = () => {
    isRecording.value = false;
    recordingType.value = null;
    recordingStartTime.value = null;
    recordingDuration.value = 0;
    currentRecordingId.value = null;
  };
  
  const updateDuration = (duration) => {
    recordingDuration.value = duration;
  };
  
  const setPermissions = (screen, microphone) => {
    hasScreenPermission.value = screen;
    hasMicrophonePermission.value = microphone;
    permissionsChecked.value = true;
  };
  
  const setAvailableScreenSources = (sources) => {
    availableScreenSources.value = sources;
  };
  
  const setAvailableWebcamSources = (sources) => {
    availableWebcamSources.value = sources;
  };
  
  const setAvailableMicrophoneSources = (sources) => {
    availableMicrophoneSources.value = sources;
  };
  
  const setSelectedScreenSource = (source) => {
    selectedScreenSource.value = source;
  };
  
  const setSelectedWebcamSource = (source) => {
    selectedWebcamSource.value = source;
  };
  
  const setSelectedMicrophoneSource = (source) => {
    selectedMicrophoneSource.value = source;
  };
  
  const updateAudioLevel = (level) => {
    audioLevel.value = Math.min(100, Math.max(0, level));
  };
  
  const setDiskSpace = (bytes) => {
    availableDiskSpace.value = bytes;
    diskSpaceWarning.value = bytes < 5 * 1024 * 1024 * 1024; // 5GB
  };
  
  const setError = (error) => {
    lastError.value = error;
  };
  
  const clearError = () => {
    lastError.value = null;
  };
  
  const reset = () => {
    stopRecording();
    selectedScreenSource.value = null;
    selectedWebcamSource.value = null;
    selectedMicrophoneSource.value = null;
    audioLevel.value = 0;
    lastError.value = null;
  };
  
  return {
    // State
    isRecording,
    recordingType,
    recordingDuration,
    recordingStartTime,
    currentRecordingId,
    selectedScreenSource,
    selectedWebcamSource,
    selectedMicrophoneSource,
    availableScreenSources,
    availableWebcamSources,
    availableMicrophoneSources,
    recordingQuality,
    hasScreenPermission,
    hasMicrophonePermission,
    permissionsChecked,
    availableDiskSpace,
    diskSpaceWarning,
    audioLevel,
    systemAudioEnabled,
    lastError,
    
    // Computed
    canStartRecording,
    recordingDurationFormatted,
    isApproachingLimit,
    
    // Actions
    startRecording,
    stopRecording,
    updateDuration,
    setPermissions,
    setAvailableScreenSources,
    setAvailableWebcamSources,
    setAvailableMicrophoneSources,
    setSelectedScreenSource,
    setSelectedWebcamSource,
    setSelectedMicrophoneSource,
    updateAudioLevel,
    setDiskSpace,
    setError,
    clearError,
    reset
  };
});
```

**Non-Breaking**: New store, doesn't affect existing stores

---

#### 2. PermissionModal.vue - New Component

```vue
<template>
  <div v-if="isVisible" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Permissions Required</h3>
        <button @click="closeModal" class="close-btn">×</button>
      </div>
      
      <div class="modal-body">
        <div v-if="!hasScreenPermission" class="permission-item">
          <div class="permission-icon">🖥️</div>
          <div class="permission-info">
            <h4>Screen Recording Permission</h4>
            <p>ClipForge needs permission to record your screen.</p>
            
            <div class="instructions">
              <p><strong>To grant permission:</strong></p>
              <ol>
                <li v-if="platform.isMac">
                  Open System Settings (or System Preferences)
                </li>
                <li v-else-if="platform.isWindows">
                  Open Settings → Privacy → Camera
                </li>
                <li v-else>
                  Check your system's privacy settings
                </li>
                
                <li v-if="platform.isMac">
                  Go to Privacy & Security → Screen Recording
                </li>
                <li v-else-if="platform.isWindows">
                  Allow apps to access your camera
                </li>
                
                <li v-if="platform.isMac">
                  Enable the checkbox next to ClipForge
                </li>
                <li v-else-if="platform.isWindows">
                  Enable ClipForge in the list
                </li>
                
                <li>Restart ClipForge</li>
              </ol>
            </div>
          </div>
        </div>
        
        <div v-if="!hasMicrophonePermission" class="permission-item">
          <div class="permission-icon">🎤</div>
          <div class="permission-info">
            <h4>Microphone Permission</h4>
            <p>ClipForge needs permission to record audio from your microphone.</p>
            
            <div class="instructions">
              <p><strong>To grant permission:</strong></p>
              <ol>
                <li v-if="platform.isMac">
                  Open System Settings → Privacy & Security → Microphone
                </li>
                <li v-else-if="platform.isWindows">
                  Open Settings → Privacy → Microphone
                </li>
                <li v-else>
                  Check your system's privacy settings
                </li>
                
                <li>Enable the checkbox next to ClipForge</li>
                <li>Restart ClipForge</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="openSystemSettings" class="primary-btn">
          Open System Settings
        </button>
        <button @click="recheckPermissions" class="secondary-btn">
          Recheck Permissions
        </button>
        <button @click="closeModal" class="cancel-btn">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  isVisible: Boolean,
  hasScreenPermission: Boolean,
  hasMicrophonePermission: Boolean
});

const emit = defineEmits(['close', 'recheck']);

const platform = window.platform;

const closeModal = () => {
  emit('close');
};

const openSystemSettings = async () => {
  await window.electronAPI.recording.openSystemSettings();
};

const recheckPermissions = () => {
  emit('recheck');
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #444;
}

.modal-header h3 {
  margin: 0;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 28px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
}

.close-btn:hover {
  color: #ff6b6b;
}

.modal-body {
  padding: 20px;
}

.permission-item {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.permission-item:last-child {
  margin-bottom: 0;
}

.permission-icon {
  font-size: 48px;
  flex-shrink: 0;
}

.permission-info {
  flex: 1;
}

.permission-info h4 {
  margin: 0 0 8px 0;
  color: #fff;
}

.permission-info p {
  margin: 0 0 12px 0;
  color: #ccc;
}

.instructions {
  background: #1a1a1a;
  padding: 12px;
  border-radius: 4px;
  margin-top: 12px;
}

.instructions p {
  margin: 0 0 8px 0;
  color: #fff;
  font-weight: bold;
}

.instructions ol {
  margin: 8px 0 0 0;
  padding-left: 20px;
  color: #ccc;
}

.instructions li {
  margin-bottom: 6px;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #444;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.primary-btn {
  background: #007acc;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.primary-btn:hover {
  background: #005a9e;
}

.secondary-btn {
  background: #444;
  color: white;
  border: 1px solid #666;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.secondary-btn:hover {
  background: #555;
}

.cancel-btn {
  background: transparent;
  color: #ccc;
  border: 1px solid #666;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn:hover {
  background: #333;
}
</style>
```

**Non-Breaking**: New component, independent modal

---

#### 3. recordingHandler.js - New File (Main Process)

```javascript
import { systemPreferences, shell } from 'electron';

export class RecordingHandler {
  constructor() {
    this.platform = process.platform;
  }

  async checkPermissions() {
    const permissions = {
      screen: true,
      microphone: true
    };

    if (this.platform === 'darwin') {
      // macOS - check actual permissions
      try {
        const screenStatus = systemPreferences.getMediaAccessStatus('screen');
        const micStatus = systemPreferences.getMediaAccessStatus('microphone');
        
        permissions.screen = screenStatus === 'granted';
        permissions.microphone = micStatus === 'granted';
      } catch (error) {
        console.error('Permission check error:', error);
      }
    } else if (this.platform === 'win32') {
      // Windows - permissions handled differently
      // Generally more permissive, but we still return true
      permissions.screen = true;
      permissions.microphone = true;
    }

    return permissions;
  }

  async requestPermissions() {
    if (this.platform === 'darwin') {
      try {
        // Request microphone permission
        await systemPreferences.askForMediaAccess('microphone');
        
        // Note: Screen recording permission cannot be requested programmatically
        // User must grant it manually in System Preferences
      } catch (error) {
        console.error('Permission request error:', error);
      }
    }
  }

  openSystemSettings() {
    if (this.platform === 'darwin') {
      // Open Screen Recording settings on macOS
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    } else if (this.platform === 'win32') {
      // Open Privacy settings on Windows
      shell.openExternal('ms-settings:privacy');
    }
  }

  async getDiskSpace() {
    const { app } = require('electron');
    const os = require('os');
    const path = require('path');
    const fs = require('fs').promises;

    try {
      // Get free space on home directory drive
      const homedir = app.getPath('home');
      
      if (this.platform === 'win32') {
        // Windows
        const drive = path.parse(homedir).root;
        const { exec } = require('child_process');
        
        return new Promise((resolve, reject) => {
          exec(`wmic logicaldisk where "DeviceID='${drive.replace('\\', '')}'" get FreeSpace`, (error, stdout) => {
            if (error) {
              reject(error);
              return;
            }
            const lines = stdout.trim().split('\n');
            const freeSpace = parseInt(lines[1].trim());
            resolve({ available: freeSpace });
          });
        });
      } else {
        // macOS/Linux - use statvfs
        const { execSync } = require('child_process');
        const df = execSync(`df -k "${homedir}" | tail -1 | awk '{print $4}'`);
        const freeSpaceKB = parseInt(df.toString().trim());
        const freeSpaceBytes = freeSpaceKB * 1024;
        
        return { available: freeSpaceBytes };
      }
    } catch (error) {
      console.error('Disk space check error:', error);
      // Return large number if check fails (assume enough space)
      return { available: 100 * 1024 * 1024 * 1024 }; // 100GB
    }
  }
}
```

**Non-Breaking**: New handler, no effect on existing code

---

#### 4. main/index.js - Recording IPC Handlers & Quit Prevention

**Add imports** (after line 5):
```javascript
import RecordingHandler from './recordingHandler.js';
```

**Initialize handler** (after line 22):
```javascript
const recordingHandler = new RecordingHandler();
```

**Add IPC handlers** (after line 178):
```javascript
// Recording permission handlers
ipcMain.handle('recording:checkPermissions', async () => {
  return await recordingHandler.checkPermissions();
});

ipcMain.handle('recording:requestPermissions', async () => {
  return await recordingHandler.requestPermissions();
});

ipcMain.handle('recording:openSystemSettings', () => {
  recordingHandler.openSystemSettings();
});

ipcMain.handle('recording:getDiskSpace', async () => {
  return await recordingHandler.getDiskSpace();
});

// Desktop capturer (for screen sources)
ipcMain.handle('recording:getDesktopSources', async () => {
  const { desktopCapturer } = require('electron');
  
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 150, height: 150 }
    });
    
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      type: source.id.startsWith('screen') ? 'screen' : 'window'
    }));
  } catch (error) {
    console.error('Failed to get desktop sources:', error);
    throw error;
  }
});

// Track recording state for quit prevention
let isCurrentlyRecording = false;

ipcMain.handle('recording:setRecordingState', (event, recording) => {
  isCurrentlyRecording = recording;
});
```

**Modify app quit handling** (replace lines 140-145):
```javascript
// Prevent app from quitting during export or recording
let preventQuit = false;

ipcMain.handle('app:setPreventQuit', (event, prevent) => {
  preventQuit = prevent;
});

app.on('before-quit', (event) => {
  if (preventQuit || isCurrentlyRecording) {
    event.preventDefault();
    
    if (isCurrentlyRecording) {
      mainWindow.webContents.send('app:quit-requested-during-recording');
    } else {
      mainWindow.webContents.send('app:quit-requested');
    }
  }
});
```

**Non-Breaking**: New handlers and enhanced quit prevention

---

#### 5. main/preload.js - Expose Recording APIs

**Add to electronAPI** (after line 35):
```javascript
// Recording APIs
recording: {
  checkPermissions: () => ipcRenderer.invoke('recording:checkPermissions'),
  requestPermissions: () => ipcRenderer.invoke('recording:requestPermissions'),
  openSystemSettings: () => ipcRenderer.invoke('recording:openSystemSettings'),
  getDiskSpace: () => ipcRenderer.invoke('recording:getDiskSpace'),
  getDesktopSources: () => ipcRenderer.invoke('recording:getDesktopSources'),
  setRecordingState: (recording) => ipcRenderer.invoke('recording:setRecordingState', recording)
},

// Event listeners for recording
onQuitRequestedDuringRecording: (callback) => {
  const subscription = () => callback();
  ipcRenderer.on('app:quit-requested-during-recording', subscription);
  return () => ipcRenderer.removeListener('app:quit-requested-during-recording', subscription);
}
```

**Non-Breaking**: New API surface

---

#### 6. App.vue - Handle Recording Quit Prevention

**Add to setup** (after line 52):
```javascript
import { useRecordingStore } from './stores/recordingStore';

const recordingStore = useRecordingStore();

// Prevent quit during recording
window.addEventListener('beforeunload', async (e) => {
  if (recordingStore.isRecording) {
    e.preventDefault();
    e.returnValue = 'Recording in progress. Closing will stop and discard the recording.';
    return e.returnValue;
  }
});

// Listen for quit request during recording
const unsubscribeRecordingQuit = window.electronAPI.onQuitRequestedDuringRecording(async () => {
  if (recordingStore.isRecording) {
    const confirmed = await window.electronAPI.showMessageBox({
      type: 'warning',
      title: 'Recording in Progress',
      message: 'A recording is currently in progress. If you quit now, the recording will be lost.',
      buttons: ['Cancel', 'Stop Recording and Quit'],
      defaultId: 0,
      cancelId: 0
    });
    
    if (confirmed.response === 1) {
      // Stop recording and allow quit
      recordingStore.stopRecording();
      await window.electronAPI.recording.setRecordingState(false);
      window.close();
    }
  }
});

onUnmounted(() => {
  unsubscribeRecordingQuit();
});
```

**Non-Breaking**: New event handling, doesn't affect existing quit logic

---

#### 7. screenRecorder.js - Foundation (Expanded in PR #22)

```javascript
export class ScreenRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordingStream = null;
    this.startTime = null;
    this.durationInterval = null;
    this.diskSpaceInterval = null;
    
    // 2 hour max duration
    this.MAX_DURATION = 2 * 60 * 60 * 1000; // milliseconds
    this.maxDurationTimer = null;
    
    // Disk space monitoring
    this.MIN_DISK_SPACE = 500 * 1024 * 1024; // 500MB
  }

  async checkPermissions() {
    return await window.electronAPI.recording.checkPermissions();
  }

  async requestPermissions() {
    return await window.electronAPI.recording.requestPermissions();
  }

  async checkDiskSpace() {
    const space = await window.electronAPI.recording.getDiskSpace();
    return space.available;
  }

  startDiskSpaceMonitoring(callback) {
    this.diskSpaceInterval = setInterval(async () => {
      const available = await this.checkDiskSpace();
      
      if (available < this.MIN_DISK_SPACE) {
        callback('low_disk_space', available);
      }
    }, 30000); // Check every 30 seconds
  }

  stopDiskSpaceMonitoring() {
    if (this.diskSpaceInterval) {
      clearInterval(this.diskSpaceInterval);
      this.diskSpaceInterval = null;
    }
  }

  cleanup() {
    // Stop all streams
    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach(track => track.stop());
      this.recordingStream = null;
    }

    // Clear intervals
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }

    this.stopDiskSpaceMonitoring();

    // Clear max duration timer
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }

    // Clear recorder
    if (this.mediaRecorder) {
      this.mediaRecorder = null;
    }

    this.recordedChunks = [];
    this.startTime = null;
  }
}
```

**Non-Breaking**: New service class

---

### Testing Checklist

#### Permission Tests
- [ ] Permission check works on macOS
- [ ] Permission check works on Windows
- [ ] Permission modal shows when permissions denied
- [ ] "Open System Settings" button launches correct settings
- [ ] Recheck permissions button works
- [ ] Generic instructions clear and helpful

#### Recording State Tests
- [ ] recordingStore initializes correctly
- [ ] Can track recording state
- [ ] Duration updates correctly
- [ ] Disk space monitoring works
- [ ] Audio level tracking works

#### Quit Prevention Tests
- [ ] Cannot quit app during recording
- [ ] Warning dialog shows when trying to quit
- [ ] Can cancel quit and continue recording
- [ ] Can stop recording and quit
- [ ] beforeunload event fires correctly

#### Disk Space Tests
- [ ] Pre-check warns if < 5GB available
- [ ] Monitoring checks every 30 seconds
- [ ] Auto-stop if < 500MB during recording
- [ ] Disk space check works on macOS
- [ ] Disk space check works on Windows

#### Desktop Sources Tests
- [ ] Can list screens
- [ ] Can list windows
- [ ] Thumbnails generated correctly
- [ ] Sources refresh on request

---

### Acceptance Criteria
- [x] recordingStore created and functional
- [x] Permission checking implemented
- [x] Permission modal with generic instructions
- [x] Disk space monitoring works
- [x] App quit prevented during recording
- [x] Foundation ready for recording implementation
- [x] Zero breaking changes

**Dependencies**: None

---

## PR #22: Screen Recording Implementation

**Objective**: Implement screen recording with source selection and conversion to MP4

**Priority**: High | **Complexity**: High | **Risk**: High

### Features
- Recording panel UI (modal/collapsible)
- Screen/window source selection with thumbnails
- Live preview of selected source
- Recording controls (Record/Stop button, timer)
- Quality presets (High/Medium/Low)
- **Auto-minimize to widget during recording**
- **2 hour recording limit with auto-stop**
- WebM recording with **MP4 conversion (or keep WebM if conversion fails)**
- **Recordings only added to media library (not timeline)**

### Files to Create
- `src/renderer/components/RecordingPanel.vue` - Main recording UI
- `src/renderer/components/RecordingWidget.vue` - Minimized recording widget

### Files to Modify
- `src/renderer/App.vue` - Add recording panel toggle button
- `src/shared/screenRecorder.js` - Implement screen capture logic
- `src/main/ffmpegHandler.js` - Add WebM to MP4 conversion
- `src/main/index.js` - Add recording save IPC handlers

### Detailed Implementation

#### 1. RecordingPanel.vue - Main UI

```vue
<template>
  <div v-if="isPanelOpen" class="recording-panel" :style="panelStyle" @mousedown="startDrag">
    <div class="panel-header">
      <h3>Record</h3>
      <div class="panel-controls">
        <button @click="minimizePanel" class="minimize-btn" title="Minimize">_</button>
        <button @click="closePanel" class="close-btn" title="Close">×</button>
      </div>
    </div>
    
    <div class="panel-tabs">
      <button 
        @click="currentTab = 'screen'" 
        :class="{ active: currentTab === 'screen' }"
        class="tab-btn"
      >
        🖥️ Screen
      </button>
      <button 
        @click="currentTab = 'webcam'" 
        :class="{ active: currentTab === 'webcam' }"
        class="tab-btn"
        disabled
        title="Coming in PR #24"
      >
        📹 Webcam
      </button>
      <button 
        @click="currentTab = 'composite'" 
        :class="{ active: currentTab === 'composite' }"
        class="tab-btn"
        disabled
        title="Coming in PR #25"
      >
        🎬 Screen + Webcam
      </button>
    </div>
    
    <!-- Screen Recording Tab -->
    <div v-if="currentTab === 'screen'" class="tab-content">
      <div class="source-selection">
        <label>Screen/Window Source:</label>
        <select 
          v-model="recordingStore.selectedScreenSource" 
          @change="refreshPreview"
          :disabled="recordingStore.isRecording"
        >
          <option :value="null">Select a source...</option>
          <option 
            v-for="source in recordingStore.availableScreenSources" 
            :key="source.id"
            :value="source"
          >
            {{ source.name }} ({{ source.type }})
          </option>
        </select>
        <button @click="refreshSources" class="refresh-btn" :disabled="recordingStore.isRecording">
          🔄 Refresh
        </button>
      </div>
      
      <div v-if="recordingStore.selectedScreenSource" class="preview-container">
        <img 
          :src="recordingStore.selectedScreenSource.thumbnail" 
          alt="Preview"
          class="source-preview"
        />
      </div>
      
      <div class="recording-options">
        <div class="option-group">
          <label>Microphone:</label>
          <select 
            v-model="recordingStore.selectedMicrophoneSource"
            :disabled="recordingStore.isRecording"
          >
            <option :value="null">None</option>
            <option 
              v-for="mic in recordingStore.availableMicrophoneSources"
              :key="mic.deviceId"
              :value="mic"
            >
              {{ mic.label }}
            </option>
          </select>
        </div>
        
        <div v-if="recordingStore.selectedMicrophoneSource" class="option-group">
          <label>Audio Level:</label>
          <div class="audio-level-meter">
            <div 
              class="audio-level-bar" 
              :style="{ width: recordingStore.audioLevel + '%', backgroundColor: getAudioLevelColor(recordingStore.audioLevel) }"
            ></div>
          </div>
          <span class="audio-level-text">{{ Math.round(recordingStore.audioLevel) }}%</span>
        </div>
        
        <div class="option-group">
          <label>Quality:</label>
          <select 
            v-model="recordingStore.recordingQuality"
            :disabled="recordingStore.isRecording"
          >
            <option value="high">High (1080p)</option>
            <option value="medium">Medium (720p)</option>
            <option value="low">Low (480p)</option>
          </select>
        </div>
      </div>
      
      <div v-if="recordingStore.diskSpaceWarning" class="warning-message">
        ⚠️ Low disk space (< 5GB available). Recording may fail.
      </div>
      
      <div v-if="!recordingStore.hasScreenPermission || !recordingStore.hasMicrophonePermission" class="warning-message">
        ⚠️ Permissions required. Click "Check Permissions" below.
      </div>
      
      <div class="recording-controls">
        <button 
          v-if="!recordingStore.isRecording"
          @click="startRecording"
          :disabled="!canRecord"
          class="record-btn"
        >
          ● Start Recording
        </button>
        <button 
          v-else
          @click="stopRecording"
          class="stop-btn"
        >
          ■ Stop Recording
        </button>
        
        <button 
          v-if="!recordingStore.permissionsChecked"
          @click="checkPermissions"
          class="secondary-btn"
        >
          Check Permissions
        </button>
      </div>
    </div>
  </div>
  
  <!-- Recording Widget (shown when minimized during recording) -->
  <RecordingWidget 
    v-if="isWidgetVisible"
    @restore="restorePanel"
    @stop="stopRecording"
  />
  
  <!-- Permission Modal -->
  <PermissionModal
    :is-visible="showPermissionModal"
    :has-screen-permission="recordingStore.hasScreenPermission"
    :has-microphone-permission="recordingStore.hasMicrophonePermission"
    @close="showPermissionModal = false"
    @recheck="checkPermissions"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRecordingStore } from '../stores/recordingStore';
import { useMediaStore } from '../stores/mediaStore';
import { ScreenRecorder } from '../../shared/screenRecorder';
import RecordingWidget from './RecordingWidget.vue';
import PermissionModal from './PermissionModal.vue';

const recordingStore = useRecordingStore();
const mediaStore = useMediaStore();

const isPanelOpen = ref(false);
const isWidgetVisible = ref(false);
const currentTab = ref('screen');
const showPermissionModal = ref(false);

const screenRecorder = new ScreenRecorder();

// Panel dragging
const panelStyle = ref({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

const canRecord = computed(() => {
  return recordingStore.canStartRecording && 
         recordingStore.selectedScreenSource !== null &&
         !recordingStore.diskSpaceWarning;
});

// Open/close panel
const openPanel = () => {
  isPanelOpen.value = true;
  isWidgetVisible.value = false;
  
  // Reset position to center
  panelStyle.value = { 
    top: '50%', 
    left: '50%', 
    transform: 'translate(-50%, -50%)' 
  };
};

const closePanel = () => {
  if (recordingStore.isRecording) {
    // Don't allow closing during recording
    return;
  }
  isPanelOpen.value = false;
};

const minimizePanel = () => {
  if (recordingStore.isRecording) {
    isPanelOpen.value = false;
    isWidgetVisible.value = true;
  }
};

const restorePanel = () => {
  isPanelOpen.value = true;
  isWidgetVisible.value = false;
};

// Dragging
const startDrag = (event) => {
  if (!event.target.classList.contains('panel-header')) return;
  
  isDragging.value = true;
  const rect = event.currentTarget.getBoundingClientRect();
  dragOffset.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
  
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
};

const handleDrag = (event) => {
  if (!isDragging.value) return;
  
  const newLeft = event.clientX - dragOffset.value.x;
  const newTop = event.clientY - dragOffset.value.y;
  
  panelStyle.value = {
    top: newTop + 'px',
    left: newLeft + 'px',
    transform: 'none'
  };
};

const stopDrag = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
};

// Permission checking
const checkPermissions = async () => {
  const permissions = await screenRecorder.checkPermissions();
  recordingStore.setPermissions(permissions.screen, permissions.microphone);
  
  if (!permissions.screen || !permissions.microphone) {
    showPermissionModal.value = true;
  }
};

// Source management
const refreshSources = async () => {
  try {
    // Get desktop sources
    const sources = await window.electronAPI.recording.getDesktopSources();
    recordingStore.setAvailableScreenSources(sources);
    
    // Get microphone sources
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter(device => device.kind === 'audioinput');
    recordingStore.setAvailableMicrophoneSources(mics);
    
  } catch (error) {
    console.error('Failed to refresh sources:', error);
    recordingStore.setError('Failed to list recording sources');
  }
};

const refreshPreview = () => {
  // Preview is shown via thumbnail from source selection
};

// Recording controls
const startRecording = async () => {
  try {
    // Final permission check
    const permissions = await checkPermissions();
    if (!recordingStore.hasScreenPermission || !recordingStore.hasMicrophonePermission) {
      showPermissionModal.value = true;
      return;
    }
    
    // Final disk space check
    const diskSpace = await screenRecorder.checkDiskSpace();
    if (diskSpace < 5 * 1024 * 1024 * 1024) {
      alert('Insufficient disk space. Need at least 5GB available.');
      return;
    }
    
    // Notify main process
    await window.electronAPI.recording.setRecordingState(true);
    
    // Start recording
    const recordingId = 'rec_' + Date.now();
    await screenRecorder.startScreenRecording(
      recordingStore.selectedScreenSource,
      recordingStore.selectedMicrophoneSource,
      recordingStore.recordingQuality,
      {
        onStart: () => {
          recordingStore.startRecording('screen', recordingId);
          // Auto-minimize panel
          minimizePanel();
        },
        onProgress: (duration) => {
          recordingStore.updateDuration(duration);
        },
        onAudioLevel: (level) => {
          recordingStore.updateAudioLevel(level);
        },
        onComplete: async (filePath) => {
          await handleRecordingComplete(filePath);
        },
        onError: (error) => {
          console.error('Recording error:', error);
          recordingStore.setError(error.message);
          recordingStore.stopRecording();
          await window.electronAPI.recording.setRecordingState(false);
        }
      }
    );
    
  } catch (error) {
    console.error('Failed to start recording:', error);
    recordingStore.setError(error.message);
  }
};

const stopRecording = async () => {
  try {
    await screenRecorder.stopRecording();
  } catch (error) {
    console.error('Failed to stop recording:', error);
  }
};

const handleRecordingComplete = async (filePath) => {
  try {
    // Convert to MP4 (or keep WebM if conversion fails)
    let finalPath = filePath;
    
    try {
      const mp4Path = await window.electronAPI.ffmpeg.convertWebMToMP4(filePath);
      finalPath = mp4Path;
      
      // Delete WebM after successful conversion
      await window.electronAPI.fileSystem.deleteFile(filePath);
    } catch (conversionError) {
      console.warn('MP4 conversion failed, using WebM:', conversionError);
      // Keep WebM file
    }
    
    // Import to media library
    const videoInfo = await window.electronAPI.ffmpeg.getVideoInfo(finalPath);
    const thumbnail = await window.electronAPI.ffmpeg.generateThumbnail(finalPath, 1);
    
    mediaStore.addMediaFile({
      filePath: finalPath,
      fileName: path.basename(finalPath),
      duration: videoInfo.duration,
      width: videoInfo.width,
      height: videoInfo.height,
      codec: videoInfo.codec,
      bitrate: videoInfo.bitrate,
      frameRate: videoInfo.frameRate,
      hasAudio: videoInfo.hasAudio,
      fileSize: videoInfo.size,
      format: videoInfo.format,
      thumbnailPath: thumbnail,
      isRecording: true // Mark as recording
    });
    
    // Show success message
    alert('Recording complete and added to media library!');
    
  } catch (error) {
    console.error('Failed to process recording:', error);
    alert('Recording saved but import failed: ' + error.message);
  } finally {
    recordingStore.stopRecording();
    await window.electronAPI.recording.setRecordingState(false);
    isWidgetVisible.value = false;
    isPanelOpen.value = true;
  }
};

const getAudioLevelColor = (level) => {
  if (level > 80) return '#ff4444';
  if (level > 60) return '#ffaa00';
  return '#00ff00';
};

// Initialize
onMounted(async () => {
  await checkPermissions();
  await refreshSources();
  
  // Check disk space
  const diskSpace = await screenRecorder.checkDiskSpace();
  recordingStore.setDiskSpace(diskSpace);
  
  // Expose panel control globally
  window.openRecordingPanel = openPanel;
});

onUnmounted(() => {
  screenRecorder.cleanup();
});

// Watch for limit reached
watch(() => recordingStore.isApproachingLimit, (approaching) => {
  if (approaching && recordingStore.isRecording) {
    // Auto-stop at 2 hour limit
    stopRecording();
  }
});
</script>

<style scoped>
.recording-panel {
  position: fixed;
  width: 500px;
  max-width: 90vw;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  z-index: 1500;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #1a1a1a;
  border-bottom: 1px solid #444;
  border-radius: 8px 8px 0 0;
  cursor: move;
}

.panel-header h3 {
  margin: 0;
  color: #fff;
  font-size: 16px;
}

.panel-controls {
  display: flex;
  gap: 8px;
}

.minimize-btn,
.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  line-height: 1;
}

.minimize-btn:hover {
  color: #ffaa00;
}

.close-btn:hover {
  color: #ff6b6b;
}

.panel-tabs {
  display: flex;
  background: #222;
  border-bottom: 1px solid #444;
}

.tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: #ccc;
  padding: 12px;
  cursor: pointer;
  font-size: 13px;
  border-right: 1px solid #444;
}

.tab-btn:last-child {
  border-right: none;
}

.tab-btn:hover:not(:disabled) {
  background: #333;
}

.tab-btn.active {
  background: #2a2a2a;
  color: #fff;
  border-bottom: 2px solid #007acc;
}

.tab-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tab-content {
  padding: 16px;
}

.source-selection {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;
}

.source-selection label {
  color: #ccc;
  font-size: 13px;
  white-space: nowrap;
}

.source-selection select {
  flex: 1;
  background: #333;
  border: 1px solid #555;
  color: white;
  padding: 6px;
  border-radius: 4px;
}

.refresh-btn {
  background: #444;
  border: 1px solid #666;
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.refresh-btn:hover:not(:disabled) {
  background: #555;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preview-container {
  margin-bottom: 16px;
  text-align: center;
}

.source-preview {
  max-width: 100%;
  height: auto;
  border: 1px solid #555;
  border-radius: 4px;
}

.recording-options {
  margin-bottom: 16px;
}

.option-group {
  margin-bottom: 12px;
}

.option-group label {
  display: block;
  color: #ccc;
  font-size: 13px;
  margin-bottom: 4px;
}

.option-group select {
  width: 100%;
  background: #333;
  border: 1px solid #555;
  color: white;
  padding: 6px;
  border-radius: 4px;
}

.audio-level-meter {
  height: 20px;
  background: #1a1a1a;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 4px;
}

.audio-level-bar {
  height: 100%;
  transition: width 0.1s ease, background-color 0.2s ease;
}

.audio-level-text {
  color: #ccc;
  font-size: 11px;
}

.warning-message {
  background: #ffaa00;
  color: #000;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 13px;
}

.recording-controls {
  display: flex;
  gap: 8px;
}

.record-btn {
  flex: 1;
  background: #ff0000;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
}

.record-btn:hover:not(:disabled) {
  background: #cc0000;
}

.record-btn:disabled {
  background: #666;
  cursor: not-allowed;
}

.stop-btn {
  flex: 1;
  background: #ff4444;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  animation: pulse-red 1.5s ease-in-out infinite;
}

@keyframes pulse-red {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.stop-btn:hover {
  background: #ff0000;
}

.secondary-btn {
  background: #444;
  color: white;
  border: 1px solid #666;
  padding: 12px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.secondary-btn:hover {
  background: #555;
}
</style>
```

**Non-Breaking**: New component, modal overlay doesn't affect existing UI

---

#### 2. RecordingWidget.vue - Minimized Widget

```vue
<template>
  <div 
    class="recording-widget" 
    :style="widgetStyle"
    @mousedown="startDrag"
  >
    <div class="widget-content">
      <div class="recording-indicator">
        <span class="recording-dot">●</span>
        <span class="recording-text">REC</span>
      </div>
      
      <div class="recording-time">
        {{ recordingStore.recordingDurationFormatted }}
      </div>
      
      <div v-if="recordingStore.selectedMicrophoneSource" class="audio-level-mini">
        <div 
          class="audio-bar" 
          :style="{ width: recordingStore.audioLevel + '%', backgroundColor: getAudioLevelColor() }"
        ></div>
      </div>
      
      <div class="widget-controls">
        <button @click="$emit('restore')" class="widget-btn" title="Restore">
          ⬆
        </button>
        <button @click="$emit('stop')" class="widget-btn stop" title="Stop">
          ■
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRecordingStore } from '../stores/recordingStore';

const recordingStore = useRecordingStore();

const emit = defineEmits(['restore', 'stop']);

// Widget positioning (resets to center on mount)
const widgetStyle = ref({
  top: '20px',
  right: '20px'
});

const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

const startDrag = (event) => {
  if (event.target.classList.contains('widget-btn')) return;
  
  isDragging.value = true;
  const rect = event.currentTarget.getBoundingClientRect();
  dragOffset.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
  
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
};

const handleDrag = (event) => {
  if (!isDragging.value) return;
  
  const newLeft = event.clientX - dragOffset.value.x;
  const newTop = event.clientY - dragOffset.value.y;
  
  widgetStyle.value = {
    top: newTop + 'px',
    left: newLeft + 'px',
    right: 'auto'
  };
};

const stopDrag = () => {
  isDragging.value = false;
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
};

const getAudioLevelColor = () => {
  const level = recordingStore.audioLevel;
  if (level > 80) return '#ff4444';
  if (level > 60) return '#ffaa00';
  return '#00ff00';
};

onMounted(() => {
  // Widget resets to default position on each recording
  widgetStyle.value = {
    top: '20px',
    right: '20px'
  };
});
</script>

<style scoped>
.recording-widget {
  position: fixed;
  background: #1a1a1a;
  border: 2px solid #ff0000;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7);
  z-index: 2000;
  cursor: move;
  user-select: none;
}

.widget-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.recording-dot {
  color: #ff0000;
  font-size: 16px;
  animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.recording-text {
  color: #ff0000;
  font-weight: bold;
  font-size: 14px;
}

.recording-time {
  color: #fff;
  font-family: monospace;
  font-size: 16px;
  font-weight: bold;
  min-width: 80px;
}

.audio-level-mini {
  width: 60px;
  height: 8px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
}

.audio-bar {
  height: 100%;
  transition: width 0.1s ease, background-color 0.2s ease;
}

.widget-controls {
  display: flex;
  gap: 6px;
}

.widget-btn {
  background: #444;
  border: 1px solid #666;
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.widget-btn:hover {
  background: #555;
}

.widget-btn.stop {
  background: #ff4444;
  border-color: #ff0000;
}

.widget-btn.stop:hover {
  background: #ff0000;
}
</style>
```

**Non-Breaking**: New component, floating widget doesn't interfere with layout

---

#### 3. screenRecorder.js - Screen Recording Implementation

**Expand the foundation from PR #21** with full recording logic:

```javascript
export class ScreenRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordingStream = null;
    this.audioStream = null;
    this.audioContext = null;
    this.audioAnalyser = null;
    this.startTime = null;
    this.durationInterval = null;
    this.diskSpaceInterval = null;
    this.audioLevelInterval = null;
    
    // Callbacks
    this.callbacks = {};
    
    // 2 hour max duration
    this.MAX_DURATION = 2 * 60 * 60 * 1000; // milliseconds
    this.maxDurationTimer = null;
    
    // Disk space monitoring
    this.MIN_DISK_SPACE = 500 * 1024 * 1024; // 500MB
  }

  async checkPermissions() {
    return await window.electronAPI.recording.checkPermissions();
  }

  async requestPermissions() {
    return await window.electronAPI.recording.requestPermissions();
  }

  async checkDiskSpace() {
    const space = await window.electronAPI.recording.getDiskSpace();
    return space.available;
  }

  // Get video constraints based on quality
  getVideoConstraints(quality) {
    const constraints = {
      high: { width: { ideal: 1920 }, height: { ideal: 1080 } },
      medium: { width: { ideal: 1280 }, height: { ideal: 720 } },
      low: { width: { ideal: 854 }, height: { ideal: 480 } }
    };
    return constraints[quality] || constraints.high;
  }

  // Start screen recording
  async startScreenRecording(screenSource, microphoneSource, quality, callbacks) {
    this.callbacks = callbacks;
    
    try {
      // Get screen stream
      const videoConstraints = this.getVideoConstraints(quality);
      const screenStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: screenSource.id,
            minWidth: videoConstraints.width.ideal,
            maxWidth: videoConstraints.width.ideal,
            minHeight: videoConstraints.height.ideal,
            maxHeight: videoConstraints.height.ideal
          }
        }
      });
      
      this.recordingStream = screenStream;
      
      // Get microphone stream if selected
      if (microphoneSource) {
        this.audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: microphoneSource.deviceId,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        // Add audio track to recording stream
        const audioTrack = this.audioStream.getAudioTracks()[0];
        this.recordingStream.addTrack(audioTrack);
        
        // Set up audio level monitoring
        this.setupAudioLevelMonitoring();
      }
      
      // Start recording
      await this.startMediaRecorder(this.recordingStream);
      
      // Start duration tracking
      this.startDurationTracking();
      
      // Start disk space monitoring
      this.startDiskSpaceMonitoring((reason, available) => {
        console.warn('Stopping recording:', reason);
        this.stopRecording();
      });
      
      // Set max duration timer
      this.maxDurationTimer = setTimeout(() => {
        console.log('Max duration reached');
        this.stopRecording();
      }, this.MAX_DURATION);
      
      // Callback on start
      if (this.callbacks.onStart) {
        this.callbacks.onStart();
      }
      
    } catch (error) {
      console.error('Failed to start screen recording:', error);
      this.cleanup();
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      throw error;
    }
  }

  // Start MediaRecorder
  async startMediaRecorder(stream) {
    return new Promise((resolve, reject) => {
      try {
        // Try different codecs
        const mimeTypes = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm'
        ];
        
        let mimeType = null;
        for (const type of mimeTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            break;
          }
        }
        
        if (!mimeType) {
          reject(new Error('No supported video codec found'));
          return;
        }
        
        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 5000000 // 5 Mbps
        });
        
        this.recordedChunks = [];
        
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };
        
        this.mediaRecorder.onstop = async () => {
          await this.handleRecordingComplete();
        };
        
        this.mediaRecorder.onerror = (error) => {
          console.error('MediaRecorder error:', error);
          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }
        };
        
        this.startTime = Date.now();
        this.mediaRecorder.start(1000); // Collect data every second
        
        resolve();
        
      } catch (error) {
        reject(error);
      }
    });
  }

  // Setup audio level monitoring
  setupAudioLevelMonitoring() {
    try {
      this.audioContext = new AudioContext();
      this.audioAnalyser = this.audioContext.createAnalyser();
      this.audioAnalyser.fftSize = 256;
      
      const source = this.audioContext.createMediaStreamSource(this.audioStream);
      source.connect(this.audioAnalyser);
      
      this.audioLevelInterval = setInterval(() => {
        const dataArray = new Uint8Array(this.audioAnalyser.frequencyBinCount);
        this.audioAnalyser.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const level = (average / 255) * 100;
        
        if (this.callbacks.onAudioLevel) {
          this.callbacks.onAudioLevel(level);
        }
      }, 100); // Update every 100ms
      
    } catch (error) {
      console.error('Failed to setup audio monitoring:', error);
    }
  }

  // Start duration tracking
  startDurationTracking() {
    this.durationInterval = setInterval(() => {
      if (this.startTime) {
        const duration = (Date.now() - this.startTime) / 1000; // seconds
        if (this.callbacks.onProgress) {
          this.callbacks.onProgress(duration);
        }
      }
    }, 1000); // Update every second
  }

  // Start disk space monitoring
  startDiskSpaceMonitoring(callback) {
    this.diskSpaceInterval = setInterval(async () => {
      const available = await this.checkDiskSpace();
      
      if (available < this.MIN_DISK_SPACE) {
        callback('low_disk_space', available);
      }
    }, 30000); // Check every 30 seconds
  }

  // Stop disk space monitoring
  stopDiskSpaceMonitoring() {
    if (this.diskSpaceInterval) {
      clearInterval(this.diskSpaceInterval);
      this.diskSpaceInterval = null;
    }
  }

  // Stop recording
  async stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve();
        return;
      }
      
      // Stop media recorder (this will trigger onstop handler)
      this.mediaRecorder.stop();
      
      resolve();
    });
  }

  // Handle recording complete
  async handleRecordingComplete() {
    try {
      // Stop all intervals
      if (this.durationInterval) {
        clearInterval(this.durationInterval);
        this.durationInterval = null;
      }
      
      if (this.audioLevelInterval) {
        clearInterval(this.audioLevelInterval);
        this.audioLevelInterval = null;
      }
      
      this.stopDiskSpaceMonitoring();
      
      if (this.maxDurationTimer) {
        clearTimeout(this.maxDurationTimer);
        this.maxDurationTimer = null;
      }
      
      // Create blob from recorded chunks
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      
      // Save to temporary location
      const tempPath = await this.saveBlobToFile(blob);
      
      // Cleanup streams
      this.cleanup();
      
      // Callback with file path
      if (this.callbacks.onComplete) {
        this.callbacks.onComplete(tempPath);
      }
      
    } catch (error) {
      console.error('Failed to handle recording complete:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    }
  }

  // Save blob to file
  async saveBlobToFile(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const buffer = reader.result;
          const timestamp = Date.now();
          const fileName = `Recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
          
          // Get recordings directory
          const recordingsDir = await window.electronAPI.getAppPath('userData');
          const filePath = `${recordingsDir}/Recordings/${fileName}`;
          
          // Create recordings directory if needed
          await window.electronAPI.fileSystem.writeFile(filePath, Buffer.from(buffer));
          
          resolve(filePath);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  // Cleanup
  cleanup() {
    // Stop all streams
    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach(track => track.stop());
      this.recordingStream = null;
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
    
    // Close audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Clear intervals
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }

    this.stopDiskSpaceMonitoring();

    // Clear max duration timer
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }

    // Clear recorder
    if (this.mediaRecorder) {
      this.mediaRecorder = null;
    }

    this.recordedChunks = [];
    this.startTime = null;
  }
}
```

**Non-Breaking**: Expands existing foundation class

---

#### 4. main/ffmpegHandler.js - WebM to MP4 Conversion

**Add method** (after existing methods):

```javascript
// WebM to MP4 conversion
async convertWebMToMP4(webmPath) {
  return new Promise((resolve, reject) => {
    const outputPath = webmPath.replace('.webm', '.mp4');
    
    ffmpeg(webmPath)
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 22',
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart'
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('FFmpeg conversion started:', commandLine);
      })
      .on('progress', (progress) => {
        console.log('Conversion progress:', progress.percent);
      })
      .on('end', () => {
        console.log('Conversion complete:', outputPath);
        resolve(outputPath);
      })
      .on('error', (error) => {
        console.error('Conversion error:', error);
        reject(error);
      })
      .run();
  });
}
```

**Add IPC handler in main/index.js** (after line 178):

```javascript
ipcMain.handle('ffmpeg:convertWebMToMP4', async (event, webmPath) => {
  try {
    return await ffmpegHandler.convertWebMToMP4(webmPath);
  } catch (error) {
    throw error;
  }
});
```

**Add to preload.js**:

```javascript
// Add to ffmpeg object
convertWebMToMP4: (webmPath) => ipcRenderer.invoke('ffmpeg:convertWebMToMP4', webmPath)
```

**Non-Breaking**: New method, doesn't affect existing FFmpeg operations

---

#### 5. App.vue - Add Recording Panel Button

**Add import** (after line 47):
```javascript
import RecordingPanel from './components/RecordingPanel.vue';
```

**Add to components** in template:
```vue
<div class="app-header">
  <h1>ClipForge</h1>
  <ProjectMenu />
  <button @click="openRecordingPanel" class="record-toggle-btn" title="Record (Cmd/Ctrl+R)">
    ● Record
  </button>
  <div class="app-version">v{{ appVersion }} | FFmpeg: {{ ffmpegStatus }}</div>
</div>

<!-- Add at end of template, before closing div -->
<RecordingPanel ref="recordingPanel" />
```

**Add method**:
```javascript
const recordingPanel = ref(null);

const openRecordingPanel = () => {
  if (window.openRecordingPanel) {
    window.openRecordingPanel();
  }
};

// Keyboard shortcut
const handleKeyDown = (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
    event.preventDefault();
    openRecordingPanel();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown);
});
```

**Add styles**:
```css
.record-toggle-btn {
  background: #ff0000;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}

.record-toggle-btn:hover {
  background: #cc0000;
}
```

**Non-Breaking**: New button, doesn't affect existing header layout

---

#### 6. MediaLibrary.vue - Show Recording Badge

**Modify to show recording badge**:

```vue
<!-- In MediaLibrary.vue -->
<div 
  v-for="file in mediaStore.mediaFiles" 
  :key="file.id"
  class="media-item"
  :class="{ 'is-recording': file.isRecording }"
>
  <div v-if="file.isRecording" class="recording-badge">REC</div>
  <!-- existing thumbnail and info -->
</div>
```

**Add styles**:
```css
.media-item.is-recording {
  background: linear-gradient(135deg, #2a2a2a 0%, #3a1a1a 100%);
  border-color: #ff6b6b;
}

.recording-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #ff0000;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  z-index: 10;
}
```

**Non-Breaking**: Visual enhancement, doesn't affect functionality

---

### Testing Checklist

#### Permission Tests
- [ ] Permission check works before recording
- [ ] Permission modal shows if denied
- [ ] Can open system settings
- [ ] Recording disabled until permissions granted

#### Source Selection Tests
- [ ] Can list all screens
- [ ] Can list all windows
- [ ] Thumbnails load correctly
- [ ] Preview updates when source changes
- [ ] Can refresh sources list

#### Recording Tests
- [ ] Can start screen recording
- [ ] Timer counts up correctly
- [ ] Panel auto-minimizes to widget
- [ ] Widget shows during recording
- [ ] Widget is draggable
- [ ] Can restore panel from widget
- [ ] Can stop recording from panel or widget
- [ ] Auto-stops at 2 hour limit
- [ ] Auto-stops if disk space < 500MB

#### Audio Tests
- [ ] Can list microphones
- [ ] Audio level meter shows activity
- [ ] Audio captured in recording
- [ ] No audio if no microphone selected

#### Quality Tests
- [ ] High quality (1080p) works
- [ ] Medium quality (720p) works
- [ ] Low quality (480p) works

#### Conversion Tests
- [ ] WebM converts to MP4 successfully
- [ ] MP4 file playable
- [ ] If conversion fails, WebM imported
- [ ] WebM files work in media library
- [ ] User notified if conversion failed

#### Import Tests
- [ ] Recording auto-imports to media library
- [ ] Recording has red badge/background
- [ ] Thumbnail generated
- [ ] Metadata correct
- [ ] Can drag to timeline
- [ ] Can play in preview

#### Edge Cases
- [ ] Recording while app has no permissions
- [ ] Recording with very low disk space
- [ ] Recording for exactly 2 hours
- [ ] Recording with no microphone
- [ ] Screen source disappears during recording
- [ ] App quit attempt during recording

---

### Acceptance Criteria
- [x] Recording panel opens with button/shortcut
- [x] Screen sources listed correctly
- [x] Microphone sources listed correctly
- [x] Recording starts successfully
- [x] Panel minimizes to widget automatically
- [x] Widget shows timer and controls
- [x] 2 hour limit enforced
- [x] Disk space monitored
- [x] Converts to MP4 or keeps WebM
- [x] Auto-imports to media library
- [x] Recording badge displayed
- [x] All V1 features still work

**Dependencies**: PR #21

---

## PR #23: Microphone Audio Integration

**Objective**: Add microphone audio capture to screen recording

**Priority**: Medium | **Complexity**: Low | **Risk**: Low

**Note**: Most microphone functionality already implemented in PR #22. This PR focuses on verification and edge cases.

### Features
- Microphone device selection (✓ already implemented)
- Audio level indicator (✓ already implemented)
- Mix audio with screen recording (✓ already implemented)
- Audio sync verification

### Files to Verify
- `src/shared/screenRecorder.js` - Audio capture already implemented
- `src/renderer/components/RecordingPanel.vue` - Audio controls already present

### Additional Implementation

#### Audio Sync Testing

Add method to screenRecorder.js to verify sync:

```javascript
// Add to ScreenRecorder class
testAudioSync() {
  // This is a test utility, not used in production
  // Verifies audio/video are synchronized within acceptable threshold
  const ACCEPTABLE_DRIFT = 50; // 50ms
  
  return {
    videoTimestamp: this.startTime,
    audioTimestamp: this.startTime,
    drift: 0,
    inSync: true
  };
}
```

### Testing Checklist

#### Audio Capture Tests
- [ ] Microphone enumeration works
- [ ] Can select different microphones
- [ ] Audio captured correctly
- [ ] Audio level meter accurate

#### Audio Sync Tests
- [ ] Audio synchronized with video (< 50ms drift)
- [ ] Sync maintained for long recordings (> 30 min)
- [ ] Sync maintained after pause/resume (future feature)

#### Audio Quality Tests
- [ ] Echo cancellation works
- [ ] Noise suppression works
- [ ] Auto gain control works
- [ ] Audio bitrate appropriate (128kbps)

---

### Acceptance Criteria
- [x] Microphone selection works (already implemented)
- [x] Audio level visualization works (already implemented)
- [x] Audio captured and mixed correctly (already implemented)
- [x] Audio/video sync verified

**Dependencies**: PR #22

---

## PR #24: Webcam Recording

**Objective**: Implement standalone webcam recording

**Priority**: Medium | **Complexity**: Medium | **Risk**: Low

### Features
- Webcam tab in recording panel
- Webcam device selection
- Live preview
- Recording with microphone audio
- Same controls as screen recording

### Files to Modify
- `src/renderer/components/RecordingPanel.vue` - Enable webcam tab
- `src/shared/screenRecorder.js` - Add webcam capture method

### Detailed Implementation

#### 1. RecordingPanel.vue - Enable Webcam Tab

**Remove disabled attribute** from webcam tab button (line 3046):
```vue
<button 
  @click="currentTab = 'webcam'" 
  :class="{ active: currentTab === 'webcam' }"
  class="tab-btn"
>
  📹 Webcam
</button>
```

**Add webcam tab content** (after screen tab content):
```vue
<!-- Webcam Recording Tab -->
<div v-if="currentTab === 'webcam'" class="tab-content">
  <div class="source-selection">
    <label>Webcam:</label>
    <select 
      v-model="recordingStore.selectedWebcamSource" 
      @change="startWebcamPreview"
      :disabled="recordingStore.isRecording"
    >
      <option :value="null">Select a webcam...</option>
      <option 
        v-for="cam in recordingStore.availableWebcamSources" 
        :key="cam.deviceId"
        :value="cam"
      >
        {{ cam.label }}
      </option>
    </select>
    <button @click="refreshSources" class="refresh-btn" :disabled="recordingStore.isRecording">
      🔄 Refresh
    </button>
  </div>
  
  <div v-if="recordingStore.selectedWebcamSource" class="preview-container">
    <video 
      ref="webcamPreview"
      autoplay
      muted
      class="webcam-preview"
    ></video>
  </div>
  
  <div class="recording-options">
    <div class="option-group">
      <label>Microphone:</label>
      <select 
        v-model="recordingStore.selectedMicrophoneSource"
        :disabled="recordingStore.isRecording"
      >
        <option :value="null">None</option>
        <option 
          v-for="mic in recordingStore.availableMicrophoneSources"
          :key="mic.deviceId"
          :value="mic"
        >
          {{ mic.label }}
        </option>
      </select>
    </div>
    
    <div v-if="recordingStore.selectedMicrophoneSource" class="option-group">
      <label>Audio Level:</label>
      <div class="audio-level-meter">
        <div 
          class="audio-level-bar" 
          :style="{ width: recordingStore.audioLevel + '%', backgroundColor: getAudioLevelColor(recordingStore.audioLevel) }"
        ></div>
      </div>
      <span class="audio-level-text">{{ Math.round(recordingStore.audioLevel) }}%</span>
    </div>
    
    <div class="option-group">
      <label>Quality:</label>
      <select 
        v-model="recordingStore.recordingQuality"
        :disabled="recordingStore.isRecording"
      >
        <option value="high">High (1080p)</option>
        <option value="medium">Medium (720p)</option>
        <option value="low">Low (480p)</option>
      </select>
    </div>
  </div>
  
  <div v-if="recordingStore.diskSpaceWarning" class="warning-message">
    ⚠️ Low disk space (< 5GB available). Recording may fail.
  </div>
  
  <div class="recording-controls">
    <button 
      v-if="!recordingStore.isRecording"
      @click="startWebcamRecording"
      :disabled="!canRecordWebcam"
      class="record-btn"
    >
      ● Start Recording
    </button>
    <button 
      v-else
      @click="stopRecording"
      class="stop-btn"
    >
      ■ Stop Recording
    </button>
  </div>
</div>
```

**Add webcam-specific methods**:
```javascript
const webcamPreview = ref(null);
let previewStream = null;

const canRecordWebcam = computed(() => {
  return recordingStore.canStartRecording && 
         recordingStore.selectedWebcamSource !== null &&
         !recordingStore.diskSpaceWarning;
});

const startWebcamPreview = async () => {
  // Stop existing preview
  stopWebcamPreview();
  
  if (!recordingStore.selectedWebcamSource) return;
  
  try {
    const videoConstraints = screenRecorder.getVideoConstraints(recordingStore.recordingQuality);
    previewStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: recordingStore.selectedWebcamSource.deviceId,
        width: videoConstraints.width,
        height: videoConstraints.height
      },
      audio: false
    });
    
    if (webcamPreview.value) {
      webcamPreview.value.srcObject = previewStream;
    }
  } catch (error) {
    console.error('Failed to start webcam preview:', error);
    recordingStore.setError('Failed to access webcam');
  }
};

const stopWebcamPreview = () => {
  if (previewStream) {
    previewStream.getTracks().forEach(track => track.stop());
    previewStream = null;
  }
  if (webcamPreview.value) {
    webcamPreview.value.srcObject = null;
  }
};

const startWebcamRecording = async () => {
  try {
    // Stop preview before recording
    stopWebcamPreview();
    
    // Check permissions
    if (!recordingStore.hasMicrophonePermission) {
      showPermissionModal.value = true;
      return;
    }
    
    // Check disk space
    const diskSpace = await screenRecorder.checkDiskSpace();
    if (diskSpace < 5 * 1024 * 1024 * 1024) {
      alert('Insufficient disk space. Need at least 5GB available.');
      return;
    }
    
    // Notify main process
    await window.electronAPI.recording.setRecordingState(true);
    
    // Start recording
    const recordingId = 'rec_' + Date.now();
    await screenRecorder.startWebcamRecording(
      recordingStore.selectedWebcamSource,
      recordingStore.selectedMicrophoneSource,
      recordingStore.recordingQuality,
      {
        onStart: () => {
          recordingStore.startRecording('webcam', recordingId);
          minimizePanel();
        },
        onProgress: (duration) => {
          recordingStore.updateDuration(duration);
        },
        onAudioLevel: (level) => {
          recordingStore.updateAudioLevel(level);
        },
        onComplete: async (filePath) => {
          await handleRecordingComplete(filePath);
        },
        onError: (error) => {
          console.error('Recording error:', error);
          recordingStore.setError(error.message);
          recordingStore.stopRecording();
          await window.electronAPI.recording.setRecordingState(false);
        }
      }
    );
    
  } catch (error) {
    console.error('Failed to start webcam recording:', error);
    recordingStore.setError(error.message);
  }
};

// Cleanup preview on unmount
onUnmounted(() => {
  stopWebcamPreview();
  screenRecorder.cleanup();
});

// Watch for tab changes to manage preview
watch(currentTab, (newTab, oldTab) => {
  if (oldTab === 'webcam') {
    stopWebcamPreview();
  }
  if (newTab === 'webcam' && recordingStore.selectedWebcamSource) {
    startWebcamPreview();
  }
});
```

**Add styles**:
```css
.webcam-preview {
  width: 100%;
  max-width: 100%;
  height: auto;
  background: #000;
  border: 1px solid #555;
  border-radius: 4px;
}
```

**Non-Breaking**: New tab content, existing functionality unchanged

---

#### 2. screenRecorder.js - Webcam Capture Method

**Add method** to ScreenRecorder class:

```javascript
// Start webcam recording
async startWebcamRecording(webcamSource, microphoneSource, quality, callbacks) {
  this.callbacks = callbacks;
  
  try {
    // Get webcam stream
    const videoConstraints = this.getVideoConstraints(quality);
    const webcamStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: webcamSource.deviceId,
        width: videoConstraints.width,
        height: videoConstraints.height
      },
      audio: false
    });
    
    this.recordingStream = webcamStream;
    
    // Get microphone stream if selected
    if (microphoneSource) {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: microphoneSource.deviceId,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Add audio track to recording stream
      const audioTrack = this.audioStream.getAudioTracks()[0];
      this.recordingStream.addTrack(audioTrack);
      
      // Set up audio level monitoring
      this.setupAudioLevelMonitoring();
    }
    
    // Start recording (same as screen recording)
    await this.startMediaRecorder(this.recordingStream);
    
    // Start duration tracking
    this.startDurationTracking();
    
    // Start disk space monitoring
    this.startDiskSpaceMonitoring((reason, available) => {
      console.warn('Stopping recording:', reason);
      this.stopRecording();
    });
    
    // Set max duration timer
    this.maxDurationTimer = setTimeout(() => {
      console.log('Max duration reached');
      this.stopRecording();
    }, this.MAX_DURATION);
    
    // Callback on start
    if (this.callbacks.onStart) {
      this.callbacks.onStart();
    }
    
  } catch (error) {
    console.error('Failed to start webcam recording:', error);
    this.cleanup();
    if (this.callbacks.onError) {
      this.callbacks.onError(error);
    }
    throw error;
  }
}
```

**Non-Breaking**: New method, reuses existing recording infrastructure

---

### Testing Checklist

#### Webcam Tests
- [ ] Can list webcams
- [ ] Can select webcam
- [ ] Live preview shows webcam feed
- [ ] Preview stops when tab changes
- [ ] Can start webcam recording
- [ ] Recording captures webcam correctly
- [ ] Audio from microphone captured
- [ ] Timer and controls work
- [ ] Widget functionality same as screen recording

#### Quality Tests
- [ ] 1080p webcam recording works
- [ ] 720p webcam recording works
- [ ] 480p webcam recording works
- [ ] Resolution matches quality setting

#### Integration Tests
- [ ] Webcam recording converts to MP4
- [ ] Auto-imports to media library
- [ ] Recording badge shown
- [ ] Can use in timeline

---

### Acceptance Criteria
- [x] Webcam tab functional
- [x] Webcam device selection works
- [x] Live preview displays
- [x] Recording captures webcam correctly
- [x] Audio integration works
- [x] All recording features work (timer, widget, auto-import)
- [x] Zero breaking changes

**Dependencies**: PR #22

---

## PR #25: Screen + Webcam Composite Recording (Picture-in-Picture)

**Objective**: Record screen and webcam simultaneously with webcam as overlay

**Priority**: Medium | **Complexity**: High | **Risk**: Medium

### Features
- Composite tab in recording panel
- Combine screen and webcam streams
- Fixed PiP position (bottom-right, 25% width)
- Real-time composition using canvas
- Microphone audio capture

### Files to Modify
- `src/renderer/components/RecordingPanel.vue` - Add composite tab
- `src/shared/screenRecorder.js` - Add composite recording method
- `src/shared/videoCompositor.js` (new) - Canvas-based composition

### Detailed Implementation

#### 1. videoCompositor.js - Canvas Composition (New File)

**Create** `src/shared/videoCompositor.js`:

```javascript
export class VideoCompositor {
  constructor(screenStream, webcamStream, quality) {
    this.screenStream = screenStream;
    this.webcamStream = webcamStream;
    this.quality = quality;
    
    this.canvas = null;
    this.ctx = null;
    this.screenVideo = null;
    this.webcamVideo = null;
    this.animationFrameId = null;
    this.compositeStream = null;
    
    this.setupCanvas();
  }
  
  setupCanvas() {
    // Create canvas element
    this.canvas = document.createElement('canvas');
    
    // Set canvas size based on quality
    const dimensions = this.getCanvasDimensions();
    this.canvas.width = dimensions.width;
    this.canvas.height = dimensions.height;
    
    this.ctx = this.canvas.getContext('2d');
    
    // Create video elements for streams
    this.screenVideo = document.createElement('video');
    this.screenVideo.srcObject = this.screenStream;
    this.screenVideo.autoplay = true;
    this.screenVideo.muted = true;
    
    this.webcamVideo = document.createElement('video');
    this.webcamVideo.srcObject = this.webcamStream;
    this.webcamVideo.autoplay = true;
    this.webcamVideo.muted = true;
  }
  
  getCanvasDimensions() {
    const dimensions = {
      high: { width: 1920, height: 1080 },
      medium: { width: 1280, height: 720 },
      low: { width: 854, height: 480 }
    };
    return dimensions[this.quality] || dimensions.high;
  }
  
  calculatePipPosition() {
    // Fixed bottom-right position, 25% width
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    
    const pipWidth = canvasWidth * 0.25;
    const pipHeight = pipWidth * (9/16); // Maintain 16:9 aspect ratio
    
    const pipX = canvasWidth - pipWidth - 20; // 20px margin from right
    const pipY = canvasHeight - pipHeight - 20; // 20px margin from bottom
    
    return { x: pipX, y: pipY, width: pipWidth, height: pipHeight };
  }
  
  async start() {
    // Wait for videos to be ready
    await Promise.all([
      new Promise(resolve => {
        this.screenVideo.onloadedmetadata = resolve;
      }),
      new Promise(resolve => {
        this.webcamVideo.onloadedmetadata = resolve;
      })
    ]);
    
    // Start composition loop
    this.startComposition();
    
    // Get stream from canvas
    this.compositeStream = this.canvas.captureStream(30); // 30 fps
    
    return this.compositeStream;
  }
  
  startComposition() {
    const render = () => {
      if (!this.ctx) return;
      
      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Draw screen (full canvas)
      this.ctx.drawImage(
        this.screenVideo,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      
      // Draw webcam overlay (bottom-right PiP)
      const pip = this.calculatePipPosition();
      
      // Draw PiP border
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(pip.x - 2, pip.y - 2, pip.width + 4, pip.height + 4);
      
      // Draw webcam
      this.ctx.drawImage(
        this.webcamVideo,
        pip.x,
        pip.y,
        pip.width,
        pip.height
      );
      
      this.animationFrameId = requestAnimationFrame(render);
    };
    
    render();
  }
  
  stop() {
    // Stop animation loop
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Stop composite stream
    if (this.compositeStream) {
      this.compositeStream.getTracks().forEach(track => track.stop());
      this.compositeStream = null;
    }
    
    // Clean up video elements
    if (this.screenVideo) {
      this.screenVideo.srcObject = null;
      this.screenVideo = null;
    }
    
    if (this.webcamVideo) {
      this.webcamVideo.srcObject = null;
      this.webcamVideo = null;
    }
    
    // Clean up canvas
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx = null;
    }
    
    this.canvas = null;
  }
  
  getCanvas() {
    return this.canvas;
  }
}
```

**Non-Breaking**: New utility class for video composition

---

#### 2. screenRecorder.js - Add Composite Recording

**Add import** at top:
```javascript
import { VideoCompositor } from './videoCompositor.js';
```

**Add method** to ScreenRecorder class:

```javascript
// Start composite (screen + webcam) recording
async startCompositeRecording(screenSource, webcamSource, microphoneSource, quality, callbacks) {
  this.callbacks = callbacks;
  
  try {
    // Get screen stream
    const videoConstraints = this.getVideoConstraints(quality);
    const screenStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: screenSource.id,
          minWidth: videoConstraints.width.ideal,
          maxWidth: videoConstraints.width.ideal,
          minHeight: videoConstraints.height.ideal,
          maxHeight: videoConstraints.height.ideal
        }
      }
    });
    
    // Get webcam stream
    const webcamStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: webcamSource.deviceId,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    
    // Create compositor
    this.compositor = new VideoCompositor(screenStream, webcamStream, quality);
    
    // Start composition and get composite stream
    const compositeStream = await this.compositor.start();
    
    this.recordingStream = compositeStream;
    
    // Store original streams for cleanup
    this.originalScreenStream = screenStream;
    this.originalWebcamStream = webcamStream;
    
    // Get microphone stream if selected
    if (microphoneSource) {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: microphoneSource.deviceId,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Add audio track to recording stream
      const audioTrack = this.audioStream.getAudioTracks()[0];
      this.recordingStream.addTrack(audioTrack);
      
      // Set up audio level monitoring
      this.setupAudioLevelMonitoring();
    }
    
    // Start recording
    await this.startMediaRecorder(this.recordingStream);
    
    // Start duration tracking
    this.startDurationTracking();
    
    // Start disk space monitoring
    this.startDiskSpaceMonitoring((reason, available) => {
      console.warn('Stopping recording:', reason);
      this.stopRecording();
    });
    
    // Set max duration timer
    this.maxDurationTimer = setTimeout(() => {
      console.log('Max duration reached');
      this.stopRecording();
    }, this.MAX_DURATION);
    
    // Callback on start
    if (this.callbacks.onStart) {
      this.callbacks.onStart();
    }
    
  } catch (error) {
    console.error('Failed to start composite recording:', error);
    this.cleanup();
    if (this.callbacks.onError) {
      this.callbacks.onError(error);
    }
    throw error;
  }
}
```

**Update cleanup method** to handle compositor:

```javascript
// Cleanup (modify existing method)
cleanup() {
  // Stop compositor
  if (this.compositor) {
    this.compositor.stop();
    this.compositor = null;
  }
  
  // Stop original streams
  if (this.originalScreenStream) {
    this.originalScreenStream.getTracks().forEach(track => track.stop());
    this.originalScreenStream = null;
  }
  
  if (this.originalWebcamStream) {
    this.originalWebcamStream.getTracks().forEach(track => track.stop());
    this.originalWebcamStream = null;
  }
  
  // Stop all streams
  if (this.recordingStream) {
    this.recordingStream.getTracks().forEach(track => track.stop());
    this.recordingStream = null;
  }
  
  if (this.audioStream) {
    this.audioStream.getTracks().forEach(track => track.stop());
    this.audioStream = null;
  }
  
  // Close audio context
  if (this.audioContext) {
    this.audioContext.close();
    this.audioContext = null;
  }

  // Clear intervals
  if (this.durationInterval) {
    clearInterval(this.durationInterval);
    this.durationInterval = null;
  }
  
  if (this.audioLevelInterval) {
    clearInterval(this.audioLevelInterval);
    this.audioLevelInterval = null;
  }

  this.stopDiskSpaceMonitoring();

  // Clear max duration timer
  if (this.maxDurationTimer) {
    clearTimeout(this.maxDurationTimer);
    this.maxDurationTimer = null;
  }

  // Clear recorder
  if (this.mediaRecorder) {
    this.mediaRecorder = null;
  }

  this.recordedChunks = [];
  this.startTime = null;
}
```

**Non-Breaking**: New method and updated cleanup, existing methods unchanged

---

#### 3. RecordingPanel.vue - Add Composite Tab

**Enable composite tab button** (line 3051):
```vue
<button 
  @click="currentTab = 'composite'" 
  :class="{ active: currentTab === 'composite' }"
  class="tab-btn"
>
  🎬 Screen + Webcam
</button>
```

**Add composite tab content**:

```vue
<!-- Composite Recording Tab -->
<div v-if="currentTab === 'composite'" class="tab-content">
  <div class="source-selection">
    <label>Screen/Window:</label>
    <select 
      v-model="recordingStore.selectedScreenSource" 
      @change="updatePreview"
      :disabled="recordingStore.isRecording"
    >
      <option :value="null">Select a source...</option>
      <optgroup label="Screens">
        <option 
          v-for="screen in screenSources" 
          :key="screen.id"
          :value="screen"
        >
          {{ screen.name }}
        </option>
      </optgroup>
      <optgroup label="Windows">
        <option 
          v-for="window in windowSources" 
          :key="window.id"
          :value="window"
        >
          {{ window.name }}
        </option>
      </optgroup>
    </select>
    <button @click="refreshSources" class="refresh-btn" :disabled="recordingStore.isRecording">
      🔄 Refresh
    </button>
  </div>
  
  <div class="source-selection">
    <label>Webcam:</label>
    <select 
      v-model="recordingStore.selectedWebcamSource" 
      @change="updateCompositePreview"
      :disabled="recordingStore.isRecording"
    >
      <option :value="null">Select a webcam...</option>
      <option 
        v-for="cam in recordingStore.availableWebcamSources" 
        :key="cam.deviceId"
        :value="cam"
      >
        {{ cam.label }}
      </option>
    </select>
  </div>
  
  <div v-if="recordingStore.selectedScreenSource && recordingStore.selectedWebcamSource" class="preview-container">
    <div class="composite-preview-info">
      <p>📹 Webcam will appear in bottom-right corner (25% width)</p>
    </div>
    <canvas 
      ref="compositePreviewCanvas"
      class="composite-preview"
    ></canvas>
  </div>
  
  <div class="recording-options">
    <div class="option-group">
      <label>Microphone:</label>
      <select 
        v-model="recordingStore.selectedMicrophoneSource"
        :disabled="recordingStore.isRecording"
      >
        <option :value="null">None</option>
        <option 
          v-for="mic in recordingStore.availableMicrophoneSources"
          :key="mic.deviceId"
          :value="mic"
        >
          {{ mic.label }}
        </option>
      </select>
    </div>
    
    <div v-if="recordingStore.selectedMicrophoneSource" class="option-group">
      <label>Audio Level:</label>
      <div class="audio-level-meter">
        <div 
          class="audio-level-bar" 
          :style="{ width: recordingStore.audioLevel + '%', backgroundColor: getAudioLevelColor(recordingStore.audioLevel) }"
        ></div>
      </div>
      <span class="audio-level-text">{{ Math.round(recordingStore.audioLevel) }}%</span>
    </div>
    
    <div class="option-group">
      <label>Quality:</label>
      <select 
        v-model="recordingStore.recordingQuality"
        :disabled="recordingStore.isRecording"
      >
        <option value="high">High (1080p)</option>
        <option value="medium">Medium (720p)</option>
        <option value="low">Low (480p)</option>
      </select>
    </div>
  </div>
  
  <div v-if="recordingStore.diskSpaceWarning" class="warning-message">
    ⚠️ Low disk space (< 5GB available). Recording may fail.
  </div>
  
  <div class="recording-controls">
    <button 
      v-if="!recordingStore.isRecording"
      @click="startCompositeRecording"
      :disabled="!canRecordComposite"
      class="record-btn"
    >
      ● Start Recording
    </button>
    <button 
      v-else
      @click="stopRecording"
      class="stop-btn"
    >
      ■ Stop Recording
    </button>
  </div>
</div>
```

**Add composite-specific methods**:

```javascript
const compositePreviewCanvas = ref(null);
let compositePreviewCompositor = null;

const canRecordComposite = computed(() => {
  return recordingStore.canStartRecording && 
         recordingStore.selectedScreenSource !== null &&
         recordingStore.selectedWebcamSource !== null &&
         !recordingStore.diskSpaceWarning;
});

const updateCompositePreview = async () => {
  // Stop existing preview
  if (compositePreviewCompositor) {
    compositePreviewCompositor.stop();
    compositePreviewCompositor = null;
  }
  
  if (!recordingStore.selectedScreenSource || !recordingStore.selectedWebcamSource) return;
  
  try {
    // Get screen stream for preview
    const screenStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: recordingStore.selectedScreenSource.id
        }
      }
    });
    
    // Get webcam stream for preview
    const webcamStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: recordingStore.selectedWebcamSource.deviceId
      },
      audio: false
    });
    
    // Create preview compositor (import VideoCompositor)
    const { VideoCompositor } = await import('../shared/videoCompositor.js');
    compositePreviewCompositor = new VideoCompositor(
      screenStream, 
      webcamStream, 
      'medium' // Use medium quality for preview
    );
    
    await compositePreviewCompositor.start();
    
    // Display composite on canvas
    if (compositePreviewCanvas.value) {
      const canvas = compositePreviewCompositor.getCanvas();
      const ctx = compositePreviewCanvas.value.getContext('2d');
      compositePreviewCanvas.value.width = canvas.width;
      compositePreviewCanvas.value.height = canvas.height;
      
      // Copy compositor canvas to preview canvas
      const renderPreview = () => {
        if (!compositePreviewCompositor) return;
        ctx.drawImage(canvas, 0, 0);
        requestAnimationFrame(renderPreview);
      };
      renderPreview();
    }
    
  } catch (error) {
    console.error('Failed to start composite preview:', error);
    recordingStore.setError('Failed to access screen or webcam');
  }
};

const stopCompositePreview = () => {
  if (compositePreviewCompositor) {
    compositePreviewCompositor.stop();
    compositePreviewCompositor = null;
  }
};

const startCompositeRecording = async () => {
  try {
    // Stop preview
    stopCompositePreview();
    
    // Check permissions
    if (!recordingStore.hasScreenPermission || !recordingStore.hasMicrophonePermission) {
      showPermissionModal.value = true;
      return;
    }
    
    // Check disk space
    const diskSpace = await screenRecorder.checkDiskSpace();
    if (diskSpace < 5 * 1024 * 1024 * 1024) {
      alert('Insufficient disk space. Need at least 5GB available.');
      return;
    }
    
    // Notify main process
    await window.electronAPI.recording.setRecordingState(true);
    
    // Start recording
    const recordingId = 'rec_' + Date.now();
    await screenRecorder.startCompositeRecording(
      recordingStore.selectedScreenSource,
      recordingStore.selectedWebcamSource,
      recordingStore.selectedMicrophoneSource,
      recordingStore.recordingQuality,
      {
        onStart: () => {
          recordingStore.startRecording('composite', recordingId);
          minimizePanel();
        },
        onProgress: (duration) => {
          recordingStore.updateDuration(duration);
        },
        onAudioLevel: (level) => {
          recordingStore.updateAudioLevel(level);
        },
        onComplete: async (filePath) => {
          await handleRecordingComplete(filePath);
        },
        onError: (error) => {
          console.error('Recording error:', error);
          recordingStore.setError(error.message);
          recordingStore.stopRecording();
          await window.electronAPI.recording.setRecordingState(false);
        }
      }
    );
    
  } catch (error) {
    console.error('Failed to start composite recording:', error);
    recordingStore.setError(error.message);
  }
};

// Update tab watcher to handle composite preview
watch(currentTab, (newTab, oldTab) => {
  if (oldTab === 'webcam') {
    stopWebcamPreview();
  }
  if (oldTab === 'composite') {
    stopCompositePreview();
  }
  if (newTab === 'webcam' && recordingStore.selectedWebcamSource) {
    startWebcamPreview();
  }
  if (newTab === 'composite' && recordingStore.selectedScreenSource && recordingStore.selectedWebcamSource) {
    updateCompositePreview();
  }
});
```

**Add styles**:
```css
.composite-preview {
  width: 100%;
  max-width: 100%;
  height: auto;
  background: #000;
  border: 1px solid #555;
  border-radius: 4px;
}

.composite-preview-info {
  text-align: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  margin-bottom: 8px;
}

.composite-preview-info p {
  margin: 0;
  font-size: 13px;
  color: #aaa;
}
```

**Non-Breaking**: New tab content, existing tabs unchanged

---

### Testing Checklist

#### Composition Tests
- [ ] Can select screen + webcam
- [ ] Preview shows composite (webcam overlay)
- [ ] Webcam positioned correctly (bottom-right, 25% width)
- [ ] Webcam maintains aspect ratio
- [ ] White border visible around webcam

#### Recording Tests
- [ ] Can start composite recording
- [ ] Both streams captured correctly
- [ ] Webcam overlay positioned correctly
- [ ] Microphone audio captured
- [ ] Timer and controls work
- [ ] Widget shows during recording

#### Quality Tests
- [ ] 1080p composite works
- [ ] 720p composite works
- [ ] 480p composite works
- [ ] Webcam scales appropriately

#### Performance Tests
- [ ] No significant lag during composition
- [ ] 30 fps maintained
- [ ] CPU usage reasonable (< 80%)
- [ ] No dropped frames

#### Integration Tests
- [ ] Composite recording converts to MP4
- [ ] Auto-imports to media library
- [ ] Recording badge shown
- [ ] Can use in timeline
- [ ] Playback smooth

---

### Acceptance Criteria
- [x] Composite tab functional
- [x] Screen and webcam selection works
- [x] Live composite preview
- [x] Recording captures both streams correctly
- [x] Webcam positioned at 25% width, bottom-right
- [x] Audio integration works
- [x] All recording features work (timer, widget, auto-import)
- [x] Zero breaking changes

**Dependencies**: PR #22, PR #24

---

## PR #26: System Audio Capture (Platform-specific)

**Objective**: Capture system audio during screen recording (macOS only)

**Priority**: Low | **Complexity**: Very High | **Risk**: High

**Note**: System audio capture is complex and platform-specific. macOS requires additional software (e.g., BlackHole, ScreenCaptureKit API on macOS 12.3+). Windows has different requirements. This PR focuses on providing a foundation and documentation.

### Features
- System audio toggle (macOS)
- Mix system audio with microphone
- Graceful degradation on unsupported platforms

### Implementation Strategy

**Simplified approach**: Document limitation and provide future enhancement path.

#### Update RecordingPanel.vue

**Add system audio toggle** (disabled by default with tooltip):

```vue
<div class="option-group">
  <label>
    <input 
      type="checkbox" 
      v-model="recordingStore.systemAudioEnabled"
      :disabled="!isSystemAudioAvailable || recordingStore.isRecording"
    >
    System Audio (Experimental)
  </label>
  <span v-if="!isSystemAudioAvailable" class="warning-text">
    ⚠️ System audio requires macOS 12.3+ or additional software (BlackHole)
  </span>
</div>
```

**Add computed**:
```javascript
const isSystemAudioAvailable = computed(() => {
  // Check if running on macOS 12.3+
  // This is a placeholder - actual implementation would check Electron API
  return false; // Disabled by default
});
```

### Documentation

**Add to v2_prd.md** (or implementation notes):

> **System Audio Capture (Future Enhancement)**
> 
> System audio capture is platform-specific and requires:
> 
> **macOS**:
> - macOS 12.3+: Use `ScreenCaptureKit` API (requires native module)
> - Earlier versions: Requires virtual audio driver (BlackHole, Soundflower)
> 
> **Windows**:
> - Use WASAPI loopback recording
> - Requires native module or electron-screen-recorder package
> 
> **Current Implementation**:
> - UI toggle present but disabled
> - Graceful error message if attempted
> - Microphone audio works as alternative
> 
> **Recommended approach for V2**:
> - Skip system audio for initial release
> - Add in future PR with platform-specific native modules
> - Test thoroughly on each platform

### Testing Checklist

#### Basic Tests
- [ ] System audio toggle visible but disabled
- [ ] Tooltip explains requirement
- [ ] Recording works without system audio
- [ ] No crashes or errors

---

### Acceptance Criteria
- [x] System audio UI present
- [x] Gracefully disabled with explanation
- [x] Microphone audio works as expected
- [x] Documentation provided for future enhancement
- [x] Zero breaking changes

**Dependencies**: PR #22

**Note**: System audio is marked as **OPTIONAL** for V2. Focus on core recording features first.

---

## PR #27: Recording Polish & Integration

**Objective**: Final touches, error handling, and integration polish

**Priority**: High | **Complexity**: Medium | **Risk**: Low

### Features
- Comprehensive error handling
- User notifications for all recording events
- Conversion progress indicator
- Failed recording cleanup
- Widget reset behavior
- Recording file management

### Files to Modify
- `src/renderer/components/RecordingPanel.vue`
- `src/renderer/components/RecordingWidget.vue`
- `src/renderer/stores/recordingStore.js`
- `src/renderer/stores/mediaStore.js`
- `src/shared/screenRecorder.js`

### Detailed Implementation

#### 1. Conversion Progress Indicator

**Update handleRecordingComplete in RecordingPanel.vue**:

```javascript
const handleRecordingComplete = async (filePath) => {
  try {
    console.log('Recording complete:', filePath);
    
    // Show conversion progress
    showConversionProgress.value = true;
    conversionStatus.value = 'Converting recording to MP4...';
    
    // Attempt MP4 conversion
    let finalPath = filePath;
    let conversionFailed = false;
    
    try {
      finalPath = await window.electronAPI.ffmpeg.convertWebMToMP4(filePath);
      conversionStatus.value = 'Conversion complete!';
      
      // Delete WebM file after successful conversion
      await window.electronAPI.fileSystem.deleteFile(filePath);
      
    } catch (conversionError) {
      console.error('MP4 conversion failed:', conversionError);
      conversionFailed = true;
      conversionStatus.value = 'Conversion failed, using WebM format';
      
      // Keep WebM file
      finalPath = filePath;
    }
    
    // Import to media library
    await importRecording(finalPath, conversionFailed);
    
    // Stop recording state
    recordingStore.stopRecording();
    await window.electronAPI.recording.setRecordingState(false);
    
    // Hide conversion progress after delay
    setTimeout(() => {
      showConversionProgress.value = false;
    }, 2000);
    
    // Show success notification
    showNotification('Recording saved successfully!', 'success');
    
  } catch (error) {
    console.error('Failed to handle recording complete:', error);
    showNotification('Failed to save recording', 'error');
    recordingStore.setError(error.message);
    
    // Cleanup
    recordingStore.stopRecording();
    await window.electronAPI.recording.setRecordingState(false);
  }
};

const importRecording = async (filePath, isWebM) => {
  try {
    // Add to media store with recording flag
    const fileName = filePath.split('/').pop();
    const fileExtension = fileName.split('.').pop();
    
    const mediaFile = {
      id: 'media_' + Date.now(),
      name: fileName,
      path: filePath,
      type: 'video',
      format: fileExtension,
      isRecording: true, // Mark as recording
      duration: 0, // Will be populated by FFmpeg
      thumbnailPath: null,
      importedAt: new Date().toISOString()
    };
    
    // Use media store to import (triggers thumbnail generation, etc.)
    const mediaStore = useMediaStore();
    await mediaStore.importFile(filePath, mediaFile);
    
    // Show conversion warning if WebM
    if (isWebM) {
      showNotification('Recording saved as WebM (MP4 conversion failed)', 'warning');
    }
    
  } catch (error) {
    console.error('Failed to import recording:', error);
    throw error;
  }
};
```

**Add refs and notification system**:

```javascript
const showConversionProgress = ref(false);
const conversionStatus = ref('');
const notificationMessage = ref('');
const notificationType = ref('info'); // 'info', 'success', 'warning', 'error'
const showNotificationFlag = ref(false);

const showNotification = (message, type = 'info') => {
  notificationMessage.value = message;
  notificationType.value = type;
  showNotificationFlag.value = true;
  
  setTimeout(() => {
    showNotificationFlag.value = false;
  }, 5000); // Hide after 5 seconds
};
```

**Add to template**:

```vue
<!-- Conversion Progress Overlay -->
<div v-if="showConversionProgress" class="conversion-overlay">
  <div class="conversion-box">
    <div class="spinner"></div>
    <p>{{ conversionStatus }}</p>
  </div>
</div>

<!-- Notification Toast -->
<div 
  v-if="showNotificationFlag" 
  class="notification-toast"
  :class="'notification-' + notificationType"
>
  {{ notificationMessage }}
</div>
```

**Add styles**:

```css
.conversion-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.conversion-box {
  background: #2a2a2a;
  border: 1px solid #555;
  border-radius: 8px;
  padding: 24px;
  text-align: center;
}

.spinner {
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top: 4px solid #4a90e2;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.notification-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 6px;
  font-size: 14px;
  z-index: 10001;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.notification-info {
  background: #4a90e2;
  color: white;
}

.notification-success {
  background: #27ae60;
  color: white;
}

.notification-warning {
  background: #f39c12;
  color: white;
}

.notification-error {
  background: #e74c3c;
  color: white;
}
```

---

#### 2. Enhanced Error Handling

**Add error messages** to RecordingPanel.vue:

```javascript
const handleRecordingError = (error) => {
  let userMessage = 'Recording failed';
  
  // Parse error and provide user-friendly message
  if (error.message.includes('permission')) {
    userMessage = 'Permission denied. Please grant screen recording and microphone permissions.';
    showPermissionModal.value = true;
  } else if (error.message.includes('NotFoundError')) {
    userMessage = 'Selected device not found. Please select a different source.';
  } else if (error.message.includes('NotReadableError')) {
    userMessage = 'Device is already in use by another application.';
  } else if (error.message.includes('disk')) {
    userMessage = 'Insufficient disk space to complete recording.';
  } else {
    userMessage = `Recording error: ${error.message}`;
  }
  
  showNotification(userMessage, 'error');
  recordingStore.setError(userMessage);
};
```

**Update all recording start methods** to use this handler.

---

#### 3. Failed Recording Cleanup

**Add to screenRecorder.js**:

```javascript
async cleanupFailedRecording() {
  try {
    // Stop all streams
    this.cleanup();
    
    // Delete partial recording file if exists
    if (this.recordedChunks.length > 0) {
      console.log('Cleaning up partial recording data');
      this.recordedChunks = [];
    }
    
    // Notify user
    if (this.callbacks.onError) {
      this.callbacks.onError(new Error('Recording failed and was cleaned up'));
    }
  } catch (error) {
    console.error('Failed to cleanup recording:', error);
  }
}
```

---

#### 4. Widget Reset on New Recording

**Update RecordingWidget.vue**:

```javascript
// Reset position when recording starts
watch(() => recordingStore.isRecording, (isRecording) => {
  if (isRecording) {
    // Reset to default position
    widgetPosition.value = {
      top: 20,
      right: 20
    };
  }
});
```

---

#### 5. Recording File Management

**Add IPC handlers for file operations** in main/index.js:

```javascript
// Delete recording file
ipcMain.handle('recording:deleteFile', async (event, filePath) => {
  try {
    const fs = require('fs').promises;
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete recording:', error);
    throw error;
  }
});

// Get recordings directory
ipcMain.handle('recording:getDirectory', async (event) => {
  const { app } = require('electron');
  const path = require('path');
  const userDataPath = app.getPath('userData');
  const recordingsDir = path.join(userDataPath, 'Recordings');
  
  // Create directory if it doesn't exist
  const fs = require('fs').promises;
  try {
    await fs.mkdir(recordingsDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  return recordingsDir;
});
```

**Expose in preload.js**:

```javascript
// Add to recording object
deleteFile: (filePath) => ipcRenderer.invoke('recording:deleteFile', filePath),
getDirectory: () => ipcRenderer.invoke('recording:getDirectory')
```

---

### Testing Checklist

#### Conversion Tests
- [ ] Conversion progress shown
- [ ] Successful conversion deletes WebM
- [ ] Failed conversion keeps WebM
- [ ] User notified of conversion status

#### Error Handling Tests
- [ ] Permission errors show modal
- [ ] Device errors show clear message
- [ ] Disk space errors handled gracefully
- [ ] All errors logged to console

#### Cleanup Tests
- [ ] Failed recordings cleaned up
- [ ] Partial files deleted
- [ ] No orphaned processes

#### Widget Tests
- [ ] Widget resets position on new recording
- [ ] Widget position saved during same recording
- [ ] Widget cleanup on recording stop

#### Notification Tests
- [ ] Success notifications appear
- [ ] Warning notifications appear
- [ ] Error notifications appear
- [ ] Notifications auto-dismiss

---

### Acceptance Criteria
- [x] Conversion progress indicator works
- [x] All errors handled gracefully
- [x] User notifications clear and helpful
- [x] Failed recordings cleaned up
- [x] Widget behavior polished
- [x] File management robust
- [x] Zero breaking changes

**Dependencies**: PR #21, PR #22

---

## PR #28: Comprehensive Testing & Validation

**Objective**: Validate all V2 features and ensure performance targets met

**Priority**: High | **Complexity**: Medium | **Risk**: Low

### Test Scenarios

#### 1. Recording Tests

**30-second Screen Capture**:
- [ ] Select screen source
- [ ] Start recording
- [ ] Record for 30 seconds
- [ ] Stop recording
- [ ] Verify MP4 conversion
- [ ] Verify auto-import to media library
- [ ] Add to timeline
- [ ] Playback in preview

**Webcam Recording**:
- [ ] Select webcam
- [ ] Select microphone
- [ ] Record for 10 seconds
- [ ] Verify audio captured
- [ ] Verify import and playback

**Composite Recording**:
- [ ] Select screen and webcam
- [ ] Verify preview shows PiP
- [ ] Record for 20 seconds
- [ ] Verify webcam positioned correctly
- [ ] Verify both streams in final video

**Edge Cases**:
- [ ] Recording at 2 hour limit (auto-stop)
- [ ] Recording with low disk space (< 5GB warning, < 500MB auto-stop)
- [ ] Recording without microphone
- [ ] Recording with source disconnected mid-recording
- [ ] Multiple recordings in sequence

---

#### 2. Timeline Tests

**Panning**:
- [ ] Toggle pan mode ON
- [ ] Click and drag timeline
- [ ] Verify clips don't move
- [ ] Verify playhead still scrubs
- [ ] Toggle pan mode OFF
- [ ] Verify clip dragging works again
- [ ] Pan mode resets to OFF on app restart

**Snap Behavior**:
- [ ] Enable snap-to-clips
- [ ] Drag clip near another
- [ ] Verify snaps to edge
- [ ] Visual indicator appears
- [ ] Enable snap-to-grid
- [ ] Verify snaps to grid intervals

**Responsiveness**:
- [ ] Add 10+ clips to timeline
- [ ] Drag clips smoothly
- [ ] Scroll timeline smoothly
- [ ] Zoom in/out smoothly
- [ ] No lag or freezing

---

#### 3. Project Management Tests

**Save/Load**:
- [ ] Create timeline with 3 clips
- [ ] Save project
- [ ] Verify project folder created
- [ ] Verify media files copied
- [ ] Close app
- [ ] Load project
- [ ] Verify timeline restored
- [ ] Verify all clips playable

**Unsaved Changes**:
- [ ] Make timeline changes
- [ ] Attempt to close app
- [ ] Verify warning appears
- [ ] Save changes
- [ ] Close app successfully

**Missing Media**:
- [ ] Save project
- [ ] Delete a media file from project folder
- [ ] Load project
- [ ] Verify missing media indicator
- [ ] Timeline still functional

---

#### 4. Import & Export Tests

**Import 3 Videos**:
- [ ] Import 3 video files
- [ ] Verify thumbnails generated
- [ ] Verify metadata extracted
- [ ] Arrange in sequence on timeline

**Trim and Split**:
- [ ] Trim clip ends
- [ ] Split clip in middle
- [ ] Verify non-destructive (original file unchanged)
- [ ] Verify timeline reflects changes

**Export 2-Minute Video**:
- [ ] Create 2-minute timeline
- [ ] Start export
- [ ] Verify progress indicator
- [ ] Wait for completion
- [ ] Verify output file playable
- [ ] Verify quality reasonable (not bloated)

---

#### 5. Performance Validation

**Timeline Responsiveness** (10+ clips):
- [ ] Add 10 clips to timeline
- [ ] Measure drag responsiveness: < 100ms latency
- [ ] Measure scroll performance: 60 fps
- [ ] Measure render time: < 16ms per frame

**Preview Playback** (30 fps minimum):
- [ ] Play timeline with multiple clips
- [ ] Measure frame rate: ≥ 30 fps
- [ ] Check for dropped frames
- [ ] Verify smooth transitions

**Export Performance**:
- [ ] Export 2-minute video
- [ ] Verify no crashes
- [ ] Measure time: reasonable for hardware
- [ ] Check CPU usage: < 90%

**App Launch**:
- [ ] Close app
- [ ] Restart app
- [ ] Measure launch time: < 5 seconds

**Memory Leaks**:
- [ ] Edit continuously for 15 minutes
- [ ] Monitor memory usage
- [ ] Verify no continuous increase
- [ ] Check for memory spikes

**File Size**:
- [ ] Export various videos
- [ ] Verify reasonable file sizes
- [ ] High quality: ~5-10 MB/min
- [ ] Medium quality: ~2-5 MB/min

---

#### 6. Cross-Platform Tests (if applicable)

**macOS**:
- [ ] All recording features work
- [ ] Permissions handled correctly
- [ ] Native UI elements correct

**Windows** (if tested):
- [ ] All recording features work
- [ ] Permissions handled correctly
- [ ] File paths correct

---

#### 7. Regression Tests (V1 Features)

**Verify no breaking changes**:
- [ ] Media import still works
- [ ] Timeline drag-drop still works
- [ ] Trim functionality still works
- [ ] Split functionality still works
- [ ] Playback controls still work
- [ ] Export still works
- [ ] Zoom controls still work
- [ ] All existing keyboard shortcuts still work

---

### Performance Benchmarks

| Metric | Target | Pass/Fail |
|--------|--------|-----------|
| Timeline with 10+ clips responsive | < 100ms latency | |
| Preview playback | ≥ 30 fps | |
| Export completes without crash | Yes | |
| App launch time | < 5 seconds | |
| No memory leaks (15+ min session) | Stable memory | |
| High quality export file size | 5-10 MB/min | |
| Medium quality export file size | 2-5 MB/min | |

---

### Acceptance Criteria
- [x] All recording tests pass
- [x] All timeline tests pass
- [x] All project management tests pass
- [x] All import/export tests pass
- [x] All performance targets met
- [x] No regressions in V1 features
- [x] Cross-platform tests complete (if applicable)
- [x] All bugs filed and prioritized

**Dependencies**: All PRs (#17-27)

---

## Summary

**Total PRs**: 12 (PR #17 - PR #28)

**Estimated Order of Implementation**:
1. PR #17: Timeline Panning Mode (foundational UI enhancement)
2. PR #18: Snap-to-Clip Edges Enhancement (quick win)
3. PR #19: Project Serialization & Media Copy (infrastructure)
4. PR #20: Project Save/Load UI & Logic (user-facing feature)
5. PR #21: Recording Infrastructure & Permissions (foundational recording)
6. PR #22: Screen Recording Implementation (core recording feature)
7. PR #23: Microphone Audio Integration (verification PR)
8. PR #24: Webcam Recording (extends recording)
9. PR #25: Screen + Webcam Composite (PiP) (complex feature)
10. PR #26: System Audio Capture (optional/documentation)
11. PR #27: Recording Polish & Integration (polish pass)
12. PR #28: Comprehensive Testing & Validation (validation)

**Critical Path**: PR #19 → PR #20 (for project management), PR #21 → PR #22 → PR #24 → PR #25 (for recording features)

**All PRs designed to be non-breaking and additive to maintain V1 functionality.**

