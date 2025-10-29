<template>
  <div class="timeline-container">
    <div class="timeline-header">
      <canvas class="time-ruler" ref="timeRuler" :width="canvasWidth" height="30"></canvas>
      <div class="zoom-controls">
        <button @click="zoomOut">-</button>
        <span>{{ Math.round(timelineStore.zoomLevel * 100) }}%</span>
        <button @click="zoomIn">+</button>
        <button @click="zoomToFit">Fit</button>
        <GridSnapToggle :drag-drop-manager="dragDropManager" />
        <TimeDisplay />
      </div>
    </div>
    
    <div class="timeline-content" ref="timelineContent">
      <canvas 
        ref="timelineCanvas"
        :width="canvasWidth"
        :height="canvasHeight"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @wheel="handleWheel"
        @drop="handleDrop"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @mouseleave="handleMouseLeave"
      ></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useClipForgeTimelineStore } from '../stores/clipforge/timelineStore';
import { useAudioForgeTimelineStore } from '../stores/audioforge/timelineStore';
import { useClipForgeMediaStore } from '../stores/clipforge/mediaStore';
import { useAudioForgeMediaStore } from '../stores/audioforge/mediaStore';
import DragDropManager from '../../shared/dragDropManager';
import ClipSelectionManager from '../../shared/clipSelectionManager';
import GridSnapToggle from './GridSnapToggle.vue';
import ScrubManager from '../../shared/scrubManager';
import PlayheadRenderer from '../../shared/playheadRenderer';
import TimeDisplay from './TimeDisplay.vue';
import TrimManager from '../../shared/trimManager';
import TrimHandleRenderer from '../../shared/trimHandleRenderer';
import SplitManager from '../../shared/splitManager';

// Props
const props = defineProps({
  appMode: {
    type: String,
    required: true
  }
});

const timelineStore = props.appMode === 'clipforge' 
  ? useClipForgeTimelineStore() 
  : useAudioForgeTimelineStore();

const mediaStore = props.appMode === 'clipforge' 
  ? useClipForgeMediaStore() 
  : useAudioForgeMediaStore();
const timelineCanvas = ref(null);
const timeRuler = ref(null);
const timelineContent = ref(null);

const canvasWidth = computed(() => Math.max(800, timelineStore.timelineWidth));
const canvasHeight = computed(() => 200); // 100px per track

let ctx = null;
let timeRulerCtx = null;
let isDragging = false;
let dragStartX = 0;
let animationFrameId = null;
let dragDropManager = null;
let clipSelectionManager = null;
let scrubManager = null;
let playheadRenderer = null;
let trimManager = null;
let trimHandleRenderer = null;
let splitManager = null;

// Scrubbing state
const isScrubbing = ref(false);
const isOverPlayhead = ref(false);
const showTimeTooltip = ref(false);
const tooltipPosition = ref({ x: 0, y: 0 });

// Trim state
const currentTrimState = ref(null);

// Split state
const showSplitIndicator = ref(false);

// Pan mode state
const isPanning = ref(false);
const panStartX = ref(0);
const panStartScrollX = ref(0);

onMounted(() => {
  ctx = timelineCanvas.value.getContext('2d');
  timeRulerCtx = timeRuler.value.getContext('2d');
  
  // Initialize drag-drop and selection managers
  dragDropManager = new DragDropManager(timelineStore, timelineCanvas.value);
  clipSelectionManager = new ClipSelectionManager(timelineStore);
  
  // Initialize scrub and playhead managers
  scrubManager = new ScrubManager(timelineStore, null); // videoPlayerPool will be set later
  playheadRenderer = new PlayheadRenderer(timelineCanvas.value, timelineStore);
  
  // Initialize trim managers
  trimManager = new TrimManager(timelineStore, timelineCanvas.value);
  trimHandleRenderer = new TrimHandleRenderer(timelineStore);
  
  // Initialize split manager
  splitManager = new SplitManager(timelineStore, clipSelectionManager);
  
  // Expose split indicator control
  window.setSplitIndicator = (show) => {
    showSplitIndicator.value = show;
    timelineStore.markDirty();
  };
  
  // Set initial cursor based on pan mode
  timelineCanvas.value.style.cursor = timelineStore.panMode ? 'grab' : 'default';
  
  // Add keyboard event listeners
  document.addEventListener('keydown', handleKeyDown);
  
  startRenderLoop();
});

