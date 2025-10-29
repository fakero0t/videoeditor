class TrimHandleRenderer {
  constructor(timelineStore) {
    this.timelineStore = timelineStore;
    this.handleWidth = 12;
    this.handleColor = '#ffffff';
    this.handleColorActive = '#4a90e2';
    this.trimmedAreaColor = 'rgba(0, 0, 0, 0.5)';
  }

  // Draw trim handles for a clip (on hover or selection)
  drawTrimHandles(ctx, clip, trackIndex, isHovered = false, hoveredEdge = null) {
    const clipX = clip.startTime * this.timelineStore.pixelsPerSecond - this.timelineStore.scrollPosition;
    const clipWidth = clip.duration * this.timelineStore.pixelsPerSecond;
    
    // Calculate track Y position based on individual track heights
    let trackY = 0;
    for (let i = 0; i < trackIndex; i++) {
      trackY += this.timelineStore.tracks[i].height;
    }
    
    const track = this.timelineStore.tracks[trackIndex];
    const clipY = trackY + 5;
    const clipHeight = track.height - 10;
    
    ctx.save();
    
    // Draw left handle
    const leftHandleActive = hoveredEdge === 'left';
    this.drawHandle(ctx, clipX, clipY, clipHeight, 'left', leftHandleActive);
    
    // Draw right handle
    const rightHandleActive = hoveredEdge === 'right';
    this.drawHandle(ctx, clipX + clipWidth, clipY, clipHeight, 'right', rightHandleActive);
    
    // Draw trimmed regions if clip has trim
    if (clip.trimStart > 0 || (clip.trimEnd && clip.trimEnd < clip.sourceDuration)) {
      this.drawTrimmedRegions(ctx, clip, clipX, clipY, clipWidth, clipHeight);
    }
    
    ctx.restore();
  }

  // Draw individual trim handle
  drawHandle(ctx, x, y, height, side, isActive) {
    const color = isActive ? this.handleColorActive : this.handleColor;
    const handleWidth = 4;
    const gripWidth = 2;
    const gripHeight = 20;
    const gripSpacing = 2;
    
    // Draw handle bar
    ctx.fillStyle = color;
    if (side === 'left') {
      ctx.fillRect(x, y, handleWidth, height);
    } else {
      ctx.fillRect(x - handleWidth, y, handleWidth, height);
    }
    
    // Draw grip lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = gripWidth;
    
    const gripY = y + height / 2 - gripHeight / 2;
    const gripX = side === 'left' ? x + gripSpacing : x - handleWidth + gripSpacing;
    
    for (let i = 0; i < 3; i++) {
      const lineY = gripY + (i * 8);
      ctx.beginPath();
      ctx.moveTo(gripX, lineY);
      ctx.lineTo(gripX, lineY + gripHeight / 4);
      ctx.stroke();
    }
  }

  // Draw visual indication of trimmed areas
  drawTrimmedRegions(ctx, clip, clipX, clipY, clipWidth, clipHeight) {
    const sourceDuration = clip.sourceDuration || clip.duration;
    const trimStart = clip.trimStart || 0;
    const trimEnd = clip.trimEnd || sourceDuration;
    
    // Calculate pixel widths
    const totalSourceWidth = sourceDuration * this.timelineStore.pixelsPerSecond;
    const scale = clipWidth / (trimEnd - trimStart);
    
    ctx.save();
    ctx.fillStyle = this.trimmedAreaColor;
    
    // Left trimmed region (if any)
    if (trimStart > 0) {
      const trimmedLeftWidth = trimStart * scale;
      // Draw striped pattern for trimmed area
      this.drawStripedPattern(ctx, clipX - trimmedLeftWidth, clipY, trimmedLeftWidth, clipHeight);
    }
    
    // Right trimmed region (if any)
    if (trimEnd < sourceDuration) {
      const remainingDuration = sourceDuration - trimEnd;
      const trimmedRightWidth = remainingDuration * scale;
      this.drawStripedPattern(ctx, clipX + clipWidth, clipY, trimmedRightWidth, clipHeight);
    }
    
    ctx.restore();
  }

  // Draw striped pattern for trimmed regions
  drawStripedPattern(ctx, x, y, width, height) {
    ctx.save();
    
    // Create clipping region
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    
    // Draw dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x, y, width, height);
    
    // Draw diagonal stripes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    
    const stripeSpacing = 8;
    const stripeCount = Math.ceil((width + height) / stripeSpacing);
    
    for (let i = 0; i < stripeCount; i++) {
      ctx.beginPath();
      const offset = i * stripeSpacing;
      ctx.moveTo(x + offset, y);
      ctx.lineTo(x + offset - height, y + height);
      ctx.stroke();
    }
    
    ctx.restore();
  }
}

export default TrimHandleRenderer;
