class TrimManager {
  constructor(timelineStore, canvas) {
    this.timelineStore = timelineStore;
    this.canvas = canvas;
    
    this.trimming = false;
    this.trimEdge = null; // 'left' or 'right'
    this.trimClip = null;
    this.trimTrackId = null;
    this.originalClipState = null;
    this.hoveredEdge = null;
    this.hoveredClip = null;
    
    // Trim handle configuration
    this.handleWidth = 12; // pixels - hit area for trim handles
    this.minClipDuration = 0.1; // minimum 0.1 second clip duration
  }

  // Check if mouse is over a clip edge (for hover state)
  checkHoverState(mouseX, mouseY, selectedClipId = null) {
    const trackHeight = 100;
    const trackIndex = Math.floor(mouseY / trackHeight);
    const trackId = `track-${trackIndex + 1}`;
    
    const track = this.timelineStore.tracks.find(t => t.id === trackId);
    if (!track) {
      this.clearHoverState();
      return null;
    }
    
    // Check all clips for hover state
    for (const clip of track.clips) {
      const clipX = clip.startTime * this.timelineStore.pixelsPerSecond - this.timelineStore.scrollPosition;
      const clipWidth = clip.duration * this.timelineStore.pixelsPerSecond;
      const clipY = trackIndex * trackHeight + 5;
      const clipHeight = 90;
      
      // Check if mouse is within clip bounds
      const withinClip = mouseX >= clipX && 
                        mouseX <= clipX + clipWidth &&
                        mouseY >= clipY && 
                        mouseY <= clipY + clipHeight;
      
      if (withinClip) {
        // Check left edge
        const leftDistance = Math.abs(mouseX - clipX);
        if (leftDistance <= this.handleWidth) {
          console.log('Left edge detected:', { mouseX, clipX, leftDistance, handleWidth: this.handleWidth });
          this.hoveredEdge = 'left';
          this.hoveredClip = clip;
          return { edge: 'left', clip, trackId };
        }
        
        // Check right edge
        const rightDistance = Math.abs(mouseX - (clipX + clipWidth));
        if (rightDistance <= this.handleWidth) {
          console.log('Right edge detected:', { mouseX, clipX: clipX + clipWidth, rightDistance, handleWidth: this.handleWidth });
          this.hoveredEdge = 'right';
          this.hoveredClip = clip;
          return { edge: 'right', clip, trackId };
        }
      }
    }
    
    this.clearHoverState();
    return null;
  }

  // Clear hover state
  clearHoverState() {
    this.hoveredEdge = null;
    this.hoveredClip = null;
  }

  // Start trim operation
  startTrim(edge, clip, trackId) {
    this.trimming = true;
    this.trimEdge = edge;
    this.trimClip = clip;
    this.trimTrackId = trackId;
    
    // Store original state for validation
    this.originalClipState = {
      startTime: clip.startTime,
      duration: clip.duration,
      trimStart: clip.trimStart || 0,
      trimEnd: clip.trimEnd || clip.sourceDuration || clip.duration
    };
    
    // Set cursor
    document.body.style.cursor = 'ew-resize';
  }

  // Update trim during drag
  updateTrim(mouseX) {
    if (!this.trimming || !this.trimClip) return;
    
    const newTime = (mouseX + this.timelineStore.scrollPosition) / this.timelineStore.pixelsPerSecond;
    
    if (this.trimEdge === 'left') {
      this.trimLeftEdge(newTime);
    } else if (this.trimEdge === 'right') {
      this.trimRightEdge(newTime);
    }
    
    // Trigger timeline re-render
    this.timelineStore.markDirty();
  }

  // Trim left edge (in-point)
  trimLeftEdge(newStartTime) {
    const clip = this.trimClip;
    const originalStart = this.originalClipState.startTime;
    const originalDuration = this.originalClipState.duration;
    const originalTrimStart = this.originalClipState.trimStart;
    const clipEndTime = originalStart + originalDuration;
    
    // Constrain to valid range
    const maxStartTime = clipEndTime - this.minClipDuration;
    const minStartTime = originalStart - originalTrimStart;
    
    const constrainedStart = Math.max(
      minStartTime,
      Math.min(newStartTime, maxStartTime)
    );
    
    // Calculate new trim offset and duration
    const startDelta = constrainedStart - originalStart;
    const newTrimStart = originalTrimStart + startDelta;
    const newDuration = originalDuration - startDelta;
    
    // Update clip
    clip.startTime = constrainedStart;
    clip.duration = newDuration;
    clip.trimStart = newTrimStart;
    
    // Update timeline duration if needed
    this.timelineStore.updateTimelineDuration();
  }

  // Trim right edge (out-point)
  trimRightEdge(newEndTime) {
    const clip = this.trimClip;
    const clipStartTime = clip.startTime;
    const originalTrimStart = clip.trimStart || 0;
    const originalTrimEnd = this.originalClipState.trimEnd;
    const sourceDuration = clip.sourceDuration || this.originalClipState.duration;
    
    // Constrain to valid range
    const minEndTime = clipStartTime + this.minClipDuration;
    const maxEndTime = clipStartTime + (sourceDuration - originalTrimStart);
    
    const constrainedEnd = Math.max(
      minEndTime,
      Math.min(newEndTime, maxEndTime)
    );
    
    // Calculate new duration and trim end
    const newDuration = constrainedEnd - clipStartTime;
    const newTrimEnd = originalTrimStart + newDuration;
    
    // Update clip
    clip.duration = newDuration;
    clip.trimEnd = newTrimEnd;
    
    // Update timeline duration if needed
    this.timelineStore.updateTimelineDuration();
  }

  // End trim operation
  endTrim() {
    if (this.trimming) {
      // Finalize the trim operation
      this.trimming = false;
      this.trimEdge = null;
      this.trimClip = null;
      this.trimTrackId = null;
      this.originalClipState = null;
      
      document.body.style.cursor = 'default';
      
      // Final render
      this.timelineStore.markDirty();
    }
  }

  // Cancel trim and restore original state
  cancelTrim() {
    if (this.trimming && this.trimClip && this.originalClipState) {
      // Restore original values
      this.trimClip.startTime = this.originalClipState.startTime;
      this.trimClip.duration = this.originalClipState.duration;
      this.trimClip.trimStart = this.originalClipState.trimStart;
      this.trimClip.trimEnd = this.originalClipState.trimEnd;
      
      this.endTrim();
    }
  }

  // Get cursor style based on edge
  getCursorForEdge(edge) {
    return edge ? 'ew-resize' : 'default';
  }
}

export default TrimManager;