onUnmounted(() => {
  // Cleanup
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  
  // Remove keyboard event listeners
  document.removeEventListener('keydown', handleKeyDown);
  
  // Cleanup managers
  if (dragDropManager) {
    dragDropManager.clearDragState();
  }
});

const startRenderLoop = () => {
  const render = () => {
    if (timelineStore.isDirty) {
      renderTimeline();
      renderTimeRuler();
      timelineStore.clearDirty();
    }
    animationFrameId = requestAnimationFrame(render);
  };
  render();
};

const renderTimeline = () => {
  if (!ctx) return;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value);
  
  // Draw tracks
  timelineStore.tracks.forEach((track, index) => {
    const trackY = index * 100;
    
    // Track background
    ctx.fillStyle = index % 2 === 0 ? '#2a2a2a' : '#333333';
    ctx.fillRect(0, trackY, canvasWidth.value, 100);
    
    // Track border
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, trackY, canvasWidth.value, 100);
    
    // Track indicator (colored stripe on left)
    ctx.fillStyle = index === 0 ? '#4a90e2' : '#e24a90';
    ctx.fillRect(0, trackY, 5, 100);
    
    // Track label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.fillText(track.name, 15, trackY + 20);
    
    // Draw clips in this track
    track.clips.forEach(clip => {
      drawClip(clip, trackY);
      
      // Draw trim handles on all clips
      const isSelected = clipSelectionManager.isSelected(clip.id);
      const isHovered = currentTrimState.value?.clip?.id === clip.id;
      const isBeingTrimmed = trimManager.trimClip?.id === clip.id;
      
      // Show trim handles on all clips, but highlight based on state
      const hoveredEdge = currentTrimState.value?.edge;
      trimHandleRenderer.drawTrimHandles(ctx, clip, index, isHovered, hoveredEdge);
    });
  });
  
  // Draw playhead
  if (playheadRenderer) {
    playheadRenderer.draw(ctx);
  }
  
  // Draw ghost preview if dragging
  if (dragDropManager) {
    dragDropManager.drawGhostPreview(ctx);
  }
  
  // Draw time tooltip if scrubbing
  if (showTimeTooltip.value && isScrubbing.value) {
    playheadRenderer.drawTimeTooltip(
      ctx, 
      tooltipPosition.value.x, 
      tooltipPosition.value.y
    );
  }
  
  // Draw split indicator if showing
  if (showSplitIndicator.value && splitManager) {
    drawSplitIndicator(ctx);
  }
  
  // NEW: Draw snap indicator BEFORE ghost preview
  drawSnapIndicator(ctx);
};

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
  
  // Clip duration text
  ctx.fillStyle = '#ffffff';
  ctx.font = '10px Arial';
  ctx.fillText(
    formatDuration(clip.duration), 
    x + 5, 
    trackY + 95
  );
};


const renderTimeRuler = () => {
  if (!timeRulerCtx) return;
  
  const rulerWidth = canvasWidth.value;
  const rulerHeight = 30;
  
  timeRulerCtx.clearRect(0, 0, rulerWidth, rulerHeight);
  
  // Draw time markers
  const timeInterval = getTimeInterval();
  const startTime = Math.floor(timelineStore.scrollPosition / timelineStore.pixelsPerSecond);
  
  for (let time = startTime; time < timelineStore.timelineDuration; time += timeInterval) {
    const x = (time * timelineStore.pixelsPerSecond) - timelineStore.scrollPosition;
    if (x < 0) continue;
    if (x > rulerWidth) break;
    
    timeRulerCtx.strokeStyle = '#cccccc';
    timeRulerCtx.lineWidth = 1;
    timeRulerCtx.beginPath();
    timeRulerCtx.moveTo(x, 0);
    timeRulerCtx.lineTo(x, rulerHeight);
    timeRulerCtx.stroke();
    
    // Time label
    timeRulerCtx.fillStyle = '#ffffff';
    timeRulerCtx.font = '12px Arial';
    timeRulerCtx.fillText(formatTime(time), x + 2, 20);
  }
};

const getTimeInterval = () => {
  const pixelsPerSecond = timelineStore.pixelsPerSecond;
  if (pixelsPerSecond < 10) return 60; // 1 minute intervals
  if (pixelsPerSecond < 50) return 30; // 30 second intervals
  if (pixelsPerSecond < 100) return 10; // 10 second intervals
  return 5; // 5 second intervals
};

