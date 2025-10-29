export class VideoCompositor {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.screenVideo = null;
    this.webcamVideo = null;
    this.isComposing = false;
    this.animationFrame = null;
    
    // PiP settings - fixed positioning
    this.pipWidth = 0.25; // 25% of screen width
    this.pipMargin = 16; // 16px margin from edges
  }

  // Initialize compositor with canvas
  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    
    // Create video elements for drawing
    this.screenVideo = document.createElement('video');
    this.screenVideo.muted = true;
    this.screenVideo.autoplay = true;
    
    this.webcamVideo = document.createElement('video');
    this.webcamVideo.muted = true;
    this.webcamVideo.autoplay = true;
  }

  // Set screen stream
  async setScreenStream(stream) {
    this.screenVideo.srcObject = stream;
    await this.screenVideo.play();
  }

  // Set webcam stream
  async setWebcamStream(stream) {
    this.webcamVideo.srcObject = stream;
    await this.webcamVideo.play();
  }

  // Start composition loop
  startComposition() {
    if (!this.canvas || !this.screenVideo || !this.webcamVideo) {
      throw new Error('Canvas and both streams required for composition');
    }

    this.isComposing = true;
    this.composite();
  }

  // Stop composition
  stopComposition() {
    this.isComposing = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  // Main composition loop
  composite() {
    if (!this.isComposing) return;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // Clear canvas
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw screen stream (full canvas)
    if (this.screenVideo.readyState >= 2) {
      this.ctx.drawImage(this.screenVideo, 0, 0, canvasWidth, canvasHeight);
    }

    // Draw webcam stream (PiP overlay in bottom-right)
    if (this.webcamVideo.readyState >= 2) {
      // Calculate PiP dimensions maintaining 16:9 aspect ratio
      const pipWidth = canvasWidth * this.pipWidth;
      const pipHeight = pipWidth * (9 / 16);
      
      // Position in bottom-right corner with margin
      const pipX = canvasWidth - pipWidth - this.pipMargin;
      const pipY = canvasHeight - pipHeight - this.pipMargin;
      
      // Draw semi-transparent background
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.fillRect(pipX - 4, pipY - 4, pipWidth + 8, pipHeight + 8);
      
      // Draw webcam video
      this.ctx.drawImage(this.webcamVideo, pipX, pipY, pipWidth, pipHeight);
      
      // Draw white border
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(pipX, pipY, pipWidth, pipHeight);
    }

    // Continue composition
    this.animationFrame = requestAnimationFrame(() => this.composite());
  }

  // Get composite stream from canvas
  getCompositeStream() {
    if (!this.canvas) {
      throw new Error('Canvas not initialized');
    }
    return this.canvas.captureStream(30); // 30 FPS
  }

  // Cleanup
  cleanup() {
    this.stopComposition();
    
    if (this.screenVideo) {
      this.screenVideo.srcObject = null;
      this.screenVideo = null;
    }
    
    if (this.webcamVideo) {
      this.webcamVideo.srcObject = null;
      this.webcamVideo = null;
    }
    
    this.canvas = null;
    this.ctx = null;
  }
}
