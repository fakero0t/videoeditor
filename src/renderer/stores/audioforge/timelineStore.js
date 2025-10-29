import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { generateId } from '../../../shared/utils/videoUtils';

export const useAudioForgeTimelineStore = defineStore('audioforge-timeline', () => {
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
      if (!track) return;
      
      const clip = {
        id: generateId(),
        mediaFileId: mediaClip.id,
        filePath: mediaClip.filePath,
        startTime: startTime,
        duration: mediaClip.duration,
        endTime: startTime + mediaClip.duration,
        trackId: trackId,
        name: mediaClip.fileName,
        trimStart: 0,
        trimEnd: mediaClip.duration
      };
      
      track.clips.push(clip);
      isDirty.value = !isDirty.value; // Trigger re-render
    };
    
    const removeClip = (clipId) => {
      tracks.value.forEach(track => {
        const index = track.clips.findIndex(clip => clip.id === clipId);
        if (index > -1) {
          track.clips.splice(index, 1);
          isDirty.value = !isDirty.value; // Trigger re-render
        }
      });
    };
    
    const updateClipPosition = (clipId, newStartTime) => {
      tracks.value.forEach(track => {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip) {
          clip.startTime = newStartTime;
          clip.endTime = newStartTime + clip.duration;
          isDirty.value = !isDirty.value; // Trigger re-render
        }
      });
    };
    
    const updateClipDuration = (clipId, newDuration) => {
      tracks.value.forEach(track => {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip) {
          clip.duration = newDuration;
          clip.endTime = clip.startTime + newDuration;
          isDirty.value = !isDirty.value; // Trigger re-render
        }
      });
    };
    
    const splitClip = (clipId, splitTime) => {
      tracks.value.forEach(track => {
        const clipIndex = track.clips.findIndex(c => c.id === clipId);
        if (clipIndex > -1) {
          const clip = track.clips[clipIndex];
          const relativeSplitTime = splitTime - clip.startTime;
          
          if (relativeSplitTime > 0 && relativeSplitTime < clip.duration) {
            // Create second clip
            const secondClip = {
              ...clip,
              id: generateId(),
              startTime: splitTime,
              duration: clip.duration - relativeSplitTime,
              endTime: clip.endTime,
              trimStart: clip.trimStart + relativeSplitTime
            };
            
            // Update first clip
            clip.duration = relativeSplitTime;
            clip.endTime = splitTime;
            clip.trimEnd = clip.trimStart + relativeSplitTime;
            
            // Insert second clip after first
            track.clips.splice(clipIndex + 1, 0, secondClip);
            isDirty.value = !isDirty.value; // Trigger re-render
          }
        }
      });
    };
    
    const setPlayheadPosition = (position) => {
      playheadPosition.value = Math.max(0, Math.min(position, timelineDuration.value));
    };
    
    const setZoomLevel = (level) => {
      zoomLevel.value = Math.max(0.1, Math.min(level, 10));
    };
    
    const setScrollPosition = (position) => {
      scrollPosition.value = Math.max(0, position);
    };
    
    const setTimelineDuration = (duration) => {
      timelineDuration.value = Math.max(60, duration);
    };
    
    const selectClip = (clipId, addToSelection = false) => {
      if (addToSelection) {
        if (!selectedClips.value.includes(clipId)) {
          selectedClips.value.push(clipId);
        }
      } else {
        selectedClips.value = [clipId];
      }
    };
    
    const deselectClip = (clipId) => {
      const index = selectedClips.value.indexOf(clipId);
      if (index > -1) {
        selectedClips.value.splice(index, 1);
      }
    };
    
    const clearSelection = () => {
      selectedClips.value = [];
    };
    
    const isSelected = (clipId) => {
      return selectedClips.value.includes(clipId);
    };
    
    const setPanMode = (enabled) => {
      panMode.value = enabled;
    };
    
    const addTrack = () => {
      const trackNumber = tracks.value.length + 1;
      const newTrack = {
        id: `track-${trackNumber}`,
        name: `Track ${trackNumber}`,
        clips: [],
        height: 100
      };
      tracks.value.push(newTrack);
      isDirty.value = !isDirty.value; // Trigger re-render
    };
    
    const removeTrack = (trackId) => {
      if (tracks.value.length <= 1) return; // Keep at least one track
      
      const index = tracks.value.findIndex(t => t.id === trackId);
      if (index > -1) {
        tracks.value.splice(index, 1);
        isDirty.value = !isDirty.value; // Trigger re-render
      }
    };
    
    const updateTrackHeight = (trackId, height) => {
      const track = tracks.value.find(t => t.id === trackId);
      if (track) {
        track.height = Math.max(50, Math.min(height, 200));
        isDirty.value = !isDirty.value; // Trigger re-render
      }
    };
    
    const updateTrackName = (trackId, name) => {
      const track = tracks.value.find(t => t.id === trackId);
      if (track) {
        track.name = name;
        isDirty.value = !isDirty.value; // Trigger re-render
      }
    };
    
    const clearDirty = () => {
      isDirty.value = false;
    };
    
    const markDirty = () => {
      isDirty.value = !isDirty.value; // Toggle to trigger re-render
    };
    
    const getClipById = (clipId) => {
      for (const track of tracks.value) {
        const clip = track.clips.find(c => c.id === clipId);
        if (clip) return clip;
      }
      return null;
    };
    
    // Serialize for project save
    const serialize = () => {
      return {
        tracks: tracks.value,
        playheadPosition: playheadPosition.value,
        zoomLevel: zoomLevel.value,
        scrollPosition: scrollPosition.value,
        timelineDuration: timelineDuration.value,
        selectedClips: selectedClips.value,
        panMode: panMode.value
      };
    };
    
    // Deserialize from project load
    const deserialize = (data) => {
      if (data.tracks) tracks.value = data.tracks;
      if (data.playheadPosition !== undefined) playheadPosition.value = data.playheadPosition;
      if (data.zoomLevel !== undefined) zoomLevel.value = data.zoomLevel;
      if (data.scrollPosition !== undefined) scrollPosition.value = data.scrollPosition;
      if (data.timelineDuration !== undefined) timelineDuration.value = data.timelineDuration;
      if (data.selectedClips) selectedClips.value = data.selectedClips;
      if (data.panMode !== undefined) panMode.value = data.panMode;
      isDirty.value = !isDirty.value; // Trigger re-render
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
      splitClip,
      setPlayheadPosition,
      setZoomLevel,
      setScrollPosition,
      setTimelineDuration,
      selectClip,
      deselectClip,
      clearSelection,
      isSelected,
      setPanMode,
      addTrack,
      removeTrack,
      updateTrackHeight,
      updateTrackName,
      clearDirty,
      markDirty,
      getClipById,
      serialize,
      deserialize
    };
});
