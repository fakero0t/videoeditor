class ScrubManager {
  constructor(timelineStore, videoPlayerPool) {
    this.timelineStore = timelineStore;
    this.videoPlayerPool = videoPlayerPool;
    
    this.scrubbing = false;
    this.scrubStartTime = 0;
    this.lastScrubTime = 0;
    this.scrubVelocity = 0;
    this.animationFrameId = null;
    
    // Performance settings
    this.minFrameInterval = 33; // ~30fps minimum
    this.velocityThreshold = 2.0; // seconds/second - above this, skip frames
    this.lastVideoUpdateTime = 0;
    this.videoUpdateThrottle = 50; // ms between video.currentTime updates
  }

  // Start scrubbing
  startScrub(initialTime) {
    this.scrubbing = true;
    this.scrubStartTime = initialTime;
    this.lastScrubTime = initialTime;
    this.scrubVelocity = 0;
    this.lastVideoUpdateTime = performance.now();
    
    // Start animation loop for smooth playhead updates
    this.startScrubAnimation();
  }

  // Update scrub position
  updateScrub(newTime) {
    if (!this.scrubbing) return;
    
    // Calculate velocity (seconds per second)
    const deltaTime = newTime - this.lastScrubTime;
    const deltaRealTime = 16.67 / 1000; // Approximate frame time
    this.scrubVelocity = Math.abs(deltaTime / deltaRealTime);
    
    // Update timeline playhead position
    this.timelineStore.setPlayheadPosition(Math.max(
      0,
      Math.min(newTime, this.timelineStore.timelineDuration)
    ));
    
    this.lastScrubTime = newTime;
    
    // Update video preview (throttled)
    this.updateVideoPreview();
  }

  // End scrubbing
  endScrub() {
    this.scrubbing = false;
    this.scrubVelocity = 0;
    
    // Cancel animation loop
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Final video update
    this.updateVideoPreview(true);
  }

  // Smooth animation loop using requestAnimationFrame
  startScrubAnimation() {
    const animate = () => {
      if (!this.scrubbing) return;
      
      // Render timeline (playhead will be drawn)
      this.timelineStore.markDirty();
      
      // Continue loop
      this.animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
  }

  // Update video preview with frame skipping logic
  updateVideoPreview(force = false) {
    const now = performance.now();
    const timeSinceLastUpdate = now - this.lastVideoUpdateTime;
    
    // Throttle updates based on scrub velocity
    if (!force && timeSinceLastUpdate < this.videoUpdateThrottle) {
      return;
    }
    
    // Determine if we should skip frames
    const shouldSkipFrames = this.scrubVelocity > this.velocityThreshold;
    
    if (shouldSkipFrames && !force) {
      // Only update every N frames when scrubbing fast
      if (timeSinceLastUpdate < this.videoUpdateThrottle * 2) {
        return;
      }
    }
    
    this.lastVideoUpdateTime = now;
    
    // Find clip at current playhead position
    const currentClip = this.getCurrentClip();
    
    if (currentClip) {
      this.seekToClipPosition(currentClip);
    }
  }

  // Get clip at current playhead position
  getCurrentClip() {
    const playheadTime = this.timelineStore.playheadPosition;
    
    // Find the clip (prioritize higher track numbers for overlays)
    let activeClip = null;
    let highestTrackId = -1;
    
    this.timelineStore.tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (playheadTime >= clip.startTime && playheadTime < (clip.startTime + clip.duration)) {
          if (track.id > highestTrackId) {
            activeClip = { ...clip, trackId: track.id };
            highestTrackId = track.id;
          }
        }
      });
    });
    
    return activeClip;
  }

  // Seek video to specific position within clip
  seekToClipPosition(clip) {
    if (!this.videoPlayerPool) return;
    
    const video = this.videoPlayerPool.getPlayer(clip.id, clip.filePath);
    if (!video) return;
    
    // Calculate relative time within this clip
    const relativeTime = this.timelineStore.playheadPosition - clip.startTime;
    
    // Account for trim offset if clip is trimmed
    const sourceTime = (clip.trimStart || 0) + relativeTime;
    
    // Constrain to clip boundaries
    const constrainedTime = Math.max(
      clip.trimStart || 0,
      Math.min(sourceTime, clip.trimEnd || clip.duration)
    );
    
    // Only update if difference is significant (avoid unnecessary seeks)
    if (Math.abs(video.currentTime - constrainedTime) > 0.1) {
      video.currentTime = constrainedTime;
    }
  }

  // Click to position playhead
  clickToPosition(clickX, canvasRect, pixelsPerSecond) {
    const relativeX = clickX - canvasRect.left;
    const newTime = relativeX / pixelsPerSecond;
    
    // Constrain to timeline bounds
    const constrainedTime = Math.max(
      0,
      Math.min(newTime, this.timelineStore.timelineDuration)
    );
    
    // Update playhead position
    this.timelineStore.setPlayheadPosition(constrainedTime);
    
    // Update video preview immediately
    this.updateVideoPreview(true);
    
    // Trigger render
    this.timelineStore.markDirty();
  }

  // Calculate if playhead is at clip boundary
  isAtClipBoundary(threshold = 0.1) {
    const playheadTime = this.timelineStore.playheadPosition;
    
    for (const track of this.timelineStore.tracks) {
      for (const clip of track.clips) {
        // Check start boundary
        if (Math.abs(playheadTime - clip.startTime) < threshold) {
          return { isAtBoundary: true, clipId: clip.id, edge: 'start' };
        }
        
        // Check end boundary
        if (Math.abs(playheadTime - (clip.startTime + clip.duration)) < threshold) {
          return { isAtBoundary: true, clipId: clip.id, edge: 'end' };
        }
      }
    }
    
    return { isAtBoundary: false };
  }
}

export default ScrubManager;
