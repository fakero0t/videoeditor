import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useClipForgeRecordingStore = defineStore('clipforge-recording', () => {
    // State
    const isRecording = ref(false);
    const recordingType = ref(null); // 'screen', 'webcam', 'composite'
    const recordingDuration = ref(0); // seconds
    const recordingStartTime = ref(null);
    const currentRecordingId = ref(null);
    
    // Sources
    const selectedScreenSource = ref(null);
    const selectedWebcamSource = ref(null);
    const selectedMicrophoneSource = ref(null);
    
    // Available sources
    const availableScreenSources = ref([]);
    const availableWebcamSources = ref([]);
    const availableMicrophoneSources = ref([]);
    
    // Quality settings
    const recordingQuality = ref('high'); // 'high', 'medium', 'low'
    
    // Permissions
    const hasScreenPermission = ref(false);
    const hasMicrophonePermission = ref(false);
    const permissionsChecked = ref(false);
    
    // Disk space
    const availableDiskSpace = ref(0); // bytes
    const diskSpaceWarning = ref(false);
    
    // Audio
    const audioLevel = ref(0); // 0-100
    const systemAudioEnabled = ref(false);
    
    // Errors
    const lastError = ref(null);
    
    // Computed
    const canStartRecording = computed(() => {
      return !isRecording.value &&
             selectedScreenSource.value &&
             hasScreenPermission.value &&
             hasMicrophonePermission.value &&
             availableDiskSpace.value > 5 * 1024 * 1024 * 1024; // 5GB
    });

    // More flexible permission checking
    const hasRequiredPermissions = computed(() => {
      // For screen recording: need screen permission + microphone permission (if mic selected)
      const needsScreenPermission = selectedScreenSource.value && !hasScreenPermission.value;
      const needsMicrophonePermission = selectedMicrophoneSource.value && !hasMicrophonePermission.value;
      
      return !needsScreenPermission && !needsMicrophonePermission;
    });

    const hasEnoughDiskSpace = computed(() => {
      return availableDiskSpace.value > 5 * 1024 * 1024 * 1024; // 5GB
    });

    const recordingTimeFormatted = computed(() => {
      const minutes = Math.floor(recordingDuration.value / 60);
      const seconds = Math.floor(recordingDuration.value % 60);
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    });

    // Actions
    const startRecording = async () => {
      if (!canStartRecording.value) return false;
      
      try {
        isRecording.value = true;
        recordingStartTime.value = Date.now();
        recordingDuration.value = 0;
        
        // Start recording timer
        startRecordingTimer();
        
        return true;
      } catch (error) {
        console.error('Error starting recording:', error);
        lastError.value = error.message;
        isRecording.value = false;
        return false;
      }
    };

    const stopRecording = async () => {
      if (!isRecording.value) return;
      
      try {
        isRecording.value = false;
        recordingStartTime.value = null;
        recordingDuration.value = 0;
        
        // Stop recording timer
        stopRecordingTimer();
        
        return true;
      } catch (error) {
        console.error('Error stopping recording:', error);
        lastError.value = error.message;
        return false;
      }
    };

    const startRecordingTimer = () => {
      const updateTimer = () => {
        if (isRecording.value && recordingStartTime.value) {
          recordingDuration.value = (Date.now() - recordingStartTime.value) / 1000;
          requestAnimationFrame(updateTimer);
        }
      };
      updateTimer();
    };

    const stopRecordingTimer = () => {
      // Timer will stop automatically when isRecording becomes false
    };

    const setRecordingType = (type) => {
      recordingType.value = type;
    };

    const setSelectedScreenSource = (source) => {
      selectedScreenSource.value = source;
    };

    const setSelectedWebcamSource = (source) => {
      selectedWebcamSource.value = source;
    };

    const setSelectedMicrophoneSource = (source) => {
      selectedMicrophoneSource.value = source;
    };

    const setAvailableScreenSources = (sources) => {
      availableScreenSources.value = sources;
    };

    const setAvailableWebcamSources = (sources) => {
      availableWebcamSources.value = sources;
    };

    const setAvailableMicrophoneSources = (sources) => {
      availableMicrophoneSources.value = sources;
    };

    const setRecordingQuality = (quality) => {
      recordingQuality.value = quality;
    };

    const setScreenPermission = (granted) => {
      hasScreenPermission.value = granted;
    };

    const setMicrophonePermission = (granted) => {
      hasMicrophonePermission.value = granted;
    };

    const setPermissionsChecked = (checked) => {
      permissionsChecked.value = checked;
    };
    
    const setPermissions = (screen, microphone) => {
      hasScreenPermission.value = screen;
      hasMicrophonePermission.value = microphone;
      permissionsChecked.value = true;
    };

    const setAvailableDiskSpace = (space) => {
      availableDiskSpace.value = space;
      diskSpaceWarning.value = space < 5 * 1024 * 1024 * 1024; // 5GB warning
    };

    const setAudioLevel = (level) => {
      audioLevel.value = Math.max(0, Math.min(100, level));
    };

    const setSystemAudioEnabled = (enabled) => {
      systemAudioEnabled.value = enabled;
    };

    const setLastError = (error) => {
      lastError.value = error;
    };

    const clearError = () => {
      lastError.value = null;
    };

    const reset = () => {
      isRecording.value = false;
      recordingType.value = null;
      recordingDuration.value = 0;
      recordingStartTime.value = null;
      currentRecordingId.value = null;
      selectedScreenSource.value = null;
      selectedWebcamSource.value = null;
      selectedMicrophoneSource.value = null;
      availableScreenSources.value = [];
      availableWebcamSources.value = [];
      availableMicrophoneSources.value = [];
      recordingQuality.value = 'high';
      hasScreenPermission.value = false;
      hasMicrophonePermission.value = false;
      permissionsChecked.value = false;
      availableDiskSpace.value = 0;
      diskSpaceWarning.value = false;
      audioLevel.value = 0;
      systemAudioEnabled.value = false;
      lastError.value = null;
    };

    return {
      // State
      isRecording,
      recordingType,
      recordingDuration,
      recordingStartTime,
      currentRecordingId,
      selectedScreenSource,
      selectedWebcamSource,
      selectedMicrophoneSource,
      availableScreenSources,
      availableWebcamSources,
      availableMicrophoneSources,
      recordingQuality,
      hasScreenPermission,
      hasMicrophonePermission,
      permissionsChecked,
      availableDiskSpace,
      diskSpaceWarning,
      audioLevel,
      systemAudioEnabled,
      lastError,
      
      // Computed
      canStartRecording,
      hasRequiredPermissions,
      hasEnoughDiskSpace,
      recordingTimeFormatted,
      
      // Actions
      startRecording,
      stopRecording,
      setRecordingType,
      setSelectedScreenSource,
      setSelectedWebcamSource,
      setSelectedMicrophoneSource,
      setAvailableScreenSources,
      setAvailableWebcamSources,
      setAvailableMicrophoneSources,
      setRecordingQuality,
      setScreenPermission,
      setMicrophonePermission,
      setPermissionsChecked,
      setPermissions,
      setAvailableDiskSpace,
      setAudioLevel,
      setSystemAudioEnabled,
      setLastError,
      clearError,
      reset
    };
});
