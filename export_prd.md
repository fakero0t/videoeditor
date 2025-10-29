# Export Button Feature PRD

## Overview
This document outlines the requirements and implementation plan for ensuring the Export button is fully functional and properly styled within the existing ClipForge/VoiceForge video editor application. The Export button already exists in the codebase but needs to be verified, potentially refined, and fully styled to match the Windows 95-inspired retro UI theme.

## Current State Analysis

### Existing Implementation
The export functionality is **already implemented** with the following components:

1. **Export Button Location**: `TransportControls.vue` (line 36-42)
   - Currently placed in the transport controls bar at the bottom
   - Disabled when no clips are on timeline
   - Keyboard shortcut: Cmd/Ctrl+E

2. **Export Dialog**: `ExportDialog.vue` (fully implemented)
   - Modal dialog with export settings
   - Resolution options: Source, 720p, 1080p, 1440p, 4K
   - FPS options: Source, 30
   - Quality options: Low, Medium, High, Ultra
   - Output file selection via browse dialog
   - Progress bar during export
   - Cancel functionality

3. **Export Service**: `exportAssembler.js` (fully implemented)
   - Builds FFmpeg filter graphs
   - Handles multi-track compositing
   - Processes video trimming and audio mixing
   - Supports custom resolution and quality settings

4. **FFmpeg Integration**: `ffmpegService.js` and `ffmpegHandler.js`
   - Handles video encoding via FFmpeg
   - Progress tracking and reporting
   - Export cancellation support

### Current Issues to Address

1. **Styling Inconsistency**: The ExportDialog uses a dark, modern theme that doesn't match the Windows 95 retro aesthetic of the rest of the application
2. **Button Styling**: Export button uses generic `.stop-btn` class instead of a distinct style
3. **Visual Hierarchy**: Export button doesn't stand out as a primary action

## Requirements

### Functional Requirements

#### FR1: Export Button Visibility and Placement
- **Current**: Export button is in `TransportControls.vue` alongside play/pause/stop
- **Status**: ✅ CORRECT - This is the appropriate location
- **Action**: Keep existing placement, improve visual styling only

#### FR2: Export Dialog
- **Current**: Modal dialog with all necessary export settings
- **Status**: ✅ FUNCTIONAL - Dialog works correctly
- **Action**: Restyle to match Windows 95 theme

#### FR3: Resolution Options
- **Required**: 720p, 1080p, Source resolution
- **Current**: Source, 720p, 1080p, 1440p, 4K
- **Status**: ✅ EXCEEDS REQUIREMENTS
- **Action**: Keep existing options (more is better)

#### FR4: Progress Indicator
- **Required**: Show progress during export
- **Current**: Progress bar with percentage, FPS, and current time
- **Status**: ✅ FUNCTIONAL
- **Action**: Restyle progress bar to match Windows 95 theme

#### FR5: Save to Local Filesystem
- **Required**: Allow user to choose output location
- **Current**: File dialog for output selection
- **Status**: ✅ FUNCTIONAL
- **Action**: No changes needed (system dialog used)

#### FR6: Timeline Export
- **Required**: Export what is shown on timeline
- **Current**: Exports all tracks with compositing
- **Status**: ✅ FUNCTIONAL
- **Action**: No changes needed

### Non-Functional Requirements

#### NFR1: Performance
- Export should not block UI completely (currently handled via IPC)
- Progress updates should be smooth (currently implemented)

#### NFR2: Error Handling
- Show meaningful error messages on export failure
- Handle insufficient disk space gracefully
- Allow retry on failure

#### NFR3: User Experience
- Export button disabled when timeline is empty ✅
- Keyboard shortcut (Cmd/Ctrl+E) available ✅
- Visual feedback during export ✅
- Can cancel export mid-process ✅

## Design Specifications

### Export Button Styling (Windows 95 Theme)

The export button should match the existing Windows 95 aesthetic used throughout the app:

```scss
.export-btn {
  @include d3-object;
  @include font;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 11px;
  min-width: 60px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-weight: bold;
  
  &:hover:not(:disabled) {
    background: #d0d0d0;
  }
  
  &:active:not(:disabled) {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
  
  &:disabled {
    @include font-color('font-disabled');
    cursor: not-allowed;
  }
}
```

