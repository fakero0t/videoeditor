import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { generateId } from '../../shared/utils/videoUtils';

export const useTimelineStore = (appContext = 'clipforge') => {
  return defineStore(`${appContext}-timeline`, () => {
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
  const panMode = ref(false);
  
  // Computed
  const pixelsPerSecond = computed(() => 100 * zoomLevel.value);
  const timelineWidth = computed(() => Math.max(timelineDuration.value * pixelsPerSecond.value, 2000));
  const totalHeight = computed(() => tracks.value.reduce((sum, track) => sum + track.height, 0));
  
  // Actions
  const addClipToTrack = (trackId, mediaClip, startTime) => {
    const track = tracks.value.find(t => t.id === trackId);
    if (!track) return null;
    
    // Validate required properties
    if (!mediaClip || !mediaClip.filePath || !mediaClip.fileName) {
      console.error('Invalid mediaClip: missing required properties');
      return null;
    }
    
    // Validate and sanitize duration
    const duration = parseFloat(mediaClip.duration);
    if (isNaN(duration) || duration <= 0) {
      console.error('Invalid clip duration:', mediaClip.duration);
      return null;
    }
    
    // Validate and sanitize dimensions with fallbacks
    const width = parseFloat(mediaClip.width) || 1920;
    const height = parseFloat(mediaClip.height) || 1080;
    
    // Validate startTime
    const validStartTime = Math.max(0, parseFloat(startTime) || 0);
    
    const timelineClip = {
      id: generateId(),
      trackId,
      mediaFileId: mediaClip.id,
      filePath: mediaClip.filePath,
      fileName: mediaClip.fileName,
      startTime: validStartTime,
      duration: duration,
      width: width,
      height: height,
      
      // Trim settings (non-destructive)
      trimStart: 0,
      trimEnd: duration,
      sourceDuration: duration,
      
      // Visual properties
      color: generateClipColor(track.clips.length)
    };
    
    track.clips.push(timelineClip);
    track.clips.sort((a, b) => a.startTime - b.startTime);
    updateTimelineDuration();
    markClipChanged();
    
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
    markClipChanged();
  };
  
  const updateClipPosition = (clipId, newStartTime) => {
    for (const track of tracks.value) {
      const clip = track.clips.find(c => c.id === clipId);
      if (clip) {
        clip.startTime = Math.max(0, newStartTime);
        track.clips.sort((a, b) => a.startTime - b.startTime);
        updateTimelineDuration();
        markClipChanged();
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
        markClipChanged();
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
        // Validate clip properties before calculation
        const startTime = parseFloat(clip.startTime);
        const duration = parseFloat(clip.duration);
        
        if (isNaN(startTime) || isNaN(duration) || duration <= 0) {
          console.warn('Invalid clip data detected:', { clipId: clip.id, startTime, duration });
          return; // Skip invalid clips
        }
        
        const clipEnd = startTime + duration;
        if (!isNaN(clipEnd) && clipEnd > 0) {
          maxEndTime = Math.max(maxEndTime, clipEnd);
        }
      });
    });
    
    // Validate final duration
    const finalDuration = maxEndTime + 10;
    if (isNaN(finalDuration) || finalDuration <= 0) {
      console.error('Invalid timeline duration calculated:', finalDuration);
      timelineDuration.value = 60; // Fallback to minimum
    } else {
      timelineDuration.value = finalDuration;
    }
  };
  
  const markDirty = () => {
    isDirty.value = true;
  };

  // NEW: Mark dirty specifically for clip operations (for unsaved changes)
  const markClipChanged = () => {
    isDirty.value = true;
    
    // Notify project store if it exists
    if (window.__projectStore_clipforge) {
      window.__projectStore_clipforge.markDirty();
    }
  };
  
  const clearDirty = () => {
    isDirty.value = false;
  };
  
  const setPanMode = (enabled) => {
    panMode.value = enabled;
    markDirty();
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
  
  const moveClipBetweenTracks = (clipId, fromTrackId, toTrackId, newStartTime) => {
    const fromTrack = tracks.value.find(t => t.id === fromTrackId);
    const toTrack = tracks.value.find(t => t.id === toTrackId);
    
    if (!fromTrack || !toTrack) return false;
    
    const clipIndex = fromTrack.clips.findIndex(c => c.id === clipId);
    if (clipIndex === -1) return false;
    
    const clip = fromTrack.clips.splice(clipIndex, 1)[0];
    clip.trackId = toTrackId;
    clip.startTime = Math.max(0, newStartTime);
    
    toTrack.clips.push(clip);
    toTrack.clips.sort((a, b) => a.startTime - b.startTime);
    updateTimelineDuration();
    markClipChanged();
    
    return true;
  };

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
  
  return {
    // State
    tracks,
    playheadPosition,
    zoomLevel,
    scrollPosition,
    timelineDuration,
    selectedClips,
    isDirty,
    panMode,
    
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
    updateTimelineDuration,
    markDirty,
    clearDirty,
    setPanMode,
    getClipById,
    getClipsAtTime,
    moveClipBetweenTracks,
    serialize,
    deserialize,
    markClipChanged
  };
  })();
};

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