const formatTime = (seconds) => {
  // Validate input
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) {
    return '0:00';
  }
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatDuration = (seconds) => {
  // Validate input
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) {
    return '0.0s';
  }
  
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const drawSplitIndicator = (ctx) => {
  if (!splitManager) return;
  
  const playheadX = timelineStore.playheadPosition * timelineStore.pixelsPerSecond - timelineStore.scrollPosition;
  
  // Find clips at playhead
  const clips = splitManager.findClipsAtPlayhead(timelineStore.playheadPosition);
  
  if (clips.length === 0) return;
  
  ctx.save();
  
  clips.forEach(({ clip, trackId }) => {
    const trackIndex = timelineStore.tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return;
    
    const trackY = trackIndex * 100;
    const clipY = trackY + 5;
    const clipHeight = 90;
    
    // Draw split line
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.moveTo(playheadX, clipY);
    ctx.lineTo(playheadX, clipY + clipHeight);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw split icons (scissors)
    drawScissorsIcon(ctx, playheadX, clipY + clipHeight / 2);
  });
  
  ctx.restore();
};

const drawScissorsIcon = (ctx, x, y) => {
  ctx.save();
  ctx.fillStyle = '#ffff00';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  
  // Simple scissors representation
  // Top blade
  ctx.beginPath();
  ctx.arc(x - 5, y - 5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Bottom blade
  ctx.beginPath();
  ctx.arc(x - 5, y + 5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Handles
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 5);
  ctx.lineTo(x + 5, y);
  ctx.moveTo(x - 5, y + 5);
  ctx.lineTo(x + 5, y);
  ctx.stroke();
  
  ctx.restore();
};

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

const zoomIn = (mouseX = null) => {
  if (mouseX !== null) {
    // Zoom around mouse position
    const mouseTime = (mouseX + timelineStore.scrollPosition) / timelineStore.pixelsPerSecond;
    const newZoomLevel = Math.max(0.1, Math.min(10, timelineStore.zoomLevel * 1.2));
    
    if (newZoomLevel !== timelineStore.zoomLevel) {
      const newPixelsPerSecond = 100 * newZoomLevel;
      // Calculate ideal scroll position, but allow natural expansion from left edge
      const idealScrollPosition = mouseTime * newPixelsPerSecond - mouseX;
      const newScrollPosition = Math.max(0, idealScrollPosition);
      
      // Apply changes atomically
      timelineStore.setZoomAndScroll(newZoomLevel, newScrollPosition);
    }
  } else {
    // Zoom around playhead position
    const playheadTime = timelineStore.playheadPosition;
    
    // Validate playhead time
    if (isNaN(playheadTime) || playheadTime < 0) {
      console.warn('Invalid playhead position for zoom in:', playheadTime);
      return;
    }
    
    const newZoomLevel = Math.max(0.1, Math.min(10, timelineStore.zoomLevel * 1.2));
    
    if (Math.abs(newZoomLevel - timelineStore.zoomLevel) > 0.001) {
      const newPixelsPerSecond = 100 * newZoomLevel;
      const playheadPixelPosition = playheadTime * newPixelsPerSecond;
      const canvasCenter = canvasWidth.value / 2;
      const newScrollPosition = Math.max(0, playheadPixelPosition - canvasCenter);
      
      console.log('Zoom in around playhead:', {
        playheadTime,
        oldZoom: timelineStore.zoomLevel,
        newZoom: newZoomLevel,
        playheadPixelPosition,
        canvasCenter,
        oldScroll: timelineStore.scrollPosition,
        newScroll: newScrollPosition
      });
      
      // Apply changes atomically
      timelineStore.setZoomAndScroll(newZoomLevel, newScrollPosition);
    }
  }
};

const zoomOut = (mouseX = null) => {
  if (mouseX !== null) {
    // Zoom around mouse position
    const mouseTime = (mouseX + timelineStore.scrollPosition) / timelineStore.pixelsPerSecond;
    const newZoomLevel = Math.max(0.1, Math.min(10, timelineStore.zoomLevel / 1.2));
    
    if (newZoomLevel !== timelineStore.zoomLevel) {
      const newPixelsPerSecond = 100 * newZoomLevel;
      // Calculate ideal scroll position, but allow natural expansion from left edge
      const idealScrollPosition = mouseTime * newPixelsPerSecond - mouseX;
      const newScrollPosition = Math.max(0, idealScrollPosition);
      
      // Apply changes atomically
      timelineStore.setZoomAndScroll(newZoomLevel, newScrollPosition);
    }
  } else {
    // Zoom around playhead position
    const playheadTime = timelineStore.playheadPosition;
    
    // Validate playhead time
    if (isNaN(playheadTime) || playheadTime < 0) {
      console.warn('Invalid playhead position for zoom out:', playheadTime);
      return;
    }
    
    const newZoomLevel = Math.max(0.1, Math.min(10, timelineStore.zoomLevel / 1.2));
    
    if (Math.abs(newZoomLevel - timelineStore.zoomLevel) > 0.001) {
      const newPixelsPerSecond = 100 * newZoomLevel;
      const playheadPixelPosition = playheadTime * newPixelsPerSecond;
      const canvasCenter = canvasWidth.value / 2;
      const newScrollPosition = Math.max(0, playheadPixelPosition - canvasCenter);
      
      console.log('Zoom out around playhead:', {
        playheadTime,
        oldZoom: timelineStore.zoomLevel,
        newZoom: newZoomLevel,
        playheadPixelPosition,
        canvasCenter,
        oldScroll: timelineStore.scrollPosition,
        newScroll: newScrollPosition
      });
      
      // Apply changes atomically
      timelineStore.setZoomAndScroll(newZoomLevel, newScrollPosition);
    }
  }
};

const zoomToFit = () => {
  const containerWidth = timelineContent.value.clientWidth;
  const contentWidth = timelineStore.timelineDuration * 100; // base pixels per second
  const newZoom = Math.max(0.1, containerWidth / contentWidth);
  timelineStore.setZoomLevel(newZoom);
};

// Mouse event handlers
const handleMouseDown = (event) => {
  const rect = timelineCanvas.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  // NEW: Handle pan mode - Start panning
  if (timelineStore.panMode) {
    isPanning.value = true;
    panStartX.value = event.clientX;
    panStartScrollX.value = timelineStore.scrollPosition;
    timelineCanvas.value.style.cursor = 'grabbing';
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
    // Start trim operation
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
      // Select clip
      clipSelectionManager.selectClip(clickedClip.id, event.ctrlKey);
      
      // Start drag from timeline
      const trackId = Math.floor(y / 100) + 1;
      dragDropManager.startDragFromTimeline(clickedClip, trackId, event);
    } else {
      // Clear selection if clicking empty space
      clipSelectionManager.clearSelection();
      
      // Position playhead
      const time = (x + timelineStore.scrollPosition) / timelineStore.pixelsPerSecond;
      timelineStore.setPlayheadPosition(time);
    }
  } else {
    // In pan mode, just position playhead
    const time = (x + timelineStore.scrollPosition) / timelineStore.pixelsPerSecond;
    timelineStore.setPlayheadPosition(time);
  }
};

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
    timelineCanvas.value.style.cursor = 'grab';
    return;
  }
  
  // Update hover state for trim handles
  const selectedClipIds = clipSelectionManager.getSelectedClipIds();
  const hoverState = trimManager.checkHoverState(
    x, 
    y, 
    selectedClipIds.length > 0 ? selectedClipIds[0] : null
  );
  
  if (hoverState) {
    console.log('Trim hover detected:', hoverState);
    document.body.style.cursor = trimManager.getCursorForEdge(hoverState.edge);
    currentTrimState.value = hoverState;
    renderTimeline(); // Re-render to show hover state
  } else {
    if (!trimManager.trimming && !isScrubbing.value && !dragDropManager.dragState.isDragging) {
      // Reset cursor based on pan mode
      timelineCanvas.value.style.cursor = timelineStore.panMode ? 'grab' : 'default';
    }
    currentTrimState.value = null;
  }
  
  // Handle drag-drop operations
  if (dragDropManager) {
    dragDropManager.handleDragMove(event);
  }
  
  // Handle timeline scrolling
  if (isDragging && !dragDropManager?.dragState?.isDragging) {
    const deltaX = event.clientX - dragStartX;
    const newScrollPosition = timelineStore.scrollPosition - deltaX;
    timelineStore.setScrollPosition(Math.max(0, newScrollPosition));
    dragStartX = event.clientX;
  }
  
  // Update cursor based on position
  if (playheadRenderer) {
    if (playheadRenderer.isOverHandle(x, y) || playheadRenderer.isNearPlayhead(x, 5)) {
      document.body.style.cursor = 'grab';
      isOverPlayhead.value = true;
    } else {
      if (!isScrubbing.value) {
        document.body.style.cursor = 'default';
      }
      isOverPlayhead.value = false;
    }
  }
  
  // Show time tooltip when hovering over timeline
  if (y < timelineCanvas.value.height) {
    tooltipPosition.value = { x, y };
  }
};

