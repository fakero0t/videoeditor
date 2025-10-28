class PlayheadRenderer {
  constructor(canvas, timelineStore) {
    this.canvas = canvas;
    this.timelineStore = timelineStore;
    this.playheadColor = '#ff0000';
    this.playheadWidth = 2;
    this.handleSize = 12;
  }

  // Draw playhead on timeline canvas
  draw(ctx) {
    const x = this.timelineStore.playheadPosition * 
               this.timelineStore.pixelsPerSecond - this.timelineStore.scrollPosition;
    const height = this.canvas.height;
    
    // Skip if playhead is not visible
    if (x < 0 || x > this.canvas.width) return;
    
    ctx.save();
    
    // Draw playhead line
    ctx.strokeStyle = this.playheadColor;
    ctx.lineWidth = this.playheadWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    
    // Draw playhead handle at top
    this.drawHandle(ctx, x, 0);
    
    ctx.restore();
  }

  // Draw draggable handle at top of playhead
  drawHandle(ctx, x, y) {
    // Triangle handle
    ctx.fillStyle = this.playheadColor;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - this.handleSize / 2, y + this.handleSize);
    ctx.lineTo(x + this.handleSize / 2, y + this.handleSize);
    ctx.closePath();
    ctx.fill();
    
    // White outline for visibility
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Check if mouse is over playhead handle
  isOverHandle(mouseX, mouseY) {
    const playheadX = this.timelineStore.playheadPosition * 
                      this.timelineStore.pixelsPerSecond - this.timelineStore.scrollPosition;
    
    // Check if within handle bounds
    const handleTop = 0;
    const handleBottom = this.handleSize;
    const handleLeft = playheadX - this.handleSize / 2;
    const handleRight = playheadX + this.handleSize / 2;
    
    return mouseX >= handleLeft && 
           mouseX <= handleRight && 
           mouseY >= handleTop && 
           mouseY <= handleBottom;
  }

  // Check if mouse is near playhead line
  isNearPlayhead(mouseX, threshold = 5) {
    const playheadX = this.timelineStore.playheadPosition * 
                      this.timelineStore.pixelsPerSecond - this.timelineStore.scrollPosition;
    
    return Math.abs(mouseX - playheadX) <= threshold;
  }

  // Draw time indicator tooltip
  drawTimeTooltip(ctx, mouseX, mouseY) {
    const time = (mouseX + this.timelineStore.scrollPosition) / this.timelineStore.pixelsPerSecond;
    const timeStr = this.formatTime(time);
    
    // Measure text
    ctx.font = '12px Arial';
    const textWidth = ctx.measureText(timeStr).width;
    const padding = 6;
    const tooltipWidth = textWidth + padding * 2;
    const tooltipHeight = 20;
    
    // Position tooltip above cursor
    const tooltipX = mouseX - tooltipWidth / 2;
    const tooltipY = mouseY - tooltipHeight - 10;
    
    // Draw tooltip background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
    
    // Draw tooltip text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, mouseX, tooltipY + tooltipHeight / 2);
    
    // Reset alignment
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // Format time as MM:SS.ms
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
}

export default PlayheadRenderer;
