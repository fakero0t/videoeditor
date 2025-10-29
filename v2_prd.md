# ClipForge V2 - Product Requirements Document

## 1. Executive Summary

### 1.1 Product Vision

ClipForge V2 builds upon the streamlined video editor with powerful native recording capabilities, enhanced timeline navigation, and project persistence. This version enables users to record screen content, webcam footage, or both simultaneously, then edit and export professional videos without leaving the application.

### 1.2 Key Enhancements

- **Native Recording**: Screen capture, webcam recording, and simultaneous picture-in-picture recording with audio
- **Enhanced Timeline Navigation**: Click-and-drag panning for easier navigation of long timelines
- **Project Persistence**: Save and load projects with portable media files
- **Improved Workflow**: Record → Import → Edit → Export all within ClipForge

### 1.3 Key Design Decisions

- **Recording Duration**: 2 hour maximum (auto-stops at 2:00:00)
- **Recording Format**: Auto-converts to MP4; falls back to WebM if conversion fails
- **Recording Panel**: Automatically minimizes to widget when recording starts
- **Permissions**: Pre-checked before recording with guided setup if denied
- **Disk Space**: Monitored during recording; auto-stops if < 500MB available
- **Timeline Panning**: Toggle button mode; resets to OFF on app launch
- **Project Portability**: Full - copies all media files to project folder
- **Unsaved Changes**: Tracks clip edits only (not zoom/playhead position)
- **PiP Webcam**: Fixed bottom-right corner at 25% screen width
- **Platform Handling**: Differences managed behind the scenes
- **Keyboard Shortcuts**: Current set sufficient (Spacebar, S, Del, H, Cmd/Ctrl+R)

### 1.4 Target Users

- Content creators recording tutorials and walkthroughs
- Educators creating screen-based instructional videos
- Streamers and gamers capturing gameplay with webcam overlay
- Anyone needing quick screen recording with basic editing

## 2. Feature Specifications

### 2.1 Timeline Navigation Enhancement

#### 2.1.1 Pan Mode Toggle

**Purpose**: Enable users to pan/scroll the timeline by clicking and dragging, especially useful for long timelines with many clips.

**UI Components**:
- Pan mode toggle button in timeline toolbar
- Icon: Hand/grab cursor icon
- Position: Next to zoom controls in timeline header
- Visual states: Active (highlighted) and inactive

**Behavior**:
- Click toggle button to enable pan mode
- While in pan mode:
  - Cursor changes to grab icon when hovering over timeline
  - Cursor changes to grabbing icon while dragging
  - Click and drag horizontally to scroll timeline
  - Clip selection and dragging are disabled
  - Playhead remains stationary during pan
- Click toggle again to disable pan mode and restore normal editing

**Implementation Requirements**:
- Store pan mode state in timeline store
- Prevent other drag operations while pan mode active
- Smooth scrolling with immediate visual feedback
- Keyboard shortcut: H key to toggle pan mode
- **Pan mode resets to OFF on app launch** (does not persist between sessions)

**Acceptance Criteria**:
- Pan mode toggles on/off with button click
- Timeline scrolls smoothly during drag
- No clips can be moved while in pan mode
- Cursor visual feedback is clear and responsive
- Pan mode persists until manually toggled off

---

### 2.2 Snap Behavior Verification & Enhancement

#### 2.2.1 Snap-to-Grid

**Purpose**: Clips snap to regular time intervals for precise alignment.

**Behavior**:
- Grid intervals based on zoom level (e.g., 1 second, 5 seconds, 10 seconds)
- Visual grid lines drawn on timeline canvas
- Clips snap to nearest grid line when dragged within snap threshold (10 pixels)
- Toggle on/off via existing GridSnapToggle component

**Acceptance Criteria**:
- Grid lines visible on timeline
- Clips magnetically snap to grid lines during drag
- Snap toggle works correctly
- Snap distance is 10 pixels (configurable in code)

#### 2.2.2 Snap-to-Clip Edges

**Purpose**: Clips snap to adjacent clip boundaries for seamless sequences.

**Behavior**:
- When dragging a clip near another clip's start or end edge, magnetic snap occurs
- Snap threshold: 10 pixels
- Visual indicator (subtle highlight) when snap will occur
- Works for clips on same track and adjacent tracks

