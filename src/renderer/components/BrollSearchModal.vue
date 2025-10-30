<template>
  <div v-if="visible" class="broll-search-modal">
    <div class="modal-dialog" @click.stop>
      <!-- Header -->
      <div class="modal-header">
        <h3>Search B-roll</h3>
        <button @click="closeModal" class="close-btn" title="Close (Esc)">
          ×
        </button>
      </div>

      <!-- API Key Status -->
      <div v-if="!hasApiKey" class="api-key-warning">
        <div class="warning-icon">⚠️</div>
        <div class="warning-content">
          <p><strong>OpenAI API key not configured</strong></p>
          <p>Add OPENAI_API_KEY to your .env file to enable search.</p>
          <button @click="openEnvExample" class="env-example-btn">
            View .env.example
          </button>
        </div>
      </div>

      <!-- Search Input -->
      <div v-if="hasApiKey" class="search-section">
        <div class="search-input-container">
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            placeholder="Search by filename..."
            class="search-input"
            @keydown="handleKeydown"
            @input="handleSearchInput"
          />
          <div v-if="isSearching" class="search-spinner">⟳</div>
        </div>
        
        <!-- Search Stats -->
        <div v-if="searchStats" class="search-stats">
          <span>{{ searchStats.totalClips }} clips available</span>
          <span class="search-mode">• Filename search only</span>
        </div>
      </div>

      <!-- Results Section -->
      <div v-if="hasApiKey" class="results-section">
        <!-- Loading State -->
        <div v-if="isSearching && !hasSearched" class="loading-state">
          <div class="loading-spinner">⟳</div>
          <p>Searching...</p>
        </div>

        <!-- No Results State -->
        <div v-else-if="hasSearched && searchResults.length === 0" class="no-results">
          <div class="no-results-icon">🔍</div>
          <h4>No results found</h4>
          <p>Try different filename keywords.</p>
        </div>

        <!-- Results Grid -->
        <div v-else-if="searchResults.length > 0" class="results-grid">
          <div
            v-for="(result, index) in searchResults"
            :key="result.id"
            class="result-item"
            :class="{ 'selected': selectedIndex === index }"
            @click="selectResult(result)"
            @keydown="handleResultKeydown($event, index)"
            tabindex="0"
          >
            <!-- Thumbnail -->
            <div class="result-thumbnail">
              <img
                v-if="result.thumbnailPath"
                :src="getThumbnailSrc(result.thumbnailPath)"
                :alt="result.fileName"
                class="thumbnail"
                @error="handleThumbnailError"
              />
              <div v-else class="thumbnail-placeholder">
                <svg class="icon-video" viewBox="0 0 24 24">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              </div>
              <div v-if="result.fallback" class="fallback-badge">Basic</div>
            </div>

            <!-- Result Info -->
            <div class="result-info">
              <div class="result-filename" :title="result.fileName">
                {{ result.fileName }}
              </div>
              <div class="result-tags" v-if="result.tags && result.tags.length > 0">
                <span
                  v-for="tag in result.tags.slice(0, 3)"
                  :key="tag"
                  class="tag"
                >
                  {{ tag }}
                </span>
                <span v-if="result.tags.length > 3" class="more-tags">
                  +{{ result.tags.length - 3 }} more
                </span>
              </div>
              <div class="result-meta">
                <span class="duration">{{ formatDuration(result.duration) }}</span>
                <span class="separator">•</span>
                <span class="resolution">{{ result.width }}×{{ result.height }}</span>
                <span class="separator">•</span>
                <span class="relevance">{{ result.relevanceScore }}% match</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State (no search yet) -->
        <div v-else-if="!hasSearched" class="empty-state">
          <div class="empty-icon">🎬</div>
          <h4>Search your B-roll library</h4>
          <p>Type a filename to find clips</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <div class="footer-info">
          <span v-if="searchResults.length > 0">
            {{ searchResults.length }} result{{ searchResults.length !== 1 ? 's' : '' }}
          </span>
          <span v-else-if="hasSearched">
            No results
          </span>
          <span v-else>
            Ready to search
          </span>
        </div>
        <div class="footer-actions">
          <button @click="closeModal" class="cancel-btn">
            Cancel
          </button>
          <button
            v-if="selectedResult"
            @click="insertSelectedClip"
            class="insert-btn"
            :disabled="!selectedResult"
          >
            Insert at Playhead
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { brollSearchService } from '../services/brollSearchService';
import { useClipForgeTimelineStore } from '../stores/clipforge/timelineStore';
import { formatDuration } from '../../shared/utils/videoUtils';

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  appMode: {
    type: String,
    default: 'clipforge'
  }
});

// Emits
const emit = defineEmits(['close', 'insert-clip']);

// Refs
const searchInput = ref(null);
const searchQuery = ref('');
const searchResults = ref([]);
const selectedIndex = ref(-1);
const selectedResult = ref(null);
const isSearching = ref(false);
const hasSearched = ref(false);
const hasApiKey = ref(false);
const searchStats = ref(null);

// Stores
const timelineStore = useClipForgeTimelineStore();

