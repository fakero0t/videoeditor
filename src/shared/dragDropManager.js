class DragDropManager {
  constructor(timelineStore, canvas) {
    this.timelineStore = timelineStore;
    this.canvas = canvas;
    this.dragState = {
      isDragging: false,
      dragSource: null, // 'timeline' or 'media-library'
      draggedClip: null,
      originalTrackId: null,
      originalStartTime: 0,
      dragOffset: { x: 0, y: 0 },
      currentMousePos: { x: 0, y: 0 },
      ghostPreview: null,
      affectedClips: [] // Clips being pushed aside
    };
    
    this.snapEnabled = true;
    this.gridSnapEnabled = false;
    this.gridInterval = 1.0; // seconds
  }

  // Initiate drag from media library
  startDragFromLibrary(clip, event) {
    this.dragState = {
      isDragging: true,
      dragSource: 'media-library',
      draggedClip: { ...clip },
      originalTrackId: null,
      originalStartTime: 0,
      dragOffset: { x: 0, y: 0 },
      currentMousePos: { x: event.clientX, y: event.clientY },
      ghostPreview: this.createGhostPreview(clip),
      affectedClips: []
    };
    
    this.showGhostPreview();
  }

  // Initiate drag from timeline
  startDragFromTimeline(clip, trackId, event) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    // Calculate clip's visual position on canvas (accounting for scroll)
    const clipStartX = clip.startTime * this.timelineStore.pixelsPerSecond - this.timelineStore.scrollPosition;
    
    this.dragState = {
      isDragging: true,
      dragSource: 'timeline',
      draggedClip: { ...clip },
      originalTrackId: trackId,
      originalStartTime: clip.startTime,
      dragOffset: {
        x: canvasX - clipStartX,
        y: 0
      },
      currentMousePos: { x: event.clientX, y: event.clientY },
      ghostPreview: this.createGhostPreview(clip),
      affectedClips: []
    };
    
    // Temporarily hide original clip (will show ghost instead)
    clip.isDragging = true;
  }

  // Handle mouse move during drag
  handleDragMove(event) {
    if (!this.dragState.isDragging) return;
    
    this.dragState.currentMousePos = { x: event.clientX, y: event.clientY };
    
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    
    // Calculate target position
    const targetTrackId = this.getTrackFromY(canvasY);
    let targetTime = this.getTimeFromX(canvasX - this.dragState.dragOffset.x);
    
    // Apply grid snap if enabled
    if (this.gridSnapEnabled) {
      targetTime = this.snapToGrid(targetTime);
    }
    
    // Constrain to valid positions
    targetTime = Math.max(0, targetTime);
    
    // Update ghost preview position
    this.updateGhostPreview(targetTime, targetTrackId);
    
    // Calculate collision and push-aside effects
    if (this.dragSource === 'timeline') {
      this.calculatePushAside(targetTime, targetTrackId, this.dragState.draggedClip.duration);
    }
    
    // Request render update
    this.timelineStore.markDirty();
  }

  // Handle drag end (drop)
  handleDragEnd(event) {
    if (!this.dragState.isDragging) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    
    const targetTrackId = this.getTrackFromY(canvasY);
    let targetTime = this.getTimeFromX(canvasX - this.dragState.dragOffset.x);
    
    // Apply grid snap if enabled
    if (this.gridSnapEnabled) {
      targetTime = this.snapToGrid(targetTime);
    }
    
    targetTime = Math.max(0, targetTime);
    
    // Validate track (must be within timeline)
    if (targetTrackId < 1 || targetTrackId > this.timelineStore.tracks.length) {
      this.cancelDrag();
      return;
    }
    
    // Execute the drop operation
    if (this.dragState.dragSource === 'media-library') {
      this.dropClipFromLibrary(targetTime, targetTrackId);
    } else if (this.dragState.dragSource === 'timeline') {
      this.moveClipOnTimeline(targetTime, targetTrackId);
    }
    
    // Clean up drag state
    this.clearDragState();
  }

  // Drop clip from media library onto timeline
  dropClipFromLibrary(targetTime, targetTrackId) {
    // Apply collision detection and adjust target time if needed
    const finalTime = this.resolveCollision(
      targetTime, 
      targetTrackId, 
      this.dragState.draggedClip.duration,
      null // no original clip to exclude
    );
    
    // Add clip to timeline
    this.timelineStore.addClipToTrack(
      `track-${targetTrackId}`, 
      this.dragState.draggedClip, 
      finalTime
    );
  }

  // Move clip on timeline
  moveClipOnTimeline(targetTime, targetTrackId) {
    const clip = this.dragState.draggedClip;
    const originalTrackId = this.dragState.originalTrackId;
    
    // Apply collision detection and push-aside logic
    const finalTime = this.resolveCollision(
      targetTime,
      targetTrackId,
      clip.duration,
      clip.id // exclude self from collision detection
    );
    
    // Apply push-aside to affected clips (temporarily disabled for precise positioning)
    // this.applyPushAside(finalTime, targetTrackId, clip.duration, clip.id);
    
    // Move clip to new position
    if (targetTrackId === originalTrackId) {
      // Moving within same track
      this.timelineStore.updateClipPosition(clip.id, finalTime);
    } else {
      // Moving between tracks
      const fromTrackId = `track-${originalTrackId}`;
      const toTrackId = `track-${targetTrackId}`;
      this.timelineStore.moveClipBetweenTracks(clip.id, fromTrackId, toTrackId, finalTime);
    }
    
    // Clear dragging flag
    clip.isDragging = false;
  }

  // Calculate which clips need to be pushed aside
  calculatePushAside(targetTime, targetTrackId, clipDuration) {
    const track = this.timelineStore.tracks.find(t => t.id === `track-${targetTrackId}`);
    if (!track) {
      this.dragState.affectedClips = [];
      return;
    }
    
    const draggedClipId = this.dragState.draggedClip.id;
    const targetEndTime = targetTime + clipDuration;
    
    // Find clips that would overlap
    const overlappingClips = track.clips.filter(clip => {
      if (clip.id === draggedClipId) return false; // Exclude self
      
      const clipEndTime = clip.startTime + clip.duration;
      
      // Check for overlap
      return !(targetEndTime <= clip.startTime || targetTime >= clipEndTime);
    });
    
    // Calculate push amounts
    this.dragState.affectedClips = overlappingClips.map(clip => {
      const clipEndTime = clip.startTime + clip.duration;
      
      // Determine push direction and amount
      let pushAmount = 0;
      
      if (targetTime < clip.startTime) {
        // Dragged clip starts before this clip - push it right
        pushAmount = targetEndTime - clip.startTime;
      } else {
        // Dragged clip overlaps or starts inside - push it right
        pushAmount = targetEndTime - clip.startTime;
      }
      
      return {
        clip,
        originalStartTime: clip.startTime,
        newStartTime: clip.startTime + pushAmount,
        pushAmount
      };
    });
  }

  // Apply push-aside effects to timeline state
  applyPushAside(targetTime, targetTrackId, clipDuration, excludeClipId) {
    const track = this.timelineStore.tracks.find(t => t.id === `track-${targetTrackId}`);
    if (!track) return;
    
    const targetEndTime = targetTime + clipDuration;
    
    // Sort clips by start time
    const sortedClips = [...track.clips]
      .filter(c => c.id !== excludeClipId)
      .sort((a, b) => a.startTime - b.startTime);
    
    // Push clips that overlap
    sortedClips.forEach(clip => {
      const clipEndTime = clip.startTime + clip.duration;
      
      if (!(targetEndTime <= clip.startTime || targetTime >= clipEndTime)) {
        // There's overlap - push this clip to the right
        const newStartTime = targetEndTime;
        this.timelineStore.updateClipPosition(clip.id, newStartTime);
      }
    });
  }

  // Resolve collision and return adjusted time
  resolveCollision(targetTime, targetTrackId, clipDuration, excludeClipId) {
    const track = this.timelineStore.tracks.find(t => t.id === `track-${targetTrackId}`);
    if (!track) return targetTime;
    
    // For now, allow exact positioning - don't auto-adjust for collisions
    // This gives users precise control over where clips are placed
    return targetTime;
  }

  // Create ghost preview element
  createGhostPreview(clip) {
    return {
      clip,
      x: 0,
      y: 0,
      width: clip.duration * this.timelineStore.pixelsPerSecond,
      height: 90,
      opacity: 0.6
    };
  }

  // Update ghost preview position
  updateGhostPreview(time, trackId) {
    if (!this.dragState.ghostPreview) return;
    
    const trackIndex = trackId - 1;
    const trackY = trackIndex * 100;
    
    this.dragState.ghostPreview.x = time * this.timelineStore.pixelsPerSecond - this.timelineStore.scrollPosition;
    this.dragState.ghostPreview.y = trackY + 5;
    this.dragState.ghostPreview.width = this.dragState.draggedClip.duration * 
      this.timelineStore.pixelsPerSecond;
  }

  // Draw ghost preview on canvas
  drawGhostPreview(ctx) {
    if (!this.dragState.isDragging || !this.dragState.ghostPreview) return;
    
    const ghost = this.dragState.ghostPreview;
    
    // Skip if ghost is not visible
    if (ghost.x + ghost.width < 0 || ghost.x > ctx.canvas.width) return;
    
    // Draw semi-transparent clip preview
    ctx.save();
    ctx.globalAlpha = ghost.opacity;
    
    // Ghost background
    ctx.fillStyle = '#4a90e2';
    ctx.fillRect(ghost.x, ghost.y, ghost.width, ghost.height);
    
    // Ghost border
    ctx.strokeStyle = '#2c5aa0';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Dashed border for ghost
    ctx.strokeRect(ghost.x, ghost.y, ghost.width, ghost.height);
    ctx.setLineDash([]);
    
    // Draw clip name
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText(
      this.dragState.draggedClip.fileName || 'Clip',
      ghost.x + 5,
      ghost.y + 20
    );
    
    ctx.restore();
    
    // Draw affected clips with push preview
    this.drawAffectedClips(ctx);
  }

  // Draw clips being pushed aside
  drawAffectedClips(ctx) {
    if (!this.dragState.affectedClips || this.dragState.affectedClips.length === 0) return;
    
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    
    this.dragState.affectedClips.forEach(({ clip, newStartTime }) => {
      const trackIndex = parseInt(clip.trackId.split('-')[1]) - 1;
      const trackY = trackIndex * 100;
      const x = newStartTime * this.timelineStore.pixelsPerSecond - this.timelineStore.scrollPosition;
      const width = clip.duration * this.timelineStore.pixelsPerSecond;
      
      // Skip if not visible
      if (x + width < 0 || x > ctx.canvas.width) return;
      
      // Draw outline showing where clip will be pushed to
      ctx.strokeRect(x, trackY + 5, width, 90);
    });
    
    ctx.restore();
  }

  // Snap to grid interval
  snapToGrid(time) {
    return Math.round(time / this.gridInterval) * this.gridInterval;
  }

  // Helper: Get track from Y coordinate
  getTrackFromY(y) {
    const trackHeight = 100;
    return Math.floor(y / trackHeight) + 1;
  }

  // Helper: Get time from X coordinate
  getTimeFromX(x) {
    return (x + this.timelineStore.scrollPosition) / this.timelineStore.pixelsPerSecond;
  }

  // Cancel drag operation
  cancelDrag() {
    if (this.dragState.draggedClip && this.dragState.dragSource === 'timeline') {
      this.dragState.draggedClip.isDragging = false;
    }
    this.clearDragState();
  }

  // Clear drag state
  clearDragState() {
    // Reset isDragging property on the original clip in the timeline
    if (this.dragState.draggedClip && this.dragState.originalTrackId) {
      const track = this.timelineStore.tracks.find(t => t.id === `track-${this.dragState.originalTrackId}`);
      if (track) {
        const originalClip = track.clips.find(c => c.id === this.dragState.draggedClip.id);
        if (originalClip) {
          originalClip.isDragging = false;
        }
      }
    }
    
    this.dragState = {
      isDragging: false,
      dragSource: null,
      draggedClip: null,
      originalTrackId: null,
      originalStartTime: 0,
      dragOffset: { x: 0, y: 0 },
      currentMousePos: { x: 0, y: 0 },
      ghostPreview: null,
      affectedClips: []
    };
    
    this.timelineStore.markDirty();
  }

  // Show ghost preview
  showGhostPreview() {
    document.body.style.cursor = 'grabbing';
  }

  // Hide ghost preview
  hideGhostPreview() {
    document.body.style.cursor = 'default';
  }
}

export default DragDropManager;