**Acceptance Criteria**:
- Clips snap to adjacent clip edges
- Visual feedback during snap
- No gaps created when snapping clips together
- Snap works for both start and end edges

---

### 2.3 Project Save/Load

#### 2.3.1 Project File Format

**File Structure**:
- Project file: `.cfproj` (JSON format)
- Media folder: `[projectname]_media/` containing copies of all referenced video files
- Both stored in same directory chosen by user

**JSON Schema**:
```json
{
  "version": "2.0",
  "projectName": "My Video Project",
  "created": "2025-10-29T12:00:00Z",
  "modified": "2025-10-29T14:30:00Z",
  "timeline": {
    "duration": 120,
    "playheadPosition": 0,
    "zoomLevel": 1,
    "tracks": [
      {
        "id": "track-1",
        "name": "Track 1",
        "height": 100,
        "clips": [
          {
            "id": "clip-abc123",
            "trackId": "track-1",
            "mediaFileId": "media-xyz789",
            "fileName": "video1.mp4",
            "filePath": "./[projectname]_media/video1.mp4",
            "startTime": 0,
            "duration": 10.5,
            "trimStart": 2.0,
            "trimEnd": 12.5,
            "sourceDuration": 15.0,
            "width": 1920,
            "height": 1080,
            "color": "#3b82f6"
          }
        ]
      }
    ]
  },
  "media": [
    {
      "id": "media-xyz789",
      "fileName": "video1.mp4",
      "originalPath": "/Users/john/Videos/video1.mp4",
      "projectPath": "./[projectname]_media/video1.mp4",
      "duration": 15.0,
      "width": 1920,
      "height": 1080,
      "size": 25600000,
      "thumbnail": "./[projectname]_media/.thumbnails/video1.jpg"
    }
  ]
}
```

#### 2.3.2 Save Project

**UI Flow**:
1. User clicks "Save Project" button in top toolbar
2. If new project (never saved), show save dialog
3. User chooses directory and enters project name
4. Application creates:
   - `[projectname].cfproj` file
   - `[projectname]_media/` folder
5. Copies all media files to media folder
6. Copies all thumbnail files
7. Saves project JSON
8. Shows progress indicator during file copying
9. Displays success message

**Save As**:
- "Save As" option creates new project copy with new name
- Copies all media files to new location
- Original project remains unchanged

**Auto-Save**:
- Not implemented in V2 (future enhancement)
- User must manually save

**Acceptance Criteria**:
- Project saves successfully with all media files copied
- Project file is valid JSON
- Media folder contains all referenced video files
- Saved project can be moved to different computer and still works
- Progress indicator shows during save operation
- Error handling for disk space issues

#### 2.3.3 Load Project

**UI Flow**:
1. User clicks "Load Project" button
2. Shows file picker filtered to `.cfproj` files
3. User selects project file
4. Application:
   - Clears current timeline
   - Loads project JSON
   - Verifies media folder exists
   - Imports all media files from project folder
   - Rebuilds timeline state
   - Generates thumbnails if missing
5. Displays success message or errors if media files missing

**Unsaved Changes Warning**:
- Before loading new project, check if current project has unsaved changes
- Show confirmation dialog: "You have unsaved changes. Do you want to save before loading?"
- Options: Save and Load, Don't Save, Cancel

**Unsaved Changes Definition**:
- Tracked changes: Add clip, remove clip, move clip, trim clip, split clip, change track
- NOT tracked: Zoom level changes, playhead position changes, scroll position

**Acceptance Criteria**:
- Project loads correctly with all clips in correct positions
- All trim and split operations preserved
- Media files load from project media folder
- Playhead position restored
- Zoom level restored
- Warning shown if current project has unsaved changes

#### 2.3.4 New Project

**UI Flow**:
1. User clicks "New Project" button
2. If current project has unsaved changes, show warning dialog
3. Clears timeline (removes all clips)
4. Clears media library
5. Resets playhead to 0
6. Resets zoom to default
7. Marks project as new/unsaved

**Acceptance Criteria**:
- New project starts with clean slate
- No clips or media remain from previous project
- Timeline state fully reset
- Warning shown if current project has unsaved changes

---

### 2.4 Native Recording - Screen Capture

#### 2.4.1 Recording Panel UI

