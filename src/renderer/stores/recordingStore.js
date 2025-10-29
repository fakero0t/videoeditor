import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useRecordingStore = defineStore('recording', () => {
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
  
  const recordingDurationFormatted = computed(() => {
    const hours = Math.floor(recordingDuration.value / 3600);
    const minutes = Math.floor((recordingDuration.value % 3600) / 60);
    const seconds = Math.floor(recordingDuration.value % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });
  
  const isApproachingLimit = computed(() => {
    // 2 hour limit = 7200 seconds
    return recordingDuration.value >= 7200;
  });
  
  // Actions
  const startRecording = (type, recordingId) => {
    isRecording.value = true;
    recordingType.value = type;
    recordingStartTime.value = Date.now();
    recordingDuration.value = 0;
    currentRecordingId.value = recordingId;
    lastError.value = null;
  };
  
  const stopRecording = () => {
    isRecording.value = false;
    recordingType.value = null;
    recordingStartTime.value = null;
    recordingDuration.value = 0;
    currentRecordingId.value = null;
  };
  
  const updateDuration = (duration) => {
    recordingDuration.value = duration;
  };
  
  const setPermissions = (screen, microphone) => {
    hasScreenPermission.value = screen;
    hasMicrophonePermission.value = microphone;
    permissionsChecked.value = true;
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
  
  const setSelectedScreenSource = (source) => {
    selectedScreenSource.value = source;
  };
  
  const setSelectedWebcamSource = (source) => {
    selectedWebcamSource.value = source;
  };
  
  const setSelectedMicrophoneSource = (source) => {
    selectedMicrophoneSource.value = source;
  };
  
  const updateAudioLevel = (level) => {
    audioLevel.value = Math.min(100, Math.max(0, level));
  };
  
  const setDiskSpace = (bytes) => {
    availableDiskSpace.value = bytes;
    diskSpaceWarning.value = bytes < 5 * 1024 * 1024 * 1024; // 5GB
  };
  
  const setError = (error) => {
    lastError.value = error;
  };
  
  const clearError = () => {
    lastError.value = null;
  };
  
  const reset = () => {
    stopRecording();
    selectedScreenSource.value = null;
    selectedWebcamSource.value = null;
    selectedMicrophoneSource.value = null;
    audioLevel.value = 0;
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
    recordingDurationFormatted,
    isApproachingLimit,
    
    // Actions
    startRecording,
    stopRecording,
    updateDuration,
    setPermissions,
    setAvailableScreenSources,
    setAvailableWebcamSources,
    setAvailableMicrophoneSources,
    setSelectedScreenSource,
    setSelectedWebcamSource,
    setSelectedMicrophoneSource,
    updateAudioLevel,
    setDiskSpace,
    setError,
    clearError,
    reset
  };
});
