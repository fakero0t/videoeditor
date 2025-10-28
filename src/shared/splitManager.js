import { generateId } from './utils/videoUtils';

class SplitManager {
  constructor(timelineStore, clipSelectionManager) {
    this.timelineStore = timelineStore;
    this.clipSelectionManager = clipSelectionManager;
  }

  // Execute split operation at current playhead position
  splitAtPlayhead() {
    const playheadTime = this.timelineStore.playheadPosition;
    
    // Find all clips at playhead position (may be multiple tracks)
    const clipsToSplit = this.findClipsAtPlayhead(playheadTime);
    
    if (clipsToSplit.length === 0) {
      console.warn('No clips at playhead position');
      return false;
    }
    
    // Split each clip (usually just one unless multi-track)
    const newClips = [];
    
    clipsToSplit.forEach(({ clip, trackId }) => {
      const { leftClip, rightClip } = this.splitClip(clip, playheadTime);
      
      if (leftClip && rightClip) {
        // Replace original clip with two new clips
        this.replaceClipWithSplit(trackId, clip, leftClip, rightClip);
        newClips.push(rightClip);
      }
    });
    
    // Select the right clips (per requirements)
    this.clipSelectionManager.clearSelection();
    newClips.forEach(clip => {
      this.clipSelectionManager.selectClip(clip.id, true);
    });
    
    // Update timeline
    this.timelineStore.updateTimelineDuration();
    this.timelineStore.markDirty();
    
    return true;
  }

  // Find clips that intersect with playhead
  findClipsAtPlayhead(playheadTime) {
    const clipsAtPlayhead = [];
    
    this.timelineStore.tracks.forEach(track => {
      track.clips.forEach(clip => {
        // Check if playhead is within clip boundaries
        if (playheadTime > clip.startTime && playheadTime < clip.startTime + clip.duration) {
          clipsAtPlayhead.push({ clip, trackId: track.id });
        }
      });
    });
    
    return clipsAtPlayhead;
  }

  // Split a clip into two clips at the specified time
  splitClip(originalClip, splitTime) {
    // Validate split position
    if (splitTime <= originalClip.startTime || splitTime >= originalClip.startTime + originalClip.duration) {
      console.warn('Invalid split position');
      return { leftClip: null, rightClip: null };
    }
    
    // Calculate split position relative to original clip
    const relativeTime = splitTime - originalClip.startTime;
    
    // Create left clip (from start to split point)
    const leftClip = this.createSplitClip(
      originalClip,
      originalClip.startTime,
      relativeTime,
      'left'
    );
    
    // Create right clip (from split point to end)
    const rightClip = this.createSplitClip(
      originalClip,
      splitTime,
      originalClip.duration - relativeTime,
      'right',
      relativeTime
    );
    
    return { leftClip, rightClip };
  }

  // Create a new clip from split operation
  createSplitClip(originalClip, startTime, duration, side, offset = 0) {
    const originalTrimStart = originalClip.trimStart || 0;
    const originalTrimEnd = originalClip.trimEnd || originalClip.sourceDuration || originalClip.duration;
    
    // Calculate new trim values based on split
    let newTrimStart, newTrimEnd;
    
    if (side === 'left') {
      // Left clip keeps original trim start
      newTrimStart = originalTrimStart;
      newTrimEnd = originalTrimStart + duration;
    } else {
      // Right clip adjusts trim start by the offset
      newTrimStart = originalTrimStart + offset;
      newTrimEnd = originalTrimEnd;
    }
    
    // Create new clip with preserved properties
    const newClip = {
      id: generateId(),
      trackId: originalClip.trackId,
      mediaFileId: originalClip.mediaFileId,
      startTime,
      duration,
      filePath: originalClip.filePath,
      fileName: originalClip.fileName,
      
      // Source metadata (preserved)
      sourceDuration: originalClip.sourceDuration,
      width: originalClip.width,
      height: originalClip.height,
      
      // Trim information (PRESERVED from parent)
      trimStart: newTrimStart,
      trimEnd: newTrimEnd,
      
      // Visual properties
      color: originalClip.color,
      
      // Metadata about split (optional, for debugging)
      splitFrom: originalClip.id,
      splitSide: side
    };
    
    return newClip;
  }

  // Replace original clip with two split clips in timeline
  replaceClipWithSplit(trackId, originalClip, leftClip, rightClip) {
    const track = this.timelineStore.tracks.find(t => t.id === trackId);
    if (!track) return;
    
    // Find index of original clip
    const clipIndex = track.clips.findIndex(c => c.id === originalClip.id);
    if (clipIndex === -1) return;
    
    // Remove original clip and insert two new clips
    // Important: maintain the same order/position
    track.clips.splice(clipIndex, 1, leftClip, rightClip);
  }

  // Validate if split is possible at current playhead
  canSplitAtPlayhead() {
    const playheadTime = this.timelineStore.playheadPosition;
    const clips = this.findClipsAtPlayhead(playheadTime);
    
    return clips.length > 0;
  }

  // Get split preview information (for UI feedback)
  getSplitPreview() {
    const playheadTime = this.timelineStore.playheadPosition;
    const clips = this.findClipsAtPlayhead(playheadTime);
    
    if (clips.length === 0) {
      return null;
    }
    
    return clips.map(({ clip, trackId }) => {
      const relativeTime = playheadTime - clip.startTime;
      return {
        clipId: clip.id,
        trackId,
        splitPosition: playheadTime,
        leftDuration: relativeTime,
        rightDuration: clip.duration - relativeTime,
        clipName: clip.fileName
      };
    });
  }
}

export default SplitManager;