**Appearance**:
- Modal dialog that overlays main interface
- Collapsible/draggable panel
- Three tabs: "Screen", "Webcam", "Screen + Webcam"
- Minimize button to collapse to small floating widget
- Close button to dismiss panel

**Position**:
- Centered on screen when first opened
- Draggable by title bar
- Position persists during session

**Opening the Panel**:
- Record button in top toolbar (red circle icon)
- Keyboard shortcut: Cmd+R (Mac) / Ctrl+R (Windows)

#### 2.4.2 Screen Recording Tab

**Source Selection**:
- Dropdown list of available sources:
  - "Entire Screen" (all displays listed separately if multiple monitors)
  - Individual application windows (with app icons and window titles)
- Preview thumbnail of selected source
- Refresh button to update source list

**Recording Controls**:
- Record button (large, red)
- Timer display showing recording duration (00:00)
- Audio source selection:
  - Microphone dropdown (lists available audio input devices)
  - System audio checkbox (if available on platform)
  - Audio level meter (visual indicator during recording)
- Quality preset dropdown:
  - "High (1080p)" - default
  - "Medium (720p)"
  - "Low (480p)"
- **Recording Duration Limit**: 2 hours maximum (auto-stops at 2:00:00)

**Recording Process**:
1. User selects screen/window source
2. User selects audio source(s)
3. Pre-check permissions:
   - Check screen recording permission (macOS)
   - Check microphone permission
   - If denied, show modal guiding user to System Preferences/Settings
   - Do not proceed until permissions granted
4. Check available disk space (warn if < 5GB available)
5. User clicks Record button
6. Recording starts:
   - Timer counts up (max 2:00:00)
   - Record button changes to Stop button (red square)
   - Audio level meter animates
   - **Panel automatically minimizes to small floating widget**
   - Widget shows: timer, stop button, audio level indicator
7. During recording:
   - Monitor disk space every 30 seconds
   - If disk space < 500MB, auto-stop recording and show warning
   - If 2 hour limit reached, auto-stop recording
8. User clicks Stop button (or auto-stopped)
9. Processing screen shown: "Processing recording..."
10. Recording is converted to MP4 (using FFmpeg)
11. If conversion fails: Keep WebM file and import it anyway, notify user
12. Recording auto-imported to media library
13. Success message: "Recording added to media library"

**Technical Implementation**:
- Use Electron `desktopCapturer.getSources()` to list sources
- Pass sourceId to `navigator.mediaDevices.getUserMedia()`
- Use MediaRecorder API to record stream
- Record as WebM initially (native format)
- After recording stops, use FFmpeg to convert to MP4
- Save to temp location, then copy to app's recordings folder
- Generate thumbnail and metadata
- Import to media library

**Acceptance Criteria**:
- Pre-checks permissions before recording starts
- Guides user to system settings if permissions denied
- Lists all available screens and windows
- Preview updates when source selection changes
- Recording captures selected source correctly
- Timer displays accurate duration (stops at 2:00:00 max)
- Panel automatically minimizes to widget when recording starts
- Monitors disk space during recording
- Auto-stops and warns if disk space critically low (< 500MB)
- Audio is captured from selected sources
- Recording is converted to MP4 successfully
- If MP4 conversion fails, imports WebM file instead
- Recording appears in media library after completion
- Widget shows timer, stop button, and audio level during recording

#### 2.4.3 Recording File Management

**Storage Location**:
- Recordings saved to app data directory: `~/ClipForge/Recordings/`
- Filename format: `Recording_YYYYMMDD_HHMMSS.mp4`

**Metadata**:
- Recording date/time
- Duration
- Resolution
- File size
- Source type (screen/webcam/both)

---

### 2.5 Native Recording - Webcam

#### 2.5.1 Webcam Recording Tab

**Device Selection**:
- Dropdown list of available video input devices (cameras)
- Refresh button to detect newly connected devices

**Live Preview**:
- Video preview showing webcam feed
- Preview maintains aspect ratio
- Resolution display (e.g., "1280x720")

**Recording Controls**:
- Same as screen recording:
  - Record/Stop button
  - Timer
  - Audio source (microphone) selection
  - Audio level meter
  - Quality preset

**Recording Process**:
- Same workflow as screen recording
- Uses `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`
- Captures webcam video + microphone audio
- Converts to MP4 after recording
- Imports to media library

