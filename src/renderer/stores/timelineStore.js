import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { generateId } from '../../shared/utils/videoUtils';

export const useTimelineStore = defineStore('timeline', () => {
  // State
  const tracks = ref([
    { id: 'track-1', name: 'Track 1', clips: [], height: 100 },
    { id: 'track-2', name: 'Track 2', clips: [], height: 100 }
  ]);
  
  const playheadPosition = ref(0); // in seconds
  const zoomLevel = ref(1); // 1 = base scale (100px per second)
  const scrollPosition = ref(0); // horizontal scroll in pixels
  const timelineDuration = ref(60); // minimum 60 seconds
  const selectedClips = ref([]);
  const isDirty = ref(true); // Trigger re-render
  
  // Computed
  const pixelsPerSecond = computed(() => 100 * zoomLevel.value);
  const timelineWidth = computed(() => Math.max(timelineDuration.value * pixelsPerSecond.value, 2000));
  const totalHeight = computed(() => tracks.value.reduce((sum, track) => sum + track.height, 0));
  
  // Actions
  const addClipToTrack = (trackId, mediaClip, startTime) => {
    const track = tracks.value.find(t => t.id === trackId);
    if (!track) return null;
    
    const timelineClip = {
      id: generateId(),
      trackId,
      mediaFileId: mediaClip.id,
      filePath: mediaClip.filePath,
      fileName: mediaClip.fileName,
      startTime,
      duration: mediaClip.duration,
      width: mediaClip.width,
      height: mediaClip.height,
      
      // Trim settings (non-destructive)
      trimStart: 0,
      trimEnd: mediaClip.duration,
      sourceDuration: mediaClip.duration,
      
      // Visual properties
      color: generateClipColor(track.clips.length)
    };
    
    track.clips.push(timelineClip);
    track.clips.sort((a, b) => a.startTime - b.startTime);
    updateTimelineDuration();
    markDirty();
    
    return timelineClip.id;
  };
  
  const removeClip = (clipId) => {
    tracks.value.forEach(track => {
      const index = track.clips.findIndex(c => c.id === clipId);
      if (index > -1) {
        track.clips.splice(index, 1);
      }
    });
    
    // Remove from selection if selected
    const selIndex = selectedClips.value.indexOf(clipId);
    if (selIndex > -1) {
      selectedClips.value.splice(selIndex, 1);
    }
    
    updateTimelineDuration();
    markDirty();
  };
  
  const updateClipPosition = (clipId, newStartTime) => {
    for (const track of tracks.value) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) {
        clip.startTime = Math.max(0, newStartTime);
        track.clips.sort((a, b) => a.startTime - b.startTime);
        updateTimelineDuration();
        markDirty();
        return true;
      }
    }
    return false;
  };
  
  const updateClipDuration = (clipId, newDuration) => {
    for (const track of tracks.value) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) {
        clip.duration = Math.max(0.1, newDuration);
        updateTimelineDuration();
        markDirty();
        return true;
      }
    }
    return false;
  };
  
  const selectClip = (clipId, multiSelect = false) => {
    if (multiSelect) {
      const index = selectedClips.value.indexOf(clipId);
      if (index > -1) {
        selectedClips.value.splice(index, 1);
      } else {
        selectedClips.value.push(clipId);
      }
    } else {
      selectedClips.value = [clipId];
    }
    markDirty();
  };
  
  const clearSelection = () => {
    selectedClips.value = [];
    markDirty();
  };
  
  const setPlayheadPosition = (position) => {
    playheadPosition.value = Math.max(0, position);
    markDirty();
  };
  
  const setZoomLevel = (level) => {
    zoomLevel.value = Math.max(0.1, Math.min(10, level));
    markDirty();
  };
  
  const setScrollPosition = (position) => {
    scrollPosition.value = Math.max(0, position);
    markDirty();
  };
  
  const updateTimelineDuration = () => {
    let maxEndTime = 60; // Minimum 60 seconds
    
    tracks.value.forEach(track => {
      track.clips.forEach(clip => {
        const clipEnd = clip.startTime + clip.duration;
        maxEndTime = Math.max(maxEndTime, clipEnd);
      });
    });
    
    // Add 10 second buffer
    timelineDuration.value = maxEndTime + 10;
  };
  
  const markDirty = () => {
    isDirty.value = true;
  };
  
  const clearDirty = () => {
    isDirty.value = false;
  };
  
  const getClipById = (clipId) => {
    for (const track of tracks.value) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) return clip;
    }
    return null;
  };
  
  const getClipsAtTime = (time) => {
    const clips = [];
    tracks.value.forEach(track => {
      track.clips.forEach(clip => {
        if (clip.startTime <= time && clip.startTime + clip.duration >= time) {
          clips.push(clip);
        }
      });
    });
    return clips;
  };
  
  return {
    // State
    tracks,
    playheadPosition,
    zoomLevel,
    scrollPosition,
    timelineDuration,
    selectedClips,
    isDirty,
    
    // Computed
    pixelsPerSecond,
    timelineWidth,
    totalHeight,
    
    // Actions
    addClipToTrack,
    removeClip,
    updateClipPosition,
    updateClipDuration,
    selectClip,
    clearSelection,
    setPlayheadPosition,
    setZoomLevel,
    setScrollPosition,
    markDirty,
    clearDirty,
    getClipById,
    getClipsAtTime
  };
});

// Helper function to generate clip colors
function generateClipColor(index) {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // orange
    '#ef4444', // red
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#f97316', // orange-red
    '#14b8a6'  // teal
  ];
  return colors[index % colors.length];
}
