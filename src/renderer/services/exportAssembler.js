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
 * Build filter graph according to plan
 */
function buildFilter(tracks, inputsMap, options, dims) {
  const boundaries = computeBoundaries(tracks);
  if (boundaries.length < 2) {
    return { filterComplex: '', intervals: [] };
  }

  const { pathToIndex } = inputsMap;
  const { width, height, fpsForGraph } = dims;
  const filterParts = [];
  const intervals = [];

  let concatInputsVideo = [];
  let concatInputsAudio = [];

  let intervalCount = 0;
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const S = boundaries[i];
    const E = boundaries[i + 1];
    if (E - S <= 0) continue;

    const { videoClip, audioClips } = findActiveClipsForInterval(tracks, S, E);
    const intervalLabelV = `v_${i + 1}`;
    const intervalLabelA = `a_mix_${i + 1}`;

    // Video for this interval
    if (videoClip) {
      const srcIndex = pathToIndex.get(videoClip.filePath);
      const { sourceStart, sourceEnd, duration } = clipSourceWindow(videoClip, S, E);
      if (duration > 0) {
        filterParts.push(
          `[${srcIndex}:v]trim=start=${sourceStart}:end=${sourceEnd},setpts=PTS-STARTPTS[${intervalLabelV}]`
        );
      } else {
        // Fallback to black if degenerate
        filterParts.push(
          `color=c=black:size=${width}x${height}:rate=${fpsForGraph}:d=${(E - S).toFixed(6)}[${intervalLabelV}]`
        );
      }
    } else {
      // Gap → black frames
      filterParts.push(
        `color=c=black:size=${width}x${height}:rate=${fpsForGraph}:d=${(E - S).toFixed(6)}[${intervalLabelV}]`
      );
    }

    // Audio for this interval
    const audioLabels = [];
    if (audioClips.length > 0) {
      audioClips.forEach((clip, idx) => {
        const srcIndex = pathToIndex.get(clip.filePath);
        const { sourceStart, sourceEnd, duration } = clipSourceWindow(clip, S, E);
        if (duration <= 0) return;
        const lab = `a_${i + 1}_${idx + 1}`;
        filterParts.push(
          `[${srcIndex}:a]atrim=start=${sourceStart}:end=${sourceEnd},asetpts=PTS-STARTPTS[${lab}]`
        );
        audioLabels.push(`[${lab}]`);
      });
    }

    if (audioLabels.length === 0) {
      // Silence for gap
      const sl = `a_${i + 1}_silence`;
      filterParts.push(
        `anullsrc=r=48000:cl=stereo:d=${(E - S).toFixed(6)}[${sl}]`
      );
      audioLabels.push(`[${sl}]`);
    }

    // Mix interval audio (normalize to avoid clipping)
    filterParts.push(
      `${audioLabels.join('')}amix=inputs=${audioLabels.length}:normalize=1:dropout_transition=0,aresample=async=1[${intervalLabelA}]`
    );

    concatInputsVideo.push(`[${intervalLabelV}]`);
    concatInputsAudio.push(`[${intervalLabelA}]`);
    intervals.push({ start: S, end: E });
    intervalCount += 1;
  }

  if (intervalCount === 0) {
    return { filterComplex: '', intervals: [] };
  }

  // Concat all intervals
  filterParts.push(
    `${concatInputsVideo.join('')}${concatInputsAudio.join('')}concat=n=${intervalCount}:v=1:a=1[v_cat][a_out]`
  );

  // Scale if explicit resolution requested
  if (options.resolution && options.resolution !== 'source') {
    filterParts.push(`[v_cat]scale=${width}:${height}[v_out]`);
  } else {
    filterParts.push(`[v_cat]copy[v_out]`);
  }

  const filterComplex = filterParts.join(';');
  return { filterComplex, intervals };
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