// Search debounce
let searchTimeout = null;

// Computed
const canInsert = computed(() => {
  return selectedResult.value && timelineStore.tracks.length > 0;
});

// Methods
const closeModal = () => {
  emit('close');
  resetModal();
};

const resetModal = () => {
  searchQuery.value = '';
  searchResults.value = [];
  selectedIndex.value = -1;
  selectedResult.value = null;
  hasSearched.value = false;
  isSearching.value = false;
};


const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    closeModal();
  } else if (event.key === 'Enter') {
    performSearch();
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    navigateResults(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    navigateResults(-1);
  }
};

const handleResultKeydown = (event, index) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectResult(searchResults.value[index]);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    navigateResults(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    navigateResults(-1);
  }
};

const navigateResults = (direction) => {
  if (searchResults.value.length === 0) return;
  
  selectedIndex.value = Math.max(0, Math.min(
    searchResults.value.length - 1,
    selectedIndex.value + direction
  ));
  selectedResult.value = searchResults.value[selectedIndex.value];
};

const handleSearchInput = () => {
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  // Set new timeout for debounced search
  searchTimeout = setTimeout(() => {
    if (searchQuery.value.trim()) {
      performSearch();
    } else {
      searchResults.value = [];
      hasSearched.value = false;
      selectedIndex.value = -1;
      selectedResult.value = null;
    }
  }, 300);
};

const performSearch = async () => {
  if (!searchQuery.value.trim() || isSearching.value) return;

  isSearching.value = true;
  hasSearched.value = true;
  selectedIndex.value = -1;
  selectedResult.value = null;

  try {
    const service = brollSearchService();
    const results = await service.searchClips(searchQuery.value);
    searchResults.value = results;
    
    // Auto-select first result if available
    if (results.length > 0) {
      selectedIndex.value = 0;
      selectedResult.value = results[0];
    }
  } catch (error) {
    console.error('Search failed:', error);
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
};

const selectResult = (result) => {
  selectedResult.value = result;
  selectedIndex.value = searchResults.value.findIndex(r => r.id === result.id);
};

const insertSelectedClip = () => {
  if (!selectedResult.value) return;

  const clip = selectedResult.value;
  const playheadTime = timelineStore.playheadPosition;
  const trackId = timelineStore.tracks[0]?.id;

  if (trackId) {
    timelineStore.addClipToTrack(trackId, {
      id: `clip_${Date.now()}`,
      filePath: clip.filePath,
      fileName: clip.fileName,
      duration: clip.duration,
      width: clip.width,
      height: clip.height,
      startTime: playheadTime,
      endTime: playheadTime + clip.duration
    });

    emit('insert-clip', clip);
    closeModal();
  } else {
    console.error('No track available to add clip');
  }
};

const getThumbnailSrc = (thumbnailPath) => {
  if (thumbnailPath && thumbnailPath.startsWith('data:')) {
    return thumbnailPath;
  }
  return thumbnailPath;
};

const handleThumbnailError = (event) => {
  const img = event.target;
  const placeholder = img.nextElementSibling;
  
  if (img) {
    img.style.display = 'none';
  }
  if (placeholder) {
    placeholder.style.display = 'flex';
  }
};

const openEnvExample = () => {
  // This would open the .env.example file in the user's editor
  // For now, just show an alert with instructions
  alert('Copy .env.example to .env and add your OpenAI API key:\n\nOPENAI_API_KEY=your_api_key_here');
};

const loadSearchStats = async () => {
  try {
    const service = brollSearchService();
    searchStats.value = service.getSearchStats();
  } catch (error) {
    console.error('Failed to load search stats:', error);
  }
};

const checkApiKey = async () => {
  // AI functionality disabled - always show search interface
  hasApiKey.value = true;
};

// Lifecycle
onMounted(async () => {
  await checkApiKey();
  await loadSearchStats();
  
  // Focus search input when modal opens
  if (props.visible) {
    await nextTick();
    if (searchInput.value) {
      searchInput.value.focus();
    }
  }
});

// Watch for modal visibility changes
watch(() => props.visible, async (newVisible) => {
  if (newVisible) {
    await checkApiKey();
    await loadSearchStats();
    
    // Focus search input
    await nextTick();
    if (searchInput.value) {
      searchInput.value.focus();
    }
  } else {
    resetModal();
  }
});

// Cleanup
onUnmounted(() => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
});
</script>

<style lang="scss" scoped>
@import "../../styles/plaza/variables";
@import "../../styles/plaza/mixins";
@import "../../styles/plaza/themes/theme-standard";

.broll-search-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(128, 128, 128, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-dialog {
  @include d3-window;
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: #c0c0c0;
  border: 2px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include background-color('inputs-bg');

  h3 {
    margin: 0;
    @include font-color('font-color');
    font-size: 14px;
    font-weight: bold;
  }
}

.close-btn {
  @include d3-object;
  @include font;
  width: 20px;
  height: 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: #d0d0d0;
  }
  
  &:active {
    box-shadow: 1px 1px 0 0 black inset;
    @include border-shadow('btn-active-shadow');
    @include border-color-tl('btn-active-border');
    @include border-color-rb('btn-active-border');
  }
}

