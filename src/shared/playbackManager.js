class PlaybackManager {
  constructor(timelineStore, videoPlayerPool) {
    this.timelineStore = timelineStore;
    this.videoPlayerPool = videoPlayerPool;
    this.isPlaying = false;
    this.playbackSpeed = 1;
    this.animationFrameId = null;
    this.currentClipIndex = 0;
    this.clipSequence = [];
    this.audioContext = null;
    this.audioSources = new Map();
    this.preloadedClips = new Set();
    this.transitionBuffer = 0.5; // seconds before clip end to preload next
    
    this.setupAudioContext();
    this.buildClipSequence();
  }

  setupAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.warn('Could not create audio context:', error);
    }
  }

  buildClipSequence() {
    // Build chronological sequence of all clips across all tracks
    this.clipSequence = [];
    
    this.timelineStore.tracks.forEach(track => {
      track.clips.forEach(clip => {
        this.clipSequence.push({
          ...clip,
          trackId: track.id,
          trackName: track.name
        });
      });
    });
    
    // Sort by start time
    this.clipSequence.sort((a, b) => a.startTime - b.startTime);
  }

  async play() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.startPlaybackLoop();
    
    // Start audio for current clip
    await this.startCurrentClipAudio();
  }

  pause() {
    this.isPlaying = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Pause all video elements
    this.videoPlayerPool.players.forEach(video => {
      video.pause();
    });
    
    // Pause all audio sources
    this.audioSources.forEach(({ source, gainNode }) => {
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch (error) {
        console.warn('Error stopping audio:', error);
      }
    });
    this.audioSources.clear();
  }

  stop() {
    this.pause();
    this.timelineStore.playheadPosition = 0;
    this.currentClipIndex = 0;
  }

  startPlaybackLoop() {
    const updatePlayhead = () => {
      if (!this.isPlaying) return;
      
      // Update playhead position
      const currentTime = this.timelineStore.playheadPosition;
      const newTime = currentTime + (1/30) * this.playbackSpeed; // 30fps updates
      
      this.timelineStore.playheadPosition = newTime;
      
      // Check if we need to switch clips
      this.checkClipTransition(newTime);
      
      // Check if we've reached the end
      if (newTime >= this.timelineStore.timelineDuration) {
        this.stop();
        return;
      }
      
      // Continue animation loop
      this.animationFrameId = requestAnimationFrame(updatePlayhead);
    };
    
    updatePlayhead();
  }

  checkClipTransition(currentTime) {
    const currentClip = this.getCurrentClip(currentTime);
    
    if (currentClip && currentClip.id !== this.getCurrentClipId()) {
      this.switchToClip(currentClip);
    }
    
    // Preload next clip for seamless transition
    this.preloadNextClip(currentTime);
  }

  getCurrentClip(time) {
    // Find the clip that should be playing at this time
    // Higher track numbers take priority (overlay behavior)
    let activeClip = null;
    let highestTrackId = -1;
    
    this.timelineStore.tracks.forEach(track => {
      track.clips.forEach(clip => {
        if (time >= clip.startTime && time < clip.startTime + clip.duration) {
          if (track.id > highestTrackId) {
            activeClip = clip;
            highestTrackId = track.id;
          }
        }
      });
    });
    
    return activeClip;
  }

  getCurrentClipId() {
    const currentClip = this.getCurrentClip(this.timelineStore.playheadPosition);
    return currentClip ? currentClip.id : null;
  }

  async switchToClip(clip) {
    // Stop current audio
    this.stopAllAudio();
    
    // Get video element for this clip
    const video = this.videoPlayerPool.getPlayer(clip.id, clip.filePath);
    
    // Set video time to match timeline position
    const relativeTime = this.timelineStore.playheadPosition - clip.startTime;
    video.currentTime = Math.max(0, relativeTime);
    
    // Start playing video
    if (this.isPlaying) {
      try {
        await video.play();
      } catch (error) {
        console.warn('Could not play video:', error);
      }
    }
    
    // Start audio for this clip
    await this.startClipAudio(clip, video);
  }

  async startCurrentClipAudio() {
    const currentClip = this.getCurrentClip(this.timelineStore.playheadPosition);
    if (currentClip) {
      const video = this.videoPlayerPool.getPlayer(currentClip.id, currentClip.filePath);
      await this.startClipAudio(currentClip, video);
    }
  }

  async startClipAudio(clip, videoElement) {
    if (!this.audioContext) return;
    
    try {
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Create audio source from video element
      const source = this.audioContext.createMediaElementSource(videoElement);
      const gainNode = this.audioContext.createGain();
      
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Store audio source for cleanup
      this.audioSources.set(clip.id, { source, gainNode });
      
    } catch (error) {
      console.warn('Could not create audio source:', error);
    }
  }

  stopAllAudio() {
    this.audioSources.forEach(({ source, gainNode }) => {
      try {
        source.disconnect();
        gainNode.disconnect();
      } catch (error) {
        console.warn('Error stopping audio:', error);
      }
    });
    this.audioSources.clear();
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = speed;
    // Update video playback rate
    this.videoPlayerPool.players.forEach(video => {
      video.playbackRate = speed;
    });
  }

  preloadNextClip(currentTime) {
    const nextClip = this.findNextClip(currentTime);
    if (nextClip && !this.preloadedClips.has(nextClip.id)) {
      const video = this.videoPlayerPool.getPlayer(nextClip.id, nextClip.filePath);
      video.preload = 'auto';
      video.load();
      this.preloadedClips.add(nextClip.id);
    }
  }

  findNextClip(currentTime) {
    // Find next clip that starts after current time
    for (const track of this.timelineStore.tracks) {
      for (const clip of track.clips) {
        if (clip.startTime > currentTime) {
          return clip;
        }
      }
    }
    
    return null;
  }

  cleanup() {
    this.pause();
    this.stopAllAudio();
    this.preloadedClips.clear();
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

export { PlaybackManager };
