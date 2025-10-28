// Export Assembler
// Builds FFmpeg inputs and filter_complex to flatten video to the highest visible track
// and mix audio from all tracks, inserting black video and silence for gaps.

import ffmpegService from '../../shared/ffmpegService';

const RESOLUTION_MAP = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
  '4k': { width: 3840, height: 2160 }
};

/**
 * Compute unique sorted boundaries (seconds) from tracks' clips
 */
function computeBoundaries(tracks) {
  const points = new Set();
  tracks.forEach((track) => {
    track.clips.forEach((clip) => {
      points.add(clip.startTime);
      points.add(clip.startTime + clip.duration);
    });
  });
  return Array.from(points).sort((a, b) => a - b);
}

/**
 * For interval [S,E), find the topmost active video clip and all active audio clips
 */
function findActiveClipsForInterval(tracks, S, E) {
  let videoClip = null;
  // Highest visible track = last index in tracks array
  for (let t = tracks.length - 1; t >= 0; t -= 1) {
    const track = tracks[t];
    const c = track.clips.find(
      (clip) => clip.startTime < E && clip.startTime + clip.duration > S
    );
    if (c) {
      videoClip = c;
      break;
    }
  }

  const audioClips = [];
  tracks.forEach((track) => {
    track.clips.forEach((clip) => {
      if (clip.startTime < E && clip.startTime + clip.duration > S) {
        audioClips.push(clip);
      }
    });
  });

  return { videoClip, audioClips };
}

function buildInputMap(tracks) {
  const pathToIndex = new Map();
  const inputs = [];
  tracks.forEach((track) => {
    track.clips.forEach((clip) => {
      if (!pathToIndex.has(clip.filePath)) {
        const index = inputs.length;
        pathToIndex.set(clip.filePath, index);
        inputs.push({ path: clip.filePath });
      }
    });
  });
  return { inputs, pathToIndex };
}

async function deriveGraphDimensionsAndFps(tracks, options) {
  // Resolution
  let width = 1920;
  let height = 1080;
  if (options.resolution && options.resolution !== 'source') {
    const res = RESOLUTION_MAP[options.resolution];
    if (res) {
      width = res.width;
      height = res.height;
    }
  } else {
    // Try to use first clip's stored dimensions if present
    for (const track of tracks) {
      const clip = track.clips[0];
      if (clip && clip.width && clip.height) {
        width = clip.width;
        height = clip.height;
        break;
      }
    }
  }

  // FPS for graph sources (color/anullsrc)
  let fpsForGraph = 30;
  if (options.fps && options.fps !== 'source') {
    fpsForGraph = parseInt(options.fps, 10) || 30;
  } else {
    // Derive from first available media via ffprobe
    let firstPath = null;
    for (const track of tracks) {
      if (track.clips.length > 0) {
        firstPath = track.clips[0].filePath;
        break;
      }
    }
    if (firstPath) {
      try {
        const info = await ffmpegService.getVideoInfo(firstPath);
        if (info && info.frameRate) {
          fpsForGraph = Math.round(info.frameRate) || 30;
        }
      } catch (_) {
        // Fallback to 30
      }
    }
  }

  return { width, height, fpsForGraph };
}

function sec(n) {
  return Math.max(0, Number(n) || 0);
}

/**
 * Compute source-relative trim window for a clip in [S,E)
 */
function clipSourceWindow(clip, S, E) {
  const inOffset = sec(S - clip.startTime);
  const outOffset = sec(E - clip.startTime);
  const sourceStart = sec(clip.trimStart + inOffset);
  const sourceEnd = Math.min(sec(clip.trimEnd), sec(clip.trimStart + outOffset));
  const duration = Math.max(0, sourceEnd - sourceStart);
  return { sourceStart, sourceEnd, duration };
}

/**
 * Build simple filter graph for basic multi-clip export
 */
function buildFilter(tracks, inputsMap, options, dims) {
  const { pathToIndex } = inputsMap;
  const { width, height, fpsForGraph } = dims;
  const filterParts = [];
  const intervals = [];

  // Find the highest track with video clips
  let videoTrack = null;
  for (let i = tracks.length - 1; i >= 0; i--) {
    if (tracks[i].clips.length > 0) {
      videoTrack = tracks[i];
      break;
    }
  }

  if (!videoTrack || videoTrack.clips.length === 0) {
    return { filterComplex: '', intervals: [] };
  }

  // Collect all video clips from the top track
  const videoClips = videoTrack.clips.sort((a, b) => a.startTime - b.startTime);
  const videoLabels = [];
  const audioLabels = [];

  // Process each video clip
  videoClips.forEach((clip, idx) => {
    const srcIndex = pathToIndex.get(clip.filePath);
    const videoLabel = `v_${idx + 1}`;
    const audioLabel = `a_${idx + 1}`;
    
    // Video trim and setpts
    filterParts.push(
      `[${srcIndex}:v]trim=start=${clip.trimStart}:end=${clip.trimEnd},setpts=PTS-STARTPTS[${videoLabel}]`
    );
    
    // Audio trim and setpts
    filterParts.push(
      `[${srcIndex}:a]atrim=start=${clip.trimStart}:end=${clip.trimEnd},asetpts=PTS-STARTPTS[${audioLabel}]`
    );
    
    videoLabels.push(`[${videoLabel}]`);
    audioLabels.push(`[${audioLabel}]`);
  });

  if (videoLabels.length === 0) {
    return { filterComplex: '', intervals: [] };
  }

  // Concatenate video clips
  filterParts.push(
    `${videoLabels.join('')}concat=n=${videoLabels.length}:v=1:a=0[v_cat]`
  );

  // Mix audio from all clips
  if (audioLabels.length > 0) {
    filterParts.push(
      `${audioLabels.join('')}amix=inputs=${audioLabels.length}:normalize=1:dropout_transition=0,aresample=async=1[a_cat]`
    );
  } else {
    // Generate silence if no audio
    const totalDuration = videoClips.reduce((sum, clip) => sum + (clip.trimEnd - clip.trimStart), 0);
    filterParts.push(
      `anullsrc=r=48000:cl=stereo:d=${totalDuration.toFixed(6)}[a_cat]`
    );
  }

  // Scale video if explicit resolution requested
  if (options.resolution && options.resolution !== 'source') {
    filterParts.push(`[v_cat]scale=${width}:${height}[v_out]`);
  } else {
    filterParts.push(`[v_cat]null[v_out]`);
  }

  // Copy audio
  filterParts.push(`[a_cat]acopy[a_out]`);

  const filterComplex = filterParts.join(';');
  return { filterComplex, intervals: [] };
}

export async function buildExportPlan(tracks, options) {
  const { inputs, pathToIndex } = buildInputMap(tracks);
  const dims = await deriveGraphDimensionsAndFps(tracks, options);
  const { filterComplex } = buildFilter(tracks, { pathToIndex }, options, dims);

  // Frame rate handling: if 'source', do not set -r (null), else numeric
  const frameRate = options.fps && options.fps !== 'source' ? parseInt(options.fps, 10) : null;

  return {
    inputs,
    filterComplex,
    frameRate,
    resolution: options.resolution || 'source',
    quality: options.quality || 'medium',
    output: options.output
  };
}

export default { buildExportPlan };