### Export Dialog Styling (Windows 95 Theme)

The export dialog should be restyled to match the Windows 95 window aesthetic:

```scss
.export-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.export-modal {
  @include d3-window;
  width: 420px;
  @include background-color('inputs-bg');
  padding: 2px;
}

.export-header {
  @include d3-window;
  @include background-color('header-bg');
  @include font-color('header-font-color');
  padding: 4px 8px;
  font-weight: bold;
  font-size: 11px;
  margin-bottom: 2px;
}

.export-content {
  padding: 8px;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.form-row label {
  @include font-color('font-color');
  font-size: 11px;
  min-width: 80px;
}

select, input[type="text"] {
  @include background-color('inputs-bg');
  @include font-color('font-color');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  padding: 2px 4px;
  font-size: 11px;
  font-family: $font-family;
  width: 200px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid;
  @include border-color-tl('content-border-left');
}

button {
  @include d3-object;
  @include font;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 11px;
  min-width: 75px;
  height: 24px;
  
  &:hover:not(:disabled) {
    background: #d0d0d0;
  }
  
  &:active:not(:disabled) {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
  
  &:disabled {
    @include font-color('font-disabled');
    cursor: not-allowed;
  }
}
```

### Progress Bar Styling (Windows 95 Theme)

```scss
.progress {
  margin-top: 8px;
  margin-bottom: 8px;
}

.progress-label {
  @include font-color('font-color');
  font-size: 11px;
  margin-bottom: 4px;
}

.progress-bar {
  height: 20px;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  @include background-color('inputs-bg');
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: repeating-linear-gradient(
    45deg,
    #000080,
    #000080 10px,
    #0000a0 10px,
    #0000a0 20px
  );
  transition: width 0.3s ease;
}

.progress-text {
  @include font-color('font-color');
  font-size: 11px;
  margin-top: 4px;
  font-family: 'Courier New', monospace;
}

.error {
  @include font-color('font-color');
  font-size: 11px;
  padding: 4px 8px;
  margin-bottom: 8px;
  border: 1px solid #ff0000;
  background: #ffcccc;
  color: #cc0000;
}
```

## Implementation Plan

### Phase 1: Verify Existing Functionality (No Code Changes)
**Goal**: Ensure all export features work correctly

**Tasks**:
1. Test export button activation/deactivation
2. Test export dialog opening (Cmd/Ctrl+E shortcut)
3. Test all resolution options
4. Test quality settings
5. Test file output selection
6. Test export progress tracking
7. Test export cancellation
8. Test error handling

**Expected Outcome**: Confirm all features work as designed

### Phase 2: Update Export Button Styling
**Goal**: Make export button match Windows 95 theme

**Files to Modify**:
- `src/renderer/components/TransportControls.vue`

**Changes**:
1. Change export button class from `.stop-btn` to `.export-btn`
2. Add emoji icon (💾 or 📤) to match other buttons
3. Add new `.export-btn` styles to match theme
4. Ensure proper spacing and alignment

**Code Changes**:
```vue
<!-- TransportControls.vue template -->
<button 
  @click="openExport" 
  :disabled="!hasClips"
  class="export-btn"
  title="Export Timeline (Ctrl+E)"
>
  <span class="icon">💾</span> Export
</button>
```

### Phase 3: Restyle Export Dialog
**Goal**: Make export dialog match Windows 95 theme

**Files to Modify**:
- `src/renderer/components/ExportDialog.vue`

**Changes**:
1. Replace dark modern theme with Windows 95 aesthetic
2. Update modal window styling with 3D borders
3. Add proper header bar with title
4. Update form controls styling (selects, inputs, buttons)
5. Restyle progress bar with diagonal stripes
6. Update error message styling
7. Ensure proper spacing and alignment

**Specific Updates**:
```vue
<!-- ExportDialog.vue structure -->
<div class="export-backdrop">
  <div class="export-modal">
    <div class="export-header">
      <span>Export Timeline</span>
    </div>
    <div class="export-content">
      <!-- Form rows -->
      <!-- Progress indicator -->
      <!-- Actions -->
    </div>
  </div>
</div>
```

