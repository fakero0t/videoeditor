import { useClipForgeMediaStore } from '../stores/clipforge/mediaStore';

export class BrollSearchService {
  constructor() {
    this._mediaStore = null;
    this.isIndexing = false;
    this.indexingProgress = { current: 0, total: 0 };
    this.indexingCallbacks = [];
  }

  // Lazy getter for media store to avoid Pinia initialization issues
  get mediaStore() {
    if (!this._mediaStore) {
      this._mediaStore = useClipForgeMediaStore();
    }
    return this._mediaStore;
  }


  /**
   * Normalize search query text with nightlife/hospitality focus
   * @param {string} query - Raw query text
   * @returns {string} Normalized query
   */
  normalizeQuery(query) {
    if (!query || typeof query !== 'string') {
      return '';
    }
    
    let normalized = query.trim().toLowerCase();
    
    // Enhance nightlife/hospitality terms for better matching
    const enhancements = {
      // Lighting
      'strobe': 'strobe lights flashing lighting effects',
      'lights': 'lighting strobe neon laser colorful',
      'neon': 'neon lights colored lighting glow',
      'laser': 'laser lights beams lighting effects',
      'dark': 'darkness dim lighting silhouettes shadows',
      
      // DJ & Equipment
      'dj': 'dj hands equipment mixer turntables booth close-up',
      'mixer': 'dj mixer hands equipment controls',
      'turntables': 'turntables dj hands vinyl equipment',
      'equipment': 'dj equipment mixer turntables cdjs booth',
      'booth': 'dj booth equipment setup stage',
      
      // Dancing & Movement
      'dance': 'dancing dancers movement shuffling jumping energy',
      'dancing': 'dancers dance movement shuffling crowd energy',
      'shuffle': 'shuffling dance dancing footwork movement',
      'shuffling': 'shuffle dance footwork dancers movement',
      'jumping': 'jumping dancing energy crowd movement',
      'hands up': 'hands raised crowd dancing celebrating energy',
      'raised hands': 'hands up crowd celebrating dancing energy',
      
      // Crowd
      'crowd': 'crowd panning people dancing audience packed',
      'panning': 'panning crowd movement camera sweep tracking',
      'people': 'people crowd faces dancing socializing',
      'faces': 'faces close-up people smiling expressions',
      'smiling': 'smiling faces happy people expressions',
      
      // Movement/Camera
      'driving': 'driving car movement night city travel',
      'closeup': 'close-up face hands detail intimate',
      'close-up': 'closeup face hands detail intimate',
      
      // Venue
      'stage': 'stage dj lights performance elevated',
      'floor': 'dance floor crowd dancing people packed',
      'bar': 'bar drinks people socializing bottles'
    };
    
    // Add related terms for better matching
    for (const [key, value] of Object.entries(enhancements)) {
      if (normalized.includes(key)) {
        normalized += ' ' + value;
      }
    }
    
    return normalized;
  }

  /**
   * Index a single clip (placeholder - no AI analysis)
   * @param {Object} clip - Media file object
   * @returns {Promise<Object>} Indexing result
   */
  async indexClip(clip) {
    if (!clip || !clip.fileName) {
      throw new Error('Invalid clip: missing fileName');
    }

    console.log(`Clip indexing disabled: ${clip.fileName}`);
    
    return {
      success: true,
      clipId: clip.id,
      skipped: true,
      message: 'AI indexing disabled'
    };
  }

  /**
   * Index all unindexed clips in the media library (placeholder - no AI analysis)
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Batch indexing results
   */
  async indexAllClips(progressCallback = null) {
    console.log('AI indexing disabled - no clips will be processed');
    
    return {
      success: true,
      processed: 0,
      successful: 0,
      failed: 0,
      results: [],
      message: 'AI indexing disabled'
    };
  }

  /**
   * Search clips using filename matching (no AI analysis)
   * @param {string} query - Search query
   * @returns {Promise<Array>} Array of search results sorted by filename match
   */
  async searchClips(query) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      // Get all media files
      const allClips = this.mediaStore.mediaFiles;
      
      if (allClips.length === 0) {
        return [];
      }

      const normalizedQuery = query.toLowerCase().trim();
      
      // Simple filename-based search
      const results = allClips
        .filter(clip => {
          const fileName = clip.fileName.toLowerCase();
          return fileName.includes(normalizedQuery);
        })
        .map(clip => ({
          ...clip,
          relevanceScore: this.calculateFilenameRelevance(clip.fileName, normalizedQuery)
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Return top 10 results
      return results.slice(0, 10);

    } catch (error) {
      console.error('Error searching clips:', error);
      return [];
    }
  }

  /**
   * Calculate relevance score based on filename matching
   * @param {string} fileName - The filename to match against
   * @param {string} query - The search query
   * @returns {number} Relevance score (0-100)
   */
  calculateFilenameRelevance(fileName, query) {
    const lowerFileName = fileName.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    // Exact match gets highest score
    if (lowerFileName === lowerQuery) {
      return 100;
    }
    
    // Starts with query gets high score
    if (lowerFileName.startsWith(lowerQuery)) {
      return 90;
    }
    
    // Contains query gets medium score
    if (lowerFileName.includes(lowerQuery)) {
      return 70;
    }
    
    // Word boundary match gets lower score
    const words = lowerFileName.split(/[\s\-_\.]+/);
    const queryWords = lowerQuery.split(/[\s\-_\.]+/);
    
    let wordMatches = 0;
    for (const queryWord of queryWords) {
      if (words.some(word => word.includes(queryWord))) {
        wordMatches++;
      }
    }
    
    if (wordMatches > 0) {
      return Math.round((wordMatches / queryWords.length) * 50);
    }
    
    return 0;
  }


  /**
   * Get indexing status
   * @returns {Object} Current indexing status
   */
  getIndexingStatus() {
    return {
      isIndexing: this.isIndexing,
      progress: this.indexingProgress,
      progressPercentage: this.indexingProgress.total > 0 
        ? Math.round((this.indexingProgress.current / this.indexingProgress.total) * 100)
        : 0
    };
  }

  /**
   * Get search statistics
   * @returns {Object} Search statistics
   */
  getSearchStats() {
    const totalClips = this.mediaStore.mediaFiles.length;

    return {
      totalClips,
      message: 'AI indexing disabled - only filename search available'
    };
  }

  /**
   * Re-index a specific clip (placeholder - no AI analysis)
   * @param {string} clipId - ID of the clip to re-index
   * @returns {Promise<Object>} Re-indexing result
   */
  async reindexClip(clipId) {
    const clip = this.mediaStore.getMediaFileById(clipId);
    if (!clip) {
      throw new Error('Clip not found');
    }

    console.log(`Re-indexing disabled for clip: ${clip.fileName}`);
    
    return {
      success: true,
      clipId: clip.id,
      skipped: true,
      message: 'AI re-indexing disabled'
    };
  }

  /**
   * Re-index all clips (placeholder - no AI analysis)
   * @param {Function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Batch re-indexing results
   */
  async reindexAllClips(progressCallback = null) {
    console.log('AI re-indexing disabled - no clips will be processed');
    
    return {
      success: true,
      processed: 0,
      successful: 0,
      failed: 0,
      results: [],
      message: 'AI re-indexing disabled'
    };
  }
}

// Export singleton instance (lazy initialization)
let _brollSearchService = null;
export const brollSearchService = () => {
  if (!_brollSearchService) {
    _brollSearchService = new BrollSearchService();
  }
  return _brollSearchService;
};
