# App Launcher View - Task List

This task list breaks down the implementation of the Forge app launcher with ClipForge and VoiceForge into sequential pull requests. Each PR builds on the previous one without breaking existing functionality.

---

## PR #29: App Rebranding and Store Context Support

**Goal:** Update branding from ClipForge to Forge and prepare stores to accept app context parameters without breaking current functionality.

**Changes:**
- Update `package.json`:
  - Change `"name": "clipforge"` to `"name": "forge"`
  - Change `"author": "ClipForge Team"` to `"author": "Forge Team"`
  - Change `"appId": "com.clipforge.app"` to `"appId": "com.forge.app"`
  - Change `"productName": "ClipForge"` to `"productName": "Forge"`
- Update `src/main/index.js` line 34: Change `title: 'ClipForge'` to `title: 'Forge'`
- Modify all 4 stores to accept app context parameter:
  - `src/renderer/stores/mediaStore.js` - Transform `defineStore('media', ...)` to factory function accepting `appContext = 'clipforge'`
  - `src/renderer/stores/projectStore.js` - Transform `defineStore('project', ...)` to factory function
  - `src/renderer/stores/timelineStore.js` - Transform `defineStore('timeline', ...)` to factory function
  - `src/renderer/stores/recordingStore.js` - Transform `defineStore('recording', ...)` to factory function
- Update `src/renderer/App.vue` to pass 'clipforge' context to all store initializations (maintains current behavior)

**Testing:**
- Verify app launches with new "Forge" branding
- Verify all existing functionality works (import, timeline, recording, save/load)
- Verify stores initialize correctly with default 'clipforge' context

**Status:** Not Started

---

## PR #30: Project Service App Type Support

**Goal:** Add app type tracking to project files and validation logic without changing save/load behavior.

**Changes:**
- Update `src/shared/projectService.js`:
  - Modify `serializeProject` method to accept `appType = 'clipforge'` parameter
  - Add `appType: appType` to returned project data structure
  - Modify `loadProject` method to accept `expectedAppType = 'clipforge'` parameter
  - Add validation: throw error if `projectData.appType` doesn't match `expectedAppType`
- Update all calls to `prepareProjectForSave` to pass 'clipforge' as appType
- Update all calls to `loadProject` to pass 'clipforge' as expectedAppType

**Testing:**
- Save a project and verify it includes `"appType": "clipforge"` in JSON
- Load existing projects (without appType) - should work with backward compatibility
- Load new projects with matching appType - should work
- Attempt to load with mismatched appType - should show error (test manually)

**Status:** Not Started

---

## PR #31: App Launcher UI Components

**Goal:** Create the app launcher and navigation components without integrating them into the main app flow yet.

**Changes:**
- Create `src/renderer/components/AppLauncher.vue`:
  - Dark theme with "Forge" header and tagline
  - Two gradient cards: ClipForge (🎬) and VoiceForge (🎙️)
  - Card descriptions explaining each app's purpose
  - Emits `select-app` event with 'clipforge' or 'voiceforge'
  - Hover effects and modern styling
- Create `src/renderer/components/BackButton.vue`:
  - Simple button with "← Back" text
  - Emits `back` event
  - Styled to match app theme
  - Includes tooltip "Back to Launcher"

**Testing:**
- Components can be imported without errors
- Run dev mode and verify no regressions in main app
- (Components not yet visible - will integrate in next PR)

**Status:** Not Started

---

## PR #32: Extract ClipForge Editor and Add App Router

**Goal:** Refactor App.vue into a router that can switch between launcher and ClipForge editor. VoiceForge not yet implemented.

**Changes:**
- Create `src/renderer/components/ClipForgeEditor.vue`:
  - Copy entire current `src/renderer/App.vue` template and script content (lines 1-303)
  - Add `appMode` prop with default 'clipforge'
  - Import and add `<BackButton @back="$emit('back')" />` in header (before title)
  - Initialize all stores with `props.appMode`: `useMediaStore(props.appMode)`, etc.
  - Pass `:app-mode="appMode"` to `<RecordingPanel>`
  - Add window title update in `onMounted`: `document.title = 'Forge - ClipForge'`
  - Add window title reset in `onUnmounted`: `document.title = 'Forge'`
  - Keep header title as "ClipForge"
  - Update `window.__projectStore` to be namespaced: `window[\`__projectStore_${props.appMode}\`]`
- Refactor `src/renderer/App.vue`:
  - Remove all existing template/script content
  - Add navigation state: `const currentApp = ref(null)`
  - Import AppLauncher and ClipForgeEditor
  - Conditionally render: AppLauncher when `currentApp === null`, ClipForgeEditor when `currentApp === 'clipforge'`
  - Add `enterApp(appName)` method to set currentApp
  - Add `exitToLauncher()` method with unsaved changes dialog:
    - Check `projectStore.isDirty`
    - Show confirmation dialog with Cancel/Discard/Save options
    - Clear recording store state: `recordingStore.reset()`
    - Set `currentApp.value = null`
  - Remove all CSS (now in ClipForgeEditor.vue)