const handleMouseUp = (event) => {
  // NEW: Handle pan end
  if (isPanning.value) {
    isPanning.value = false;
    timelineCanvas.value.style.cursor = timelineStore.panMode ? 'grab' : 'default';
    event.preventDefault();
    return;
  }
  
  // Handle trim end
  if (trimManager.trimming) {
    trimManager.endTrim();
    event.preventDefault();
    return;
  }
  
  // Handle scrubbing end
  if (isScrubbing.value) {
    scrubManager.endScrub();
    isScrubbing.value = false;
    showTimeTooltip.value = false;
    document.body.style.cursor = 'default';
    event.preventDefault();
  }
  
  // Handle drag-drop operations
  if (dragDropManager) {
    dragDropManager.handleDragEnd(event);
  }
  
  isDragging = false;
};

const handleWheel = (event) => {
  event.preventDefault();
  if (event.ctrlKey) {
    // Zoom around playhead position
    const playheadTime = timelineStore.playheadPosition;
    
    // Validate playhead time
    if (isNaN(playheadTime) || playheadTime < 0) {
      console.warn('Invalid playhead position for zoom:', playheadTime);
      return;
    }
    
    // Determine zoom direction and factor
    const zoomFactor = event.deltaY < 0 ? 1.2 : 1 / 1.2;
    const newZoomLevel = Math.max(0.1, Math.min(10, timelineStore.zoomLevel * zoomFactor));
    
    // Only proceed if zoom level actually changed
    if (Math.abs(newZoomLevel - timelineStore.zoomLevel) > 0.001) {
      // Calculate new pixels per second
      const newPixelsPerSecond = 100 * newZoomLevel;
      
      // Calculate the playhead's pixel position on the canvas
      const playheadPixelPosition = playheadTime * newPixelsPerSecond;
      
      // Calculate the canvas center position
      const canvasCenter = canvasWidth.value / 2;
      
      // Calculate new scroll position to keep playhead at canvas center
      const newScrollPosition = Math.max(0, playheadPixelPosition - canvasCenter);
      
      console.log('Zoom around playhead:', {
        playheadTime,
        oldZoom: timelineStore.zoomLevel,
        newZoom: newZoomLevel,
        playheadPixelPosition,
        canvasCenter,
        oldScroll: timelineStore.scrollPosition,
        newScroll: newScrollPosition
      });
      
      // Apply changes atomically
      timelineStore.setZoomAndScroll(newZoomLevel, newScrollPosition);
    }
  } else {
    // Horizontal scroll
    const newScrollPosition = timelineStore.scrollPosition + event.deltaY;
    timelineStore.setScrollPosition(Math.max(0, newScrollPosition));
  }
};