**Acceptance Criteria**:
- Lists all available cameras
- Live preview shows webcam feed before recording
- Recording captures webcam correctly
- Audio from microphone is captured
- Recording saved as MP4 and imported to media library

---

### 2.6 Native Recording - Simultaneous Screen + Webcam (Picture-in-Picture)

#### 2.6.1 Screen + Webcam Tab

**Purpose**: Record screen content with webcam overlay in bottom-right corner, creating picture-in-picture effect during recording.

**Source Selection**:
- Screen/window source dropdown (same as screen recording)
- Webcam source dropdown (same as webcam recording)

**PiP Configuration**:
- **Webcam Position**: Fixed at bottom-right corner
- **Webcam Size**: 25% of screen width (configurable preset)
- **Offset**: 20px padding from edges
- Visual preview showing both streams composited

**Live Preview**:
- Composite preview showing screen with webcam overlay
- Preview updates in real-time as sources change
- Shows exactly how final recording will look

**Recording Controls**:
- Record/Stop button
- Timer
- Microphone selection (for webcam audio)
- System audio checkbox (for screen audio)
- Audio level meters (separate for mic and system audio)

**Recording Process**:
1. Capture screen stream using desktopCapturer
2. Capture webcam stream using getUserMedia
3. Create HTML canvas element
4. Composite streams on canvas:
   - Draw screen content as background (full size)
   - Draw webcam as overlay (25% size, bottom-right corner)
5. Capture canvas stream using `canvas.captureStream()`
6. Record composite stream with MediaRecorder
7. Merge audio tracks (screen audio + microphone)
8. Convert to MP4 after recording
9. Import to media library

**Technical Implementation**:
```javascript
// Pseudo-code for compositing
const canvas = document.createElement('canvas');
canvas.width = screenWidth;
canvas.height = screenHeight;
const ctx = canvas.getContext('2d');

// Create video elements for both streams
const screenVideo = document.createElement('video');
screenVideo.srcObject = screenStream;

const webcamVideo = document.createElement('video');
webcamVideo.srcObject = webcamStream;

// Animation loop to composite
function drawFrame() {
  // Draw screen (full size)
  ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
  
  // Calculate webcam PiP dimensions
  const pipWidth = canvas.width * 0.25;
  const pipHeight = (webcamVideo.videoHeight / webcamVideo.videoWidth) * pipWidth;
  const pipX = canvas.width - pipWidth - 20;
  const pipY = canvas.height - pipHeight - 20;
  
  // Draw webcam overlay (bottom-right)
  ctx.drawImage(webcamVideo, pipX, pipY, pipWidth, pipHeight);
  
  requestAnimationFrame(drawFrame);
}

// Capture composite canvas
const compositeStream = canvas.captureStream(30); // 30 fps
```

**Acceptance Criteria**:
- Both screen and webcam captured simultaneously
- Webcam appears as overlay in bottom-right corner
- Webcam size is 25% of screen width
- Both video streams synchronized
- Audio from both sources mixed correctly
- Recording saved as MP4 and imported to media library
- Preview accurately shows final composition

---

### 2.7 Recording Features - Audio Capture

#### 2.7.1 Microphone Audio

**Audio Input Selection**:
- Dropdown lists all available audio input devices
- Default: System default microphone
- Can be changed before recording starts

**Audio Level Indicator**:
- Real-time visual meter showing input level
- Green bars (safe level) / Yellow (high) / Red (clipping)
- Helps user verify audio is being captured

**Audio Settings**:
- Sample rate: 48kHz (standard)
- Bit depth: 16-bit
- Channels: Mono or Stereo (auto-detected)

**Acceptance Criteria**:
- Microphone audio captured during recording
- Audio level meter displays accurate levels
- Audio synchronized with video
- No audio glitches or dropouts

#### 2.7.2 System Audio (Screen Recording)

**Platform Support**:
- **macOS**: Requires audio loopback (may need additional permissions or third-party tools)
- **Windows**: System audio capture supported via desktopCapturer
- **Platform differences handled behind the scenes**: App automatically detects platform capabilities and shows/hides system audio option accordingly

**Audio Capture**:
- Checkbox to enable system audio capture (only shown if platform supports it)
- Captures all audio playing on system during screen recording
- Disabled by default (requires explicit opt-in)
- On macOS, show tooltip: "System audio requires additional setup" with link to help