**Testing:**
- App launches showing launcher screen with ClipForge card
- Click ClipForge card - enters ClipForge editor (full existing functionality)
- Back button appears in header
- Click back button - returns to launcher
- Back button with unsaved changes - shows confirmation dialog
- Verify all ClipForge functionality works: import, timeline, recording, save/load, export
- Window title updates: "Forge" at launcher, "Forge - ClipForge" in editor

**Status:** Not Started

---

## PR #33: VoiceForge Editor Implementation

**Goal:** Add VoiceForge as a second app option with audio-focused UI and microphone-only recording.

**Changes:**
- Create `src/renderer/components/VoiceForgeEditor.vue`:
  - Copy `ClipForgeEditor.vue` entirely
  - Change `appMode` default to 'voiceforge'
  - Change header title to "VoiceForge"
  - Change window title to "Forge - VoiceForge"
  - Update recording button: icon to 🎙️, text to "Record Audio"
  - Update primary color throughout from `#007acc` (blue) to `#8b5cf6` (purple):
    - `.record-toggle-btn` background
    - `.tab-btn.active` border
    - Any other blue accent colors
- Update `src/renderer/App.vue`:
  - Import VoiceForgeEditor
  - Add condition: render VoiceForgeEditor when `currentApp === 'voiceforge'`
  - Update `exitToLauncher()` to handle both app types
- Update `src/renderer/components/RecordingPanel.vue`:
  - Add `appMode` prop: `{ type: String, default: 'clipforge' }`
  - Initialize stores with appMode: `const recordingStore = useRecordingStore(props.appMode)`
  - Initialize mediaStore: `const mediaStore = useMediaStore(props.appMode)`
  - Update tab visibility:
    - Screen tab: `v-if="props.appMode === 'clipforge'"`
    - Webcam tab: `v-if="props.appMode === 'clipforge'"`
    - Composite tab: `v-if="props.appMode === 'clipforge'"`
  - Add new Microphone tab: `v-if="props.appMode === 'voiceforge'"`
  - Update default tab: `ref(props.appMode === 'voiceforge' ? 'microphone' : 'screen')`
  - Add microphone-only tab content (after webcam tab):
    - No screen/webcam source selection
    - Microphone dropdown (existing)
    - Audio level meter (existing)
    - Quality selector (existing)
    - Disk space warning (existing)
    - Start/Stop recording buttons (existing)
- Update `src/renderer/components/ProjectMenu.vue`:
  - Add `appMode` prop: `{ type: String, required: true }`
  - Pass appMode to projectService.loadProject and prepareProjectForSave calls
  - Pass appMode when initializing stores

**Testing:**
- Launch app - see both ClipForge and VoiceForge cards
- Enter VoiceForge - purple theme, "VoiceForge" title
- Recording panel shows only microphone tab
- Record audio - should save to VoiceForge media library
- Add recording to timeline - should work
- Save VoiceForge project - includes `"appType": "voiceforge"`
- Load VoiceForge project in VoiceForge - works
- Try to load ClipForge project in VoiceForge - shows error
- Try to load VoiceForge project in ClipForge - shows error
- Verify complete state isolation between apps (separate media libraries)

**Status:** Not Started

---

## PR #34: Audio-Focused UI Enhancements for VoiceForge

**Goal:** Add audio waveform visualization and audio-specific improvements to VoiceForge editor.

**Changes:**
- Create `src/renderer/components/AudioPreview.vue`:
  - Canvas-based waveform visualization using Web Audio API
  - Playback position indicator on waveform
  - Audio level meters (L/R channels)
  - Time display (current/total)
  - Audio controls: play/pause, volume slider, mute button
  - Display audio metadata: bitrate, sample rate, channels, codec
  - Props: `currentClip`, `playheadPosition`, `isPlaying`
  - Emits: `seek`, `play`, `pause`, `volume-change`
- Update `src/renderer/components/VoiceForgeEditor.vue`:
  - Import AudioPreview component
  - Replace PreviewWindow with AudioPreview in template:
    ```vue
    <AudioPreview 
      v-if="hasAudioClipsOnTimeline"
      :current-clip="currentPlayingClip"
      :playhead-position="timelineStore.playheadPosition"
      :is-playing="isPlaying"
      @seek="handleSeek"
      @play="handlePlay"
      @pause="handlePause"
    />
    <div v-else class="preview-placeholder">
      <p>Add audio clips to timeline to preview</p>
    </div>
    ```
  - Add computed property to detect audio clips
  - Wire up event handlers
- Optional timeline improvements for VoiceForge:
  - Show audio clip names more prominently on timeline clips
  - Add visual indicators for audio-only clips (e.g., different icon/color)

**Testing:**
- Open VoiceForge editor
- Import audio file or record audio
- Add to timeline
- Verify waveform visualization displays correctly
- Test playback controls from AudioPreview
- Verify audio levels display during playback
- Test seek functionality by clicking on waveform
- Verify all audio metadata displays correctly

**Status:** Not Started

---

## Summary

- **PR #29**: Foundation - Branding and store context support
- **PR #30**: Project file app type tracking
- **PR #31**: UI components (launcher, back button)
- **PR #32**: App router and ClipForge extraction
- **PR #33**: VoiceForge editor with state isolation
- **PR #34**: Audio-focused enhancements

Each PR is designed to be independently testable and doesn't break existing functionality. PRs must be executed in order as each builds on the previous.

