# B-roll Search Feature - Task List

## Overview
Implement AI-powered semantic search for B-roll clips using OpenAI GPT-3.5-turbo and text-embedding-3-small. This feature enables users to search their media library using natural language queries and find relevant clips based on semantic similarity.

## Pull Requests

### PR_29: OpenAI Integration & Backend Infrastructure
**Goal**: Set up OpenAI integration in the main process with .env-based API key management

**Dependencies**: 
- Add `openai` package to dependencies
- Add `dotenv` package to dependencies

**Files Created**:
- `src/main/brollSearchHandler.js`
- `.env.example` (template file for users)

**Files Modified**:
- `package.json` (add openai and dotenv dependencies)
- `src/main/index.js` (register IPC handlers, load dotenv)
- `src/main/preload.js` (expose OpenAI APIs to renderer)
- `.gitignore` (already includes .env files)

**Implementation Details**:
1. Install `openai` and `dotenv` packages via npm
2. Create `.env.example` template file with:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```
3. Update `src/main/index.js` to load dotenv at startup:
   ```javascript
   import dotenv from 'dotenv';
   dotenv.config();
   ```
4. Create `brollSearchHandler.js` class with methods:
   - `constructor()` - Initialize OpenAI client with `process.env.OPENAI_API_KEY`
   - `generateTags(fileName)` - Call GPT-3.5-turbo to generate 5 descriptive tags
   - `createEmbedding(text)` - Generate embedding using text-embedding-3-small
   - `computeSimilarity(queryEmbedding, clipEmbeddings)` - Calculate cosine similarity
   - `hasApiKey()` - Check if OPENAI_API_KEY is set in environment
5. Add IPC handlers in `index.js`:
   - `openai:generateTags`
   - `openai:createEmbedding`
   - `openai:computeSimilarity`
   - `openai:hasApiKey` - Check if API key is configured
6. Expose OpenAI methods in `preload.js` under `electronAPI.openai` namespace
7. Implement error handling for API failures and rate limits
8. Handle missing API key gracefully (return error, don't crash)

**Testing**:
- Verify IPC communication between main and renderer
- Test with valid API key in .env file
- Test with missing/invalid API key (should handle gracefully)
- Validate tag generation with sample filenames
- Confirm embedding generation returns 1536-dimensional vectors

---

### PR_30: Media Store Extension & Metadata Schema
**Goal**: Extend media store to support B-roll metadata (tags, embeddings, indexing status)

**Dependencies**: 
- PR_29 (OpenAI backend)

**Files Modified**:
- `src/renderer/stores/clipforge/mediaStore.js`

**Implementation Details**:
1. Extend `mediaFile` schema in `addMediaFile()` with new fields:
   - `tags: []` (array of strings)
   - `embedding: null` (1536-dimensional array or null)
   - `description: ''` (optional summary)
   - `indexed: false` (indexing completion status)
   - `indexedAt: null` (timestamp of indexing)
2. Add new actions:
   - `updateMediaMetadata(id, { tags, embedding, description, indexed, indexedAt })`
   - `getUnindexedMedia()` - Returns clips without embeddings
   - `getIndexedMedia()` - Returns clips with embeddings
   - `clearMetadata(id)` - Reset metadata for re-indexing
3. Update `serialize()` to include new metadata fields
4. Update `deserialize()` to handle legacy projects without metadata
5. Ensure backward compatibility - existing clips load without errors

**Testing**:
- Import clip and verify default metadata values
- Update metadata and confirm store updates
- Save/load project and verify metadata persistence
- Load legacy project without metadata (should not error)

---

### PR_31: B-roll Search Service & Indexing Logic
**Goal**: Create service layer to orchestrate indexing and search operations

**Dependencies**: 
- PR_29 (OpenAI backend)
- PR_30 (Media store)

**Files Created**:
- `src/renderer/services/brollSearchService.js`

**Implementation Details**:
1. Create `BrollSearchService` class with methods:
   - `indexClip(clip)` - Generate tags and embedding for a single clip
     - Call `electronAPI.openai.generateTags(clip.fileName)`
     - Combine tags into text string
     - Call `electronAPI.openai.createEmbedding(tagsText)`
     - Update mediaStore with results
     - Mark clip as indexed
   - `indexAllClips()` - Batch index all unindexed clips
   - `searchClips(query)` - Search indexed clips by semantic similarity
     - Generate query embedding
     - Get all indexed clips from store
     - Compute similarity scores
     - Return top 10 results sorted by relevance
   - `normalizeQuery(query)` - Clean query text (trim, lowercase)
2. Implement progress tracking for batch operations
3. Add error recovery for failed indexing (skip and continue)
4. Implement debouncing for search queries (300ms)

**Testing**:
- Index single clip and verify metadata updates
- Batch index multiple clips with progress tracking
- Search for clips using various queries
- Verify results are ranked by relevance score
- Test error handling when OpenAI API fails

---

### PR_32: B-roll Search Modal UI Component
**Goal**: Create modal dialog with search interface and results display

**Dependencies**: 
- PR_30 (Media store)
- PR_31 (Search service)

**Files Created**:
- `src/renderer/components/BrollSearchModal.vue`

**Implementation Details**:
1. Create modal component structure:
   - Modal overlay with semi-transparent backdrop
   - Centered dialog (600px width, 500px height)
   - Header with "Search B-roll" title and close button
   - Search input with placeholder "Describe the B-roll you need..."
   - Results grid (2 columns, scrollable)
   - Empty states (no results, no API key, no indexed clips)
2. Implement search functionality:
   - Initialize `BrollSearchService` on mount
   - Debounced search on input change (300ms)
   - Display loading spinner during search
   - Show results with thumbnail, filename, tags, relevance score
   - Click result to insert at timeline playhead
3. Add API key detection:
   - Check if API key is configured on mount using `electronAPI.openai.hasApiKey()`
   - If missing, show message: "OpenAI API key not configured. Add OPENAI_API_KEY to .env file to enable search."
   - Provide link/button to open .env.example for reference
4. Style with existing app theme (Windows 95-style UI)
5. Add keyboard shortcuts:
   - Escape to close modal
   - Enter to search
   - Arrow keys for result navigation

**Testing**:
- Open modal and verify UI renders correctly
- Enter query and confirm search executes
- Click result and verify clip inserted to timeline
- Test empty states (no API key, no results, no clips)
- Verify modal closes on backdrop click and Escape key

---

### PR_33: Integration & Auto-Indexing
**Goal**: Integrate search modal into app and implement automatic indexing on import

**Dependencies**: 
- PR_29 (Backend)
- PR_30 (Store)
- PR_31 (Service)
- PR_32 (UI)

**Files Modified**:
- `src/renderer/components/ClipForgeEditor.vue`
- `src/renderer/components/MediaLibrary.vue`

**Implementation Details**:
1. Add search button to `ClipForgeEditor.vue` toolbar:
   - Insert button between "Export" and "Record" buttons
   - Button text: "🔍 Search B-roll"
   - Toggle modal visibility on click
   - Import and mount `BrollSearchModal` component
   - Pass `appMode="clipforge"` prop
2. Implement auto-indexing in `MediaLibrary.vue`:
   - After successful clip import (in `importFiles()`)
   - Check if OpenAI API key is configured using `electronAPI.openai.hasApiKey()`
   - If key exists in .env, trigger background indexing
   - Show non-intrusive indexing status (badge or small indicator)
   - Queue multiple imports for batch processing
   - Don't block user from continuing to work
3. Handle edge cases:
   - Skip indexing if no API key set (silent)
   - Allow search even if some clips not indexed
   - Graceful fallback to filename search if OpenAI fails
   - Show helpful message in search modal if .env is not configured

**Testing**:
- Import clip and verify auto-indexing triggers (with valid .env)
- Click search button and confirm modal opens
- Search and insert clip into timeline
- Test with no .env file (should show helpful message, not crash)
- Test with invalid API key in .env (should handle error gracefully)
- Import multiple clips and verify batch indexing
- Remove .env file and verify indexing is skipped silently

---

## Validation Checklist

After completing all PRs, verify:
- [ ] Can import video clips without errors
- [ ] Clips automatically indexed when .env has OPENAI_API_KEY
- [ ] Search modal opens from toolbar button
- [ ] Can enter query and see relevant results
- [ ] Clicking result inserts clip at playhead position
- [ ] Results ranked by relevance score
- [ ] Empty states handle edge cases gracefully
- [ ] Projects save/load with metadata intact
- [ ] Legacy projects without metadata load successfully
- [ ] No breaking changes to existing functionality
- [ ] API key read from .env file (not exposed to renderer)
- [ ] .env.example template provided for users
- [ ] .env file properly gitignored
- [ ] OpenAI errors don't crash the app
- [ ] Can use app without .env file (indexing just skipped, helpful message shown)

## Cost Estimation (OpenAI)

**Per Clip Indexing**:
- GPT-4o with vision: ~15 frames × $0.00001 per frame (~$0.00015)
- text-embedding-3-large: ~20 tokens (~$0.000006)
- **Total per clip**: ~$0.000156

**Per Search Query**:
- text-embedding-3-large: ~20 tokens (~$0.000006)
- **Total per search**: ~$0.000006

**Example**: 100 clips + 50 searches = ~$0.0156 + ~$0.0003 = **~$0.016 total**

## Notes
- All PRs are sequential and build on each other
- No modifications to existing features (export, recording, timeline, etc.)
- Maintains backward compatibility with existing projects
- OpenAI integration is optional - app works without it

## Setup Instructions (for developers)
1. Copy `.env.example` to `.env` in project root
2. Add your OpenAI API key: `OPENAI_API_KEY=sk-...`
3. Run `npm install` to install new dependencies (openai, dotenv)
4. Start the app - indexing will happen automatically on import
5. Use "🔍 Search B-roll" button to search clips

**Note**: The .env file is gitignored and will not be committed to the repository.

