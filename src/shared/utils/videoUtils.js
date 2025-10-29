export const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  
  return `${size.toFixed(2)} ${sizes[i]}`;
};

export const getVideoCodecName = (codec) => {
  const codecNames = {
    'h264': 'H.264/AVC',
    'hevc': 'H.265/HEVC',
    'vp8': 'VP8',
    'vp9': 'VP9',
    'av1': 'AV1',
    'mpeg4': 'MPEG-4',
    'mjpeg': 'Motion JPEG'
  };
  return codecNames[codec.toLowerCase()] || codec.toUpperCase();
};

export const isVideoFile = (filename) => {
  const videoExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.mpg', '.mpeg'];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return videoExtensions.includes(ext);
};

export const isAudioFile = (filename) => {
  const audioExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.flac', '.wma', '.aiff'];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return audioExtensions.includes(ext);
};

export const generateId = () => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
