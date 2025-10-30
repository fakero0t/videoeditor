import { ref, reactive } from 'vue';

// Centralized playback state store
const isPlaying = ref(false);
const playbackSpeed = ref(1);
const isScrubbing = ref(false);
const isTimelinePlayback = ref(false);

// Callbacks for components to register their control methods
let previewWindowControls = null;
let timelineStore = null;

// Register preview window controls
export const registerPreviewControls = (controls) => {
  console.log('PlaybackStore: Registering preview window controls:', !!controls);
  previewWindowControls = controls;
};

// Unregister preview window controls
export const unregisterPreviewControls = () => {
  previewWindowControls = null;
};

// Register timeline store
export const registerTimelineStore = (store) => {
  console.log('PlaybackStore: Registering timeline store:', !!store);
  timelineStore = store;
};

// Unregister timeline store
export const unregisterTimelineStore = () => {
  timelineStore = null;
};

// Playback control methods
export const play = () => {
  console.log('PlaybackStore: play() called, previewWindowControls available:', !!previewWindowControls);
  
  if (!timelineStore) {
    console.warn('PlaybackStore: No timeline store registered');
    return;
  }
  
  // Check if there are any clips on the timeline
  const hasClips = timelineStore.tracks.some(track => track.clips.length > 0);
  if (!hasClips) {
    console.warn('PlaybackStore: No clips on timeline to play');
    return;
  }
  
  // Start timeline playback
  isTimelinePlayback.value = true;
  isPlaying.value = true;
  
  // Start the timeline playback loop
  startTimelinePlayback();
  
  console.log('PlaybackStore: Timeline playback started');
};

export const pause = () => {
  console.log('PlaybackStore: pause() called, previewWindowControls available:', !!previewWindowControls);
  
  // Stop timeline playback
  isTimelinePlayback.value = false;
  isPlaying.value = false;
  
  if (previewWindowControls) {
    previewWindowControls.pause();
    console.log('PlaybackStore: pause() executed, isPlaying set to false');
  } else {
    console.warn('PlaybackStore: No preview window controls registered');
  }
};

export const stop = () => {
  console.log('PlaybackStore: stop() called, previewWindowControls available:', !!previewWindowControls);
  
  // Stop timeline playback
  isTimelinePlayback.value = false;
  isPlaying.value = false;
  
  if (previewWindowControls) {
    previewWindowControls.stop();
    console.log('PlaybackStore: stop() executed, isPlaying set to false');
  } else {
    console.warn('PlaybackStore: No preview window controls registered');
  }
  
  // Reset playhead to beginning
  if (timelineStore) {
    timelineStore.setPlayheadPosition(0);
  }
};

export const setPlaybackSpeed = (speed) => {
  playbackSpeed.value = speed;
  if (previewWindowControls) {
    previewWindowControls.setPlaybackSpeed(speed);
  }
};

export const setScrubbing = (scrubbing) => {
  isScrubbing.value = scrubbing;
};

// Timeline playback loop
let playbackAnimationId = null;

const startTimelinePlayback = () => {
  if (playbackAnimationId) {
    cancelAnimationFrame(playbackAnimationId);
  }
  
  const playbackLoop = () => {
    if (!isTimelinePlayback.value || !timelineStore) {
      return;
    }
    
    // Advance playhead by frame time (30fps)
    const frameTime = 1 / 30;
    const newTime = timelineStore.playheadPosition + frameTime;
    
    // Check if we've reached the end of the timeline
    if (newTime >= timelineStore.timelineDuration) {
      // End of timeline reached
      isTimelinePlayback.value = false;
      isPlaying.value = false;
      timelineStore.setPlayheadPosition(timelineStore.timelineDuration);
      return;
    }
    
    // Update playhead position
    timelineStore.setPlayheadPosition(newTime);
    
    // Continue the loop
    playbackAnimationId = requestAnimationFrame(playbackLoop);
  };
  
  playbackLoop();
};

// Reactive state
export const playbackState = reactive({
  isPlaying,
  playbackSpeed,
  isScrubbing,
  isTimelinePlayback
});

// Export individual refs for direct access
export { isPlaying, playbackSpeed, isScrubbing, isTimelinePlayback };