.api-key-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  margin: 8px;
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');

  .warning-icon {
    font-size: 16px;
    margin-top: 2px;
  }

  .warning-content {
    flex: 1;
    @include font-color('font-color');

    p {
      margin: 0 0 4px 0;
      font-size: 11px;
      line-height: 1.3;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }

  .env-example-btn {
    @include d3-object;
    @include font;
    padding: 2px 6px;
    cursor: pointer;
    font-size: 10px;
    margin-top: 4px;
    
    &:hover {
      background: #d0d0d0;
    }
    
    &:active {
      box-shadow: 1px 1px 0 0 black inset;
      @include border-shadow('btn-active-shadow');
      @include border-color-tl('btn-active-border');
      @include border-color-rb('btn-active-border');
    }
  }
}

.search-section {
  padding: 12px;
  border-bottom: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
}

.search-input-container {
  position: relative;
  margin-bottom: 8px;
}

.search-input {
  width: 100%;
  padding: 6px 8px;
  @include d3-object;
  @include font;
  @include font-color('font-color');
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  font-size: 11px;

  &:focus {
    outline: none;
    box-shadow: inset 1px 1px 0 0 #000000, inset -1px -1px 0 0 #ffffff;
  }
}

.search-spinner {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  animation: spin 1s linear infinite;
  @include font-color('font-color');
}

@keyframes spin {
  from { transform: translateY(-50%) rotate(0deg); }
  to { transform: translateY(-50%) rotate(360deg); }
}

.search-stats {
  @include font-color('font-color');
  font-size: 10px;
  display: flex;
  align-items: center;
  gap: 4px;

  .indexing-incomplete {
    color: #ff6600;
  }
}

.results-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.loading-state,
.no-results,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  @include font-color('font-color');
  text-align: center;

  .loading-spinner,
  .no-results-icon,
  .empty-icon {
    font-size: 32px;
    margin-bottom: 12px;
  }

  .loading-spinner {
    animation: spin 1s linear infinite;
  }

  h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: bold;
  }

  p {
    margin: 0;
    font-size: 11px;
    opacity: 0.8;
  }
}

.results-grid {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px;
}

.result-item {
  @include d3-object;
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  padding: 8px;
  cursor: pointer;
  display: flex;
  gap: 8px;
  transition: background-color 0.1s;

  &:hover {
    background: #d0d0d0;
  }

  &.selected {
    @include background-color('inputs-bg');
    box-shadow: inset 1px 1px 0 0 #000000, inset -1px -1px 0 0 #ffffff;
  }

  &:focus {
    outline: none;
    box-shadow: inset 1px 1px 0 0 #000000, inset -1px -1px 0 0 #ffffff;
  }
}

.result-thumbnail {
  width: 60px;
  height: 40px;
  flex-shrink: 0;
  position: relative;
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;

  .thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumbnail-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .icon-video {
    width: 16px;
    height: 16px;
    fill: #808080;
  }

  .fallback-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    background: #ff6600;
    color: white;
    padding: 1px 4px;
    font-size: 8px;
    font-weight: bold;
    border: 1px solid;
    @include border-color-tl('content-border-left');
    @include border-color-rb('content-border-right');
    @include border-shadow('content-shadow');
  }
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-filename {
  font-weight: bold;
  @include font-color('font-color');
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  line-height: 1.2;
}

.result-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-bottom: 4px;
}

.tag {
  @include background-color('inputs-bg');
  @include font-color('font-color');
  padding: 1px 4px;
  font-size: 9px;
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include border-shadow('content-shadow');
  white-space: nowrap;
}

.more-tags {
  @include font-color('font-color');
  font-size: 9px;
  font-style: italic;
  padding: 1px 4px;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  @include font-color('font-color');

  .separator {
    color: #808080;
  }

  .relevance {
    font-weight: bold;
    color: #0066cc;
  }
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-top: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
  @include background-color('inputs-bg');

  .footer-info {
    @include font-color('font-color');
    font-size: 10px;
  }

  .footer-actions {
    display: flex;
    gap: 8px;
  }
}

.cancel-btn,
.insert-btn {
  @include d3-object;
  @include font;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 11px;

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

.insert-btn {
  background: #0066cc;
  color: white;
  font-weight: bold;

  &:hover:not(:disabled) {
    background: #0052a3;
  }
}

/* Scrollbar styling */
.results-grid::-webkit-scrollbar {
  width: 16px;
  height: 16px;
}

.results-grid::-webkit-scrollbar-track {
  @include background-color('inputs-bg');
  border: 1px solid;
  @include border-color-tl('content-border-left');
  @include border-color-rb('content-border-right');
}

.results-grid::-webkit-scrollbar-thumb {
  @include d3-object;
  background: #c0c0c0;
  
  &:hover {
    background: #d0d0d0;
  }
}

.results-grid::-webkit-scrollbar-corner {
  @include background-color('inputs-bg');
}
</style>
