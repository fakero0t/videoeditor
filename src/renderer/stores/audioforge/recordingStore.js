import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAudioForgeRecordingStore = defineStore('audioforge-recording', () => {
    // State
    const isRecording = ref(false);
    const recordingType = ref(null); // 'microphone', 'system_audio'
    const recordingDuration = ref(0); // seconds
    const recordingStartTime = ref(null);
    const currentRecordingId = ref(null);
    
    // Sources
    const selectedMicrophoneSource = ref(null);
    const selectedSystemAudioSource = ref(null);
    
    // Available sources
    const availableScreenSources = ref([]);
    const availableWebcamSources = ref([]);
    const availableMicrophoneSources = ref([]);
    const availableSystemAudioSources = ref([]);
    
    // Quality settings
    const recordingQuality = ref('high'); // 'high', 'medium', 'low'
    const sampleRate = ref(44100); // 44.1kHz, 48kHz, 96kHz
    const bitDepth = ref(16); // 16-bit, 24-bit, 32-bit
    
    // Permissions
    const hasMicrophonePermission = ref(false);
    const hasSystemAudioPermission = ref(false);
    const permissionsChecked = ref(false);
    
    // Disk space
    const availableDiskSpace = ref(0); // bytes
    const diskSpaceWarning = ref(false);
    
    // Audio
    const audioLevel = ref(0); // 0-100
    const peakLevel = ref(0); // 0-100
    
    // Errors
    const lastError = ref(null);
    
    // Computed
    const canStartRecording = computed(() => {
      return !isRecording.value &&
             (selectedMicrophoneSource.value || selectedSystemAudioSource.value) &&
             (hasMicrophonePermission.value || hasSystemAudioPermission.value) &&
             availableDiskSpace.value > 1 * 1024 * 1024 * 1024; // 1GB
    });

    const hasRequiredPermissions = computed(() => {
      const needsMicrophonePermission = selectedMicrophoneSource.value && !hasMicrophonePermission.value;
      const needsSystemAudioPermission = selectedSystemAudioSource.value && !hasSystemAudioPermission.value;
      
      return !needsMicrophonePermission && !needsSystemAudioPermission;
    });

    const hasEnoughDiskSpace = computed(() => {
      return availableDiskSpace.value > 1 * 1024 * 1024 * 1024; // 1GB
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

    const setSelectedMicrophoneSource = (source) => {
      selectedMicrophoneSource.value = source;
    };

    const setSelectedSystemAudioSource = (source) => {
      selectedSystemAudioSource.value = source;
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

    const setAvailableSystemAudioSources = (sources) => {
      availableSystemAudioSources.value = sources;
    };

    const setRecordingQuality = (quality) => {
      recordingQuality.value = quality;
    };

    const setSampleRate = (rate) => {
      sampleRate.value = rate;
    };

    const setBitDepth = (depth) => {
      bitDepth.value = depth;
    };

    const setMicrophonePermission = (granted) => {
      hasMicrophonePermission.value = granted;
    };

    const setSystemAudioPermission = (granted) => {
      hasSystemAudioPermission.value = granted;
    };

    const setPermissionsChecked = (checked) => {
      permissionsChecked.value = checked;
    };
    
    const setPermissions = (screen, microphone) => {
      // AudioForge doesn't need screen permissions, ignore screen parameter
      hasMicrophonePermission.value = microphone;
      permissionsChecked.value = true;
    };

    const setAvailableDiskSpace = (space) => {
      availableDiskSpace.value = space;
      diskSpaceWarning.value = space < 1 * 1024 * 1024 * 1024; // 1GB warning
    };
    
    const setDiskSpace = (space) => {
      setAvailableDiskSpace(space);
    };

    const setAudioLevel = (level) => {
      audioLevel.value = Math.max(0, Math.min(100, level));
    };
    
    const updateAudioLevel = (level) => {
      setAudioLevel(level);
    };

    const setPeakLevel = (level) => {
      peakLevel.value = Math.max(0, Math.min(100, level));
    };

    const setLastError = (error) => {
      lastError.value = error;
    };
    
    const setError = (error) => {
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
      selectedMicrophoneSource.value = null;
      selectedSystemAudioSource.value = null;
      availableMicrophoneSources.value = [];
      availableSystemAudioSources.value = [];
      recordingQuality.value = 'high';
      sampleRate.value = 44100;
      bitDepth.value = 16;
      hasMicrophonePermission.value = false;
      hasSystemAudioPermission.value = false;
      permissionsChecked.value = false;
      availableDiskSpace.value = 0;
      diskSpaceWarning.value = false;
      audioLevel.value = 0;
      peakLevel.value = 0;
      lastError.value = null;
    };

    return {
      // State
      isRecording,
      recordingType,
      recordingDuration,
      recordingStartTime,
      currentRecordingId,
      selectedMicrophoneSource,
      selectedSystemAudioSource,
      availableScreenSources,
      availableWebcamSources,
      availableMicrophoneSources,
      availableSystemAudioSources,
      recordingQuality,
      sampleRate,
      bitDepth,
      hasMicrophonePermission,
      hasSystemAudioPermission,
      permissionsChecked,
      availableDiskSpace,
      diskSpaceWarning,
      audioLevel,
      peakLevel,
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
      setSelectedMicrophoneSource,
      setSelectedSystemAudioSource,
      setAvailableScreenSources,
      setAvailableWebcamSources,
      setAvailableMicrophoneSources,
      setAvailableSystemAudioSources,
      setRecordingQuality,
      setSampleRate,
      setBitDepth,
      setMicrophonePermission,
      setSystemAudioPermission,
      setPermissionsChecked,
      setPermissions,
      setAvailableDiskSpace,
      setDiskSpace,
      setAudioLevel,
      updateAudioLevel,
      setPeakLevel,
      setLastError,
      setError,
      clearError,
      reset
    };
});