**Audio Mixing**:
- If both microphone and system audio enabled:
  - Mix both audio tracks into single output
  - Equal volume balance (configurable in future)

**Acceptance Criteria**:
- System audio captured when enabled
- Mixed correctly with microphone audio if both enabled
- User receives clear feedback if system audio unavailable on their platform

---

### 2.8 Recording Integration & Polish

#### 2.8.1 Post-Recording Workflow

**After Recording Stops**:
1. Show processing modal: "Processing recording..."
2. Convert WebM to MP4 using FFmpeg
3. Generate thumbnail (frame at 1 second)
4. Extract metadata (duration, resolution, file size)
5. Save to recordings folder
6. Import to media library automatically
7. Show success notification: "Recording added to media library"
8. Recording appears in media library with metadata

**Media Library Integration**:
- Recordings appear as regular media clips
- Marked with recording icon badge
- Can be dragged to timeline like imported videos
- Can be renamed in media library
- Can be removed from library (file remains in recordings folder)

**Acceptance Criteria**:
- Recording automatically appears in media library
- No manual import required
- Recording is ready to use immediately
- Thumbnail generated correctly
- Metadata displays accurately

#### 2.8.2 Error Handling

**Permission Errors**:
- Screen recording permission denied (macOS)
- Microphone permission denied
- Pre-check permissions before recording
- If denied, show modal with step-by-step instructions:
  - macOS: "Open System Preferences → Security & Privacy → Screen Recording/Microphone"
  - Windows: "Open Settings → Privacy → Camera/Microphone"
- Provide "Open Settings" button that launches system preferences
- Re-check permissions after user returns

**Recording Errors**:
- Insufficient disk space at start (< 5GB): Warn before recording
- Disk space runs out during recording (< 500MB): Auto-stop and save what was recorded
- Recording process crashes: Save partial WebM if possible
- FFmpeg conversion fails: Import WebM file anyway, show notification "Imported as WebM (MP4 conversion failed)"
- User can still use WebM files in timeline (HTML5 video supports WebM)

**Device Errors**:
- Camera disconnected during recording
- Microphone disconnected
- Gracefully stop recording and save what was captured

**Acceptance Criteria**:
- All error scenarios handled gracefully
- Clear, actionable error messages shown to user
- Partial recordings saved when possible
- App doesn't crash on recording errors

---

## 3. Test Scenarios

### 3.1 Recording Test Scenarios

**Scenario 1: 30-Second Screen Capture**
1. Open recording panel
2. Select screen source
3. Select microphone
4. Start recording
5. Record for 30 seconds
6. Stop recording
7. Verify recording converts to MP4
8. Verify recording appears in media library
9. Drag recording to timeline
10. Play and verify quality

**Scenario 2: Webcam Recording**
1. Open recording panel, switch to Webcam tab
2. Select webcam device
3. Verify live preview works
4. Start recording for 15 seconds
5. Stop recording
6. Verify recording in media library
7. Add to timeline and verify

**Scenario 3: Screen + Webcam (PiP)**
1. Open recording panel, switch to Screen + Webcam tab
2. Select screen source and webcam
3. Verify preview shows composite
4. Record for 30 seconds
5. Stop recording
6. Verify webcam overlay in bottom-right
7. Verify both video streams synchronized
8. Verify audio from both sources

### 3.2 Timeline Navigation Test Scenarios

**Scenario 4: Pan Mode**
1. Load timeline with 10+ clips spanning 5 minutes
2. Enable pan mode toggle
3. Click and drag timeline left/right
4. Verify smooth scrolling
5. Verify clips cannot be selected during pan
6. Disable pan mode
7. Verify normal editing restored

### 3.3 Project Persistence Test Scenarios

**Scenario 5: Save and Load Project**
1. Import 3 video clips to media library
2. Arrange clips on timeline with trims and splits
3. Click Save Project
4. Choose location and name
5. Verify `.cfproj` file and `_media` folder created
6. Close app
7. Reopen app and load project
8. Verify all clips in correct positions
9. Verify trim/split operations preserved

**Scenario 6: Project Portability**
1. Create and save a project
2. Copy project folder to different computer
3. Open project on different computer
4. Verify all media loads correctly
5. Verify project fully functional

### 3.4 Integration Test Scenarios

