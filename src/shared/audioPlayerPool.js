class AudioPlayerPool {
  constructor() {
    this.players = new Map();
    this.maxPlayers = 10; // Limit concurrent audio players
  }

  getPlayer(clipId, filePath) {
    // Check if player already exists
    if (this.players.has(clipId)) {
      const player = this.players.get(clipId);
      if (player.src !== filePath) {
        player.src = filePath;
        player.load();
      }
      return player;
    }

    // Create new audio element
    const audio = document.createElement('audio');
    audio.src = filePath;
    audio.preload = 'none';
    audio.crossOrigin = 'anonymous';
    
    // Add to pool
    this.players.set(clipId, audio);
    
    // Clean up old players if we exceed max
    if (this.players.size > this.maxPlayers) {
      const firstKey = this.players.keys().next().value;
      const oldPlayer = this.players.get(firstKey);
      oldPlayer.pause();
      oldPlayer.src = '';
      this.players.delete(firstKey);
    }
    
    return audio;
  }

  pauseAll() {
    this.players.forEach(player => {
      player.pause();
    });
  }

  stopAll() {
    this.players.forEach(player => {
      player.pause();
      player.currentTime = 0;
    });
  }

  cleanup() {
    this.players.forEach(player => {
      player.pause();
      player.src = '';
    });
    this.players.clear();
  }
}

export { AudioPlayerPool };
