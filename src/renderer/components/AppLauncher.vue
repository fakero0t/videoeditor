<template>
  <div class="app-launcher">
    <div class="launcher-header">
      <h1>Forge</h1>
      <p>Choose your workspace</p>
    </div>
    
    <div class="app-cards">
      <div class="app-card clipforge-card" @click="$emit('select-app', 'clipforge')">
        <div class="card-icon">🎬</div>
        <h2>ClipForge</h2>
        <p>Full-featured video editor with screen, webcam, and audio recording</p>
        <div class="card-features">
          <span class="feature-tag">Screen Recording</span>
          <span class="feature-tag">Webcam</span>
          <span class="feature-tag">Timeline Editing</span>
        </div>
      </div>
      
      <div class="app-card voiceforge-card" @click="$emit('select-app', 'voiceforge')">
        <div class="card-icon">🎙️</div>
        <h2>VoiceForge</h2>
        <p>Audio-focused editor with microphone recording and timeline editing</p>
        <div class="card-features">
          <span class="feature-tag">Audio Recording</span>
          <span class="feature-tag">Waveform View</span>
          <span class="feature-tag">Audio Editing</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Emit events for app selection
defineEmits(['select-app']);
</script>

<style lang="scss">
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

.app-launcher {
  height: 100vh;
  background: #c0c0c0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #000000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 11px;
}

.launcher-header {
  text-align: center;
  margin-bottom: 40px;
  @include d3-window;
  padding: 20px;
  margin: 20px;
}

.launcher-header h1 {
  font-size: 24px;
  font-weight: bold;
  margin: 0 0 8px 0;
  @include font-color('header-font-color');
}

.launcher-header p {
  font-size: 12px;
  color: #000000;
  margin: 0;
  font-weight: normal;
}

.app-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  max-width: 600px;
  width: 100%;
}

.app-card {
  @include d3-window;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.1s ease;
  position: relative;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  
  &:hover {
    background: #d0d0d0;
  }
  
  &:active {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
}

.card-icon {
  font-size: 32px;
  margin-bottom: 12px;
  display: block;
}

.app-card h2 {
  font-size: 14px;
  font-weight: bold;
  margin: 0 0 8px 0;
  @include font-color('header-font-color');
}

.app-card p {
  font-size: 11px;
  color: #000000;
  margin: 0 0 12px 0;
  line-height: 1.3;
}

.card-features {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  margin-top: 8px;
}

.feature-tag {
  @include d3-object;
  @include font;
  background: #c0c0c0;
  color: #000000;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: normal;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  
  &:hover {
    background: #d0d0d0;
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .app-cards {
    grid-template-columns: 1fr;
    gap: 12px;
    max-width: 300px;
  }
  
  .app-card {
    padding: 16px;
    min-height: 150px;
  }
  
  .launcher-header h1 {
    font-size: 18px;
  }
  
  .launcher-header p {
    font-size: 11px;
  }
}

/* Windows 95 button styling for cards */
.app-card {
  &:hover {
    background: #d0d0d0;
  }
  
  &:active {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
}

/* Scrollbar styling to match Windows 95 */
::-webkit-scrollbar {
  width: 16px;
  height: 16px;
}

::-webkit-scrollbar-track {
  background: #c0c0c0;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
}

::-webkit-scrollbar-thumb {
  @include d3-object;
  background: #c0c0c0;
  
  &:hover {
    background: #d0d0d0;
  }
}

::-webkit-scrollbar-corner {
  background: #c0c0c0;
}
</style>