**Scenario 7: Complete Workflow**
1. Record 30-second screen capture
2. Import 2 additional video clips
3. Arrange all 3 clips on timeline in sequence
4. Trim and split clips at various points
5. Save project
6. Export 2-minute video
7. Verify exported video plays correctly
8. Load project and verify edits preserved

### 3.5 Extended Session Test Scenario

**Scenario 8: 15+ Minute Editing Session**
1. Start with empty project
2. Record 3 different screen captures (2-3 min each)
3. Import additional clips
4. Arrange clips on timeline (10+ total clips)
5. Perform various edits (trim, split, reorder)
6. Save project multiple times
7. Export video
8. Monitor memory usage throughout
9. Verify no memory leaks
10. Verify app remains responsive

---

## 4. Performance Requirements

### 4.1 Recording Performance

- **Recording Latency**: Start recording within 2 seconds of clicking Record button
- **Frame Rate**: Maintain 30 fps minimum during screen/webcam recording
- **Audio Sync**: Audio/video sync within 50ms
- **Conversion Speed**: WebM to MP4 conversion completes within 1x recording duration (30s recording converts in 30s or less)
- **Memory Usage**: Recording doesn't cause memory spikes > 1GB

### 4.2 Timeline Performance

- **Pan Mode**: Smooth 60fps scrolling during pan
- **Timeline with Recordings**: Timeline remains responsive with 10+ clips including recordings
- **Clip Operations**: Dragging clips maintains 60fps with no lag

### 4.3 Project Save/Load Performance

- **Save Time**: Project with 10 clips (5GB total) saves within 30 seconds
- **Load Time**: Project loads within 10 seconds
- **File Copying**: Progress indicator updates smoothly during media file copying

### 4.4 Overall Application Performance

- **App Launch**: Under 5 seconds from click to usable interface
- **Memory Baseline**: Under 500MB with empty project
- **Memory with Content**: Under 2GB with 10 video clips and 3 recordings loaded
- **No Memory Leaks**: Memory remains stable during 15+ minute sessions
- **Export Performance**: At least 1x real-time (2-minute video exports in ≤2 minutes)
- **Preview Playback**: 30 fps minimum, 60 fps target

---

## 5. Technical Architecture

### 5.1 New Components

**Frontend (Renderer Process)**:
- `src/renderer/components/RecordingPanel.vue` - Main recording UI
- `src/renderer/components/ProjectMenu.vue` - File menu for save/load
- `src/renderer/components/PanToggle.vue` - Timeline pan mode button

**Shared Logic**:
- `src/shared/screenRecorder.js` - Recording logic (screen, webcam, composite)
- `src/shared/projectService.js` - Project serialization and file management

**Main Process**:
- `src/main/recordingHandler.js` - IPC handlers for recording APIs
- Update `src/main/index.js` - Add desktopCapturer and file management IPCs
- Update `src/main/preload.js` - Expose recording APIs to renderer

**Store Updates**:
- `src/renderer/stores/timelineStore.js` - Add pan mode state, serialization methods
- `src/renderer/stores/mediaStore.js` - Add serialization methods, recording integration

### 5.2 Dependencies

**Existing**:
- Electron (desktopCapturer API)
- FFmpeg (video conversion)
- Vue 3
- Pinia

**No Additional NPM Packages Required**

### 5.3 File System Structure

```
~/ClipForge/
  Recordings/
    Recording_20251029_120530.mp4
    Recording_20251029_135620.mp4
    .thumbnails/
      Recording_20251029_120530.jpg

~/Documents/MyProjects/
  VideoProject1.cfproj
  VideoProject1_media/
    video1.mp4
    video2.mp4
    Recording_20251029_120530.mp4
    .thumbnails/
      video1.jpg
      video2.jpg
```

---

## 6. User Interface Updates

### 6.1 Top Toolbar Additions

**New Buttons** (left to right):
1. **New Project** - Document icon with plus
2. **Open Project** - Folder icon
3. **Save Project** - Floppy disk icon
4. **Record** - Red circle icon (opens recording panel)

### 6.2 Timeline Toolbar Additions

**New Button**:
- **Pan Mode Toggle** - Hand/grab icon, next to zoom controls

### 6.3 Recording Panel Layout

