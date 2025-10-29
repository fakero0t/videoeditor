class AudioForgePlaybackManager {
  constructor(timelineStore, audioPlayerPool) {
    this.timelineStore = timelineStore;
    this.audioPlayerPool = audioPlayerPool;
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
    
    // Pause all audio elements
    this.audioPlayerPool.players.forEach(audio => {
      audio.pause();
    });
    
    // NOTE: Do NOT clear audioSources Map - audio sources must persist
    // because createMediaElementSource() can only be called once per element
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
    // NOTE: Do NOT call stopAllAudio() here - audio sources must persist
    // The Web Audio API graph stays connected, we just switch which audio is playing
    
    // Get audio element for this clip
    const audio = this.audioPlayerPool.getPlayer(clip.id, clip.filePath);
    
    // Ensure audio is enabled
    audio.muted = false;
    audio.volume = 1.0;
    
    // Set audio time to match timeline position
    const relativeTime = this.timelineStore.playheadPosition - clip.startTime;
    audio.currentTime = Math.max(0, relativeTime);
    
    // Start playing audio
    if (this.isPlaying) {
      try {
        await audio.play();
      } catch (error) {
        console.warn('Could not play audio:', error);
      }
    }
    
    // Start audio for this clip
    await this.startClipAudio(clip, audio);
  }

  async startCurrentClipAudio() {
    const currentClip = this.getCurrentClip(this.timelineStore.playheadPosition);
    if (currentClip) {
      const audio = this.audioPlayerPool.getPlayer(currentClip.id, currentClip.filePath);
      await this.startClipAudio(currentClip, audio);
    }
  }

  async startClipAudio(clip, audioElement) {
    if (!this.audioContext) return;
    
    try {
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Check if we already have an audio source for this clip
      // createMediaElementSource() can only be called ONCE per element for its lifetime
      if (this.audioSources.has(clip.id)) {
        // Audio source already exists and is still connected
        // Just ensure context is running (already done above)
        return;
      }
      
      // Ensure audio is unmuted and has volume before routing through Web Audio API
      audioElement.muted = false;
      audioElement.volume = 1.0;
      
      // Create audio source from audio element (can only be done once per element!)
      const source = this.audioContext.createMediaElementSource(audioElement);
      const gainNode = this.audioContext.createGain();
      
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Store audio source permanently (never clear unless cleanup)
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
    // Update audio playback rate
    this.audioPlayerPool.players.forEach(audio => {
      audio.playbackRate = speed;
    });
  }

  preloadNextClip(currentTime) {
    const nextClip = this.findNextClip(currentTime);
    if (nextClip && !this.preloadedClips.has(nextClip.id)) {
      const audio = this.audioPlayerPool.getPlayer(nextClip.id, nextClip.filePath);
      audio.preload = 'auto';
      audio.load();
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

export { AudioForgePlaybackManager };
