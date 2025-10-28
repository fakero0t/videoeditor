class VideoPlayerPool {
  constructor(maxPlayers = 10) {
    this.players = new Map(); // clipId -> video element
    this.maxPlayers = maxPlayers;
    this.activePlayer = null;
  }

  getPlayer(clipId, videoPath) {
    if (this.players.has(clipId)) {
      return this.players.get(clipId);
    }

    if (this.players.size >= this.maxPlayers) {
      this.evictOldestPlayer();
    }

    const video = this.createVideoElement(videoPath);
    this.players.set(clipId, video);
    return video;
  }

  createVideoElement(videoPath) {
    const video = document.createElement('video');
    video.src = videoPath;
    video.preload = 'metadata';
    video.muted = true; // Prevent autoplay issues
    video.style.display = 'none';
    video.style.position = 'absolute';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    document.body.appendChild(video);
    return video;
  }

  evictOldestPlayer() {
    const firstKey = this.players.keys().next().value;
    const video = this.players.get(firstKey);
    if (video && video.parentNode) {
      video.remove();
    }
    this.players.delete(firstKey);
  }

  setActivePlayer(clipId) {
    // Hide all players
    this.players.forEach(video => {
      video.style.display = 'none';
    });

    if (this.players.has(clipId)) {
      this.activePlayer = this.players.get(clipId);
      this.activePlayer.style.display = 'block';
    }
  }

  getActivePlayer() {
    return this.activePlayer;
  }

  pauseAll() {
    this.players.forEach(video => {
      if (!video.paused) {
        video.pause();
      }
    });
  }

  cleanup() {
    this.players.forEach(video => {
      if (video && video.parentNode) {
        video.remove();
      }
    });
    this.players.clear();
    this.activePlayer = null;
  }
}

export { VideoPlayerPool };
