/**
 * MultiTrackCompositor
 * Handles compositing multiple video tracks for preview
 * 
 * This class enhances the preview window to show overlays from multiple tracks
 */

class MultiTrackCompositor {
  constructor() {
    this.videoElements = new Map();
  }

  /**
   * Get all active clips at a specific time across all tracks
   * @param {Array} tracks - Timeline tracks
   * @param {Number} time - Current playhead time
   * @returns {Array} Array of active clips with track info
   */
  getActiveClipsAtTime(tracks, time) {
    console.log('[Compositor] getActiveClipsAtTime called:', { time, trackCount: tracks.length });
    const activeClips = [];
    
    tracks.forEach(track => {
      console.log('[Compositor] Checking track:', track.id, 'clips:', track.clips.length);
      const clip = track.clips.find(c => {
        const isInRange = c.startTime <= time && c.startTime + c.duration >= time;
        console.log('[Compositor] Clip check:', {
          clipId: c.id,
          startTime: c.startTime,
          duration: c.duration,
          endTime: c.startTime + c.duration,
          playheadTime: time,
          isInRange
        });
        return isInRange;
      });
      
      if (clip) {
        console.log('[Compositor] Found active clip:', clip.id);
        activeClips.push({
          clip,
          trackId: track.id,
          trackName: track.name,
          trackIndex: tracks.findIndex(t => t.id === track.id)
        });
      }
    });
    
    console.log('[Compositor] Active clips found:', activeClips.length);
    // Sort by track index (lower tracks first, higher tracks overlay on top)
    return activeClips.sort((a, b) => a.trackIndex - b.trackIndex);
  }

  /**
   * Get the primary (foreground) clip to display
   * Priority: Topmost track (lowest index) > Lower tracks
   * @param {Array} activeClips - Array of active clips
   * @returns {Object} The clip to display in preview
   */
  getPrimaryClip(activeClips) {
    if (activeClips.length === 0) return null;
    
    // Return the topmost track's clip (first in sorted array, lowest track index)
    return activeClips[0].clip;
  }

  /**
   * Check if multiple tracks are active (for future PiP overlay)
   * @param {Array} activeClips - Array of active clips
   * @returns {Boolean} True if multiple tracks have clips at current time
   */
  hasMultipleActiveTracks(activeClips) {
    return activeClips.length > 1;
  }

  /**
   * Get information about the current composite state
   * @param {Array} tracks - Timeline tracks
   * @param {Number} time - Current playhead time
   * @returns {Object} Composite state information
   */
  getCompositeInfo(tracks, time) {
    const activeClips = this.getActiveClipsAtTime(tracks, time);
    const primaryClip = this.getPrimaryClip(activeClips);
    const hasMultipleTracks = this.hasMultipleActiveTracks(activeClips);
    
    return {
      activeClips,
      primaryClip,
      hasMultipleTracks,
      trackCount: activeClips.length
    };
  }

  /**
   * Setup video element for a clip (for future canvas-based compositing)
   * @param {Object} clip - Clip object
   * @returns {HTMLVideoElement} Video element
   */
  setupVideoElement(clip) {
    if (this.videoElements.has(clip.id)) {
      return this.videoElements.get(clip.id);
    }
    
    const video = document.createElement('video');
    video.src = clip.filePath;
    video.muted = false; // Enable audio for playback
    video.volume = 1.0; // Set full volume
    video.preload = 'metadata';
    video.style.display = 'none';
    document.body.appendChild(video);
    
    this.videoElements.set(clip.id, video);
    return video;
  }

  /**
   * Cleanup video elements
   */
  cleanup() {
    this.videoElements.forEach(video => {
      video.pause();
      video.src = '';
      video.remove();
    });
    this.videoElements.clear();
  }
}

export default MultiTrackCompositor;