### Phase 4: Testing and Refinement
**Goal**: Ensure everything works and looks correct

**Tasks**:
1. Visual inspection of export button in transport controls
2. Visual inspection of export dialog appearance
3. Test export with various settings
4. Test progress bar appearance during export
5. Test error state styling
6. Cross-platform testing (if applicable)
7. Verify keyboard shortcuts still work
8. Verify button states (disabled, hover, active)

### Phase 5: Documentation
**Goal**: Document the export feature for users and developers

**Tasks**:
1. Update user-facing documentation (if any)
2. Ensure code comments are clear
3. Document keyboard shortcut in help menu (if exists)

## Risk Assessment

### Low Risk Items ✅
- Export button already exists and works
- Export dialog already exists and works
- FFmpeg integration already functional
- File saving already works
- Progress tracking already implemented

### Medium Risk Items ⚠️
- Styling changes might require testing across different screen sizes
- Windows 95 theme consistency needs careful attention to detail
- Progress bar animation might need performance consideration

### High Risk Items ❌
- **None identified** - All core functionality already exists

## Success Criteria

### Must Have ✅
1. Export button is visible and styled to match Windows 95 theme
2. Export button is disabled when timeline is empty
3. Export dialog opens on button click and Cmd/Ctrl+E
4. Export dialog matches Windows 95 aesthetic completely
5. Resolution options include 720p, 1080p, and Source
6. User can select output file location
7. Progress bar displays during export
8. Export produces valid MP4 file
9. Can cancel export mid-process
10. Error messages display clearly

### Nice to Have 🎯
1. Estimated time remaining during export (currently showing FPS and time)
2. Recently used export settings remembered
3. Default export location configuration
4. Batch export support (future)

## Testing Plan

### Unit Tests
- Verify export button disabled state logic
- Test resolution calculation logic
- Test FFmpeg configuration generation

### Integration Tests
- Test complete export flow from button click to file creation
- Test export cancellation at various stages
- Test error scenarios (disk full, invalid path, etc.)

### UI/UX Tests
- Visual regression testing for Windows 95 theme compliance
- Button state testing (normal, hover, active, disabled)
- Dialog layout testing at different window sizes
- Progress bar animation smoothness

### Acceptance Tests
1. Click export button → Dialog opens
2. Select 1080p → FFmpeg uses 1920x1080
3. Select output path → File saves to chosen location
4. Monitor progress → Progress bar updates smoothly
5. Cancel export → Process stops, no partial file
6. Export completes → Valid MP4 file created
7. Export with empty timeline → Button is disabled

## Timeline Estimate

- **Phase 1** (Verification): Already completed in analysis
- **Phase 2** (Button Styling): 30 minutes
- **Phase 3** (Dialog Restyling): 1-2 hours
- **Phase 4** (Testing): 1 hour
- **Phase 5** (Documentation): 30 minutes

**Total Estimated Time**: 3-4 hours

## Dependencies

### Existing Dependencies (Already Satisfied)
- FFmpeg binary available in app
- Electron IPC for main/renderer communication
- File system access permissions
- Video codec support

### No New Dependencies Required
All functionality exists; only styling changes needed.

## Future Enhancements

### Not in Current Scope
1. Hardware-accelerated encoding
2. Additional export formats (WebM, AVI, etc.)
3. Custom codec selection
4. Two-pass encoding for better quality
5. Batch export multiple ranges
6. Export presets (YouTube, Vimeo, etc.)
7. Audio-only export
8. Export queue system
9. Background export while continuing to edit
10. Cloud export/upload integration

## Conclusion

The export functionality is **fully implemented and functional**. This PRD focuses on:
1. Verifying existing functionality works correctly
2. Updating visual styling to match the Windows 95 theme
3. Ensuring consistency with the rest of the application UI

No new features or functionality need to be added. This is purely a styling and polish task to ensure the export button and dialog feel like a natural part of the retro-themed interface.

