<template>
  <div v-if="isVisible" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>Permissions Required</h3>
        <button @click="closeModal" class="close-btn">×</button>
      </div>
      
      <div class="modal-body">
        <div v-if="appMode === 'clipforge' && !hasScreenPermission" class="permission-item">
          <div class="permission-icon">🖥️</div>
          <div class="permission-info">
            <h4>Screen Recording Permission</h4>
            <p>ClipForge needs permission to record your screen.</p>
            
            <div class="instructions">
              <p><strong>To grant permission:</strong></p>
              <ol>
                <li v-if="platform.isMac">
                  Open System Settings (or System Preferences)
                </li>
                <li v-else-if="platform.isWindows">
                  Open Settings → Privacy → Camera
                </li>
                <li v-else>
                  Check your system's privacy settings
                </li>
                
                <li v-if="platform.isMac">
                  Go to Privacy & Security → Screen Recording
                </li>
                <li v-else-if="platform.isWindows">
                  Allow apps to access your camera
                </li>
                
                <li v-if="platform.isMac">
                  Enable the checkbox next to {{ appMode === 'clipforge' ? 'ClipForge' : 'AudioForge' }}
                </li>
                <li v-else-if="platform.isWindows">
                  Enable {{ appMode === 'clipforge' ? 'ClipForge' : 'AudioForge' }} in the list
                </li>
                
                <li>Restart {{ appMode === 'clipforge' ? 'ClipForge' : 'AudioForge' }}</li>
              </ol>
            </div>
          </div>
        </div>
        
        <div v-if="!hasMicrophonePermission" class="permission-item">
          <div class="permission-icon">🎤</div>
          <div class="permission-info">
            <h4>Microphone Permission</h4>
            <p>{{ appMode === 'clipforge' ? 'ClipForge' : 'AudioForge' }} needs permission to record audio from your microphone.</p>
            
            <div class="instructions">
              <p><strong>To grant permission:</strong></p>
              <ol>
                <li v-if="platform.isMac">
                  Open System Settings → Privacy & Security → Microphone
                </li>
                <li v-else-if="platform.isWindows">
                  Open Settings → Privacy → Microphone
                </li>
                <li v-else>
                  Check your system's privacy settings
                </li>
                
                <li>Enable the checkbox next to ClipForge</li>
                <li>Restart ClipForge</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="openSystemSettings" class="primary-btn">
          Open System Settings
        </button>
        <button @click="recheckPermissions" class="secondary-btn">
          Recheck Permissions
        </button>
        <button @click="closeModal" class="cancel-btn">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  isVisible: Boolean,
  hasScreenPermission: Boolean,
  hasMicrophonePermission: Boolean,
  appMode: {
    type: String,
    default: 'clipforge'
  }
});

const emit = defineEmits(['close', 'recheck']);

// Platform detection
const platform = computed(() => {
  const userAgent = navigator.userAgent.toLowerCase();
  return {
    isMac: userAgent.includes('mac'),
    isWindows: userAgent.includes('win'),
    isLinux: userAgent.includes('linux')
  };
});

const closeModal = () => {
  emit('close');
};

const openSystemSettings = async () => {
  await window.electronAPI.recording.openSystemSettings();
};

const recheckPermissions = () => {
  emit('recheck');
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #444;
}

.modal-header h3 {
  margin: 0;
  color: #fff;
}

.close-btn {
  background: none;
  border: none;
  color: #fff;
  font-size: 28px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
}

.close-btn:hover {
  color: #ff6b6b;
}

.modal-body {
  padding: 20px;
}

.permission-item {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.permission-item:last-child {
  margin-bottom: 0;
}

.permission-icon {
  font-size: 48px;
  flex-shrink: 0;
}

.permission-info {
  flex: 1;
}

.permission-info h4 {
  margin: 0 0 8px 0;
  color: #fff;
}

.permission-info p {
  margin: 0 0 12px 0;
  color: #ccc;
}

.instructions {
  background: #1a1a1a;
  padding: 12px;
  border-radius: 4px;
  margin-top: 12px;
}

.instructions p {
  margin: 0 0 8px 0;
  color: #fff;
  font-weight: bold;
}

.instructions ol {
  margin: 8px 0 0 0;
  padding-left: 20px;
  color: #ccc;
}

.instructions li {
  margin-bottom: 6px;
}

.modal-footer {
  padding: 20px;
  border-top: 1px solid #444;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.primary-btn {
  background: #007acc;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.primary-btn:hover {
  background: #005a9e;
}

.secondary-btn {
  background: #444;
  color: white;
  border: 1px solid #666;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.secondary-btn:hover {
  background: #555;
}

.cancel-btn {
  background: transparent;
  color: #ccc;
  border: 1px solid #666;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn:hover {
  background: #333;
}
</style>