**Full Panel** (before recording):
```
┌─────────────────────────────────────────────┐
│  Recording Panel                       [_][X]│
├─────────────────────────────────────────────┤
│  [Screen] [Webcam] [Screen + Webcam]        │
├─────────────────────────────────────────────┤
│                                              │
│  Source: [Entire Screen ▼]                  │
│  ┌──────────────────────────────────┐       │
│  │                                  │       │
│  │    Preview / Live Feed           │       │
│  │                                  │       │
│  └──────────────────────────────────┘       │
│                                              │
│  Microphone: [Built-in Microphone ▼]        │
│  Audio Level: [████████░░] 80%              │
│                                              │
│  Quality: [High (1080p) ▼]                  │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │         [●] Record  00:00              │ │
│  └────────────────────────────────────────┘ │
│                                              │
└──────────────────────────────────────────────┘
```

**Minimized Widget** (during recording):
```
┌──────────────────────────────┐
│  ● Recording  00:15:32  [■]  │
│  [████████░░] 80%            │
└──────────────────────────────┘
```
(Draggable, always-on-top, shows timer up to 2:00:00 max)

---

## 7. Non-Breaking Changes Strategy

### 7.1 Backward Compatibility

- All existing V1 features remain unchanged
- No modifications to existing clip editing behavior
- Export functionality unchanged (already supports progress indicator)
- Snap-to-grid toggle already exists, just verify functionality

### 7.2 Additive Features

- Recording panel is new modal (doesn't affect existing UI)
- Pan mode is opt-in toggle (doesn't change default behavior)
- Project save/load is new menu (doesn't affect current workflow)
- All changes are enhancements, not replacements

### 7.3 Testing Strategy

After each implementation phase:
1. Test all V1 features to ensure no regressions
2. Verify import/export still works
3. Verify timeline editing still works
4. Verify playback still works
5. Verify trim/split still works

---

## 8. Implementation Priority

### 8.1 Phase Order

1. **Phase 1**: Timeline pan mode (low risk, high value)
2. **Phase 2**: Verify snap behavior (validation only)
3. **Phase 3**: Project save/load (foundation for portability)
4. **Phase 4**: Screen recording (core new feature)
5. **Phase 5**: Webcam recording (builds on Phase 4)
6. **Phase 6**: Screen + webcam simultaneous (combines 4 & 5)
7. **Phase 7**: Audio capture (enhancement to recording)
8. **Phase 8**: Recording integration polish
9. **Phase 9**: Testing and performance validation

### 8.2 MVP Definition

Minimum viable V2 includes:
- Timeline pan mode
- Project save/load
- Screen recording
- Webcam recording
- Basic audio capture

Nice-to-have for V2:
- Simultaneous screen + webcam
- System audio capture
- Audio level meters

---

## 9. Success Metrics

### 9.1 Feature Adoption

- Users successfully record screen captures
- Users save and load projects
- Users utilize pan mode for timeline navigation

### 9.2 Performance Metrics

- All recordings complete without crashes (up to 2 hour limit)
- Recordings auto-stop gracefully if disk space runs low
- All exports complete without crashes
- Timeline remains responsive with 10+ clips
- Preview playback maintains 30+ fps
- App launches in under 5 seconds
- No memory leaks during extended sessions
- Pan mode resets to OFF on app launch

### 9.3 Quality Metrics

- Recordings are high quality and properly synchronized
- Exported videos maintain reasonable file sizes
- Projects are fully portable between computers
- WebM files work as fallback if MP4 conversion fails
- Platform differences handled transparently

### 9.4 User Experience Metrics

- Permission checks guide users to system settings when needed
- Unsaved changes warnings prevent data loss
- Recording widget provides clear feedback during capture
- Disk space monitoring prevents recording failures

---

## 10. Future Enhancements (Post-V2)

### 10.1 Recording Features

- Customizable PiP position and size
- Screen annotation during recording (drawing tools)
- Pause/resume recording
- Recording presets (saved source/quality configurations)
- Extend recording time limit beyond 2 hours (configurable)
- Additional keyboard shortcuts for recording controls

### 10.2 Project Features

- Auto-save functionality
- Recent projects list
- Project templates
- Cloud storage integration

### 10.3 Timeline Features

- Smooth zoom to cursor position
- Timeline minimap for navigation
- Clip color coding
- Track labels and organization

---

**Document Version**: 2.0  
**Status**: Ready for Implementation  
**Last Updated**: October 29, 2025

