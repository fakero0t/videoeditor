class ClipSelectionManager {
  constructor(timelineStore) {
    this.timelineStore = timelineStore;
    this.selectedClips = new Set();
  }

  // Select a single clip
  selectClip(clipId, addToSelection = false) {
    if (!addToSelection) {
      this.clearSelection();
    }
    this.selectedClips.add(clipId);
    this.timelineStore.selectClip(clipId, addToSelection);
    this.timelineStore.markDirty(); // Trigger re-render
  }

  // Deselect a clip
  deselectClip(clipId) {
    this.selectedClips.delete(clipId);
    const index = this.timelineStore.selectedClips.indexOf(clipId);
    if (index > -1) {
      this.timelineStore.selectedClips.splice(index, 1);
    }
    this.timelineStore.markDirty();
  }

  // Clear all selections
  clearSelection() {
    this.selectedClips.clear();
    this.timelineStore.clearSelection();
    this.timelineStore.markDirty(); // Trigger re-render
  }

  // Check if clip is selected
  isSelected(clipId) {
    return this.selectedClips.has(clipId);
  }


  // Delete selected clips
  deleteSelectedClips() {
    this.selectedClips.forEach(clipId => {
      this.timelineStore.removeClip(clipId);
    });
    this.clearSelection();
  }

  // Get selected clip IDs
  getSelectedClipIds() {
    return Array.from(this.selectedClips);
  }

  // Toggle selection of a clip
  toggleSelection(clipId) {
    if (this.isSelected(clipId)) {
      this.deselectClip(clipId);
    } else {
      this.selectClip(clipId, true);
    }
  }

  // Select all clips
  selectAll() {
    this.clearSelection();
    this.timelineStore.tracks.forEach(track => {
      track.clips.forEach(clip => {
        this.selectClip(clip.id, true);
      });
    });
  }
}

export default ClipSelectionManager;