// Drop zone handlers
const handleDrop = (event) => {
  event.preventDefault();
  
  try {
    const data = JSON.parse(event.dataTransfer.getData('application/json'));
    if (data.type === 'media-clip') {
      const rect = timelineCanvas.value.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      const targetTrackId = Math.floor(y / 100) + 1;
      const targetTime = (x + timelineStore.scrollPosition) / timelineStore.pixelsPerSecond;
      
      // Validate target time before adding clip
      if (isNaN(targetTime) || !isFinite(targetTime)) {
        console.error('Invalid target time calculated:', targetTime);
        return;
      }
      
      // Add clip to timeline
      timelineStore.addClipToTrack(`track-${targetTrackId}`, data.clip, targetTime);
    }
  } catch (error) {
    console.error('Error handling drop:', error);
  }
};

const handleDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
};

const handleDragLeave = (event) => {
  // Only handle if leaving the canvas
  if (!event.currentTarget.contains(event.relatedTarget)) {
    // Handle drag leave
  }
};

const handleMouseLeave = (event) => {
  if (isScrubbing.value) {
    scrubManager.endScrub();
    isScrubbing.value = false;
    showTimeTooltip.value = false;
  }
  // Reset cursor based on pan mode
  timelineCanvas.value.style.cursor = timelineStore.panMode ? 'grab' : 'default';
};

// Keyboard shortcuts
const handleKeyDown = (event) => {
  // Cancel trim with Escape
  if (event.key === 'Escape' && trimManager.trimming) {
    trimManager.cancelTrim();
    event.preventDefault();
    return;
  }
  
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (!event.target.matches('input, textarea')) {
      event.preventDefault();
      clipSelectionManager.deleteSelectedClips();
    }
  }
  
  // Split clips with 'S' key
  if (event.key.toLowerCase() === 's') {
    if (!event.target.matches('input, textarea')) {
      event.preventDefault();
      if (splitManager && splitManager.canSplitAtPlayhead()) {
        splitManager.splitAtPlayhead();
      }
    }
  }
  
  // Frame-by-frame navigation
  const frameTime = 1 / 30; // 30fps
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault();
      timelineStore.setPlayheadPosition(Math.max(
        0,
        timelineStore.playheadPosition - frameTime
      ));
      if (scrubManager) {
        scrubManager.updateVideoPreview(true);
      }
      break;
      
    case 'ArrowRight':
      event.preventDefault();
      timelineStore.setPlayheadPosition(Math.min(
        timelineStore.timelineDuration,
        timelineStore.playheadPosition + frameTime
      ));
      if (scrubManager) {
        scrubManager.updateVideoPreview(true);
      }
      break;
      
    case 'Home':
      event.preventDefault();
      timelineStore.setPlayheadPosition(0);
      if (scrubManager) {
        scrubManager.updateVideoPreview(true);
      }
      break;
      
    case 'End':
      event.preventDefault();
      timelineStore.setPlayheadPosition(timelineStore.timelineDuration);
      if (scrubManager) {
        scrubManager.updateVideoPreview(true);
      }
      break;
  }
};

const getClipAtPosition = (x, y) => {
  const trackIndex = Math.floor(y / 100);
  if (trackIndex < 0 || trackIndex >= timelineStore.tracks.length) return null;
  
  const track = timelineStore.tracks[trackIndex];
  const trackY = trackIndex * 100;
  
  if (y < trackY + 5 || y > trackY + 95) return null;
  
  for (const clip of track.clips) {
    const clipX = clip.startTime * timelineStore.pixelsPerSecond - timelineStore.scrollPosition;
    const clipWidth = clip.duration * timelineStore.pixelsPerSecond;
    
    if (x >= clipX && x <= clipX + clipWidth) {
      return clip;
    }
  }
  
  return null;
};

// Watch for timeline changes
watch(() => timelineStore.tracks, () => {
  timelineStore.markDirty();
}, { deep: true });

watch(() => timelineStore.playheadPosition, () => {
  timelineStore.markDirty();
});

watch(() => timelineStore.zoomLevel, () => {
  timelineStore.markDirty();
});

watch(() => timelineStore.scrollPosition, () => {
  timelineStore.markDirty();
});

watch(() => timelineStore.selectedClips, () => {
  timelineStore.markDirty();
}, { deep: true });

// Watch for pan mode changes to update cursor
watch(() => timelineStore.panMode, (newPanMode) => {
  if (timelineCanvas.value) {
    timelineCanvas.value.style.cursor = newPanMode ? 'grab' : 'default';
  }
});
</script>

<style lang="scss" scoped>
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

.timeline-container {
  display: flex;
  flex-direction: column;
  height: 200px;
  @include d3-window;
  padding: 2px;
}

.timeline-header {
  display: flex;
  height: 24px;
  @include d3-window;
  margin-bottom: 2px;
  padding: 2px;
}

.time-ruler {
  flex: 1;
  height: 20px;
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  display: block;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  @include d3-window;
  margin-left: 2px;
  
  button {
    @include d3-object;
    @include font;
    padding: 2px 6px;
    cursor: pointer;
    font-size: 11px;
    min-width: 20px;
    
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
  
  span {
    @include font-color('font-color');
    font-size: 11px;
    min-width: 40px;
    text-align: center;
  }
}

.timeline-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

canvas {
  display: block;
  cursor: crosshair;
}
</style>
