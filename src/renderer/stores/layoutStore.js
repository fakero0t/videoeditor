import { defineStore } from 'pinia';

export const useLayoutStore = defineStore('layout', {
  state: () => ({
    // Panel sizes in pixels
    mediaLibraryWidth: 300,
    previewHeight: 200,
    
    // Constraints
    minMediaLibraryWidth: 150,
    maxMediaLibraryWidth: 600,
    minPreviewHeight: 100,
    maxPreviewHeight: 500,
    
    // Persistence key
    storageKey: 'clipforge-layout-sizes'
  }),
  
  getters: {
    // Get media library width as CSS value
    mediaLibraryWidthStyle: (state) => `${state.mediaLibraryWidth}px`,
    
    // Get preview height as CSS value  
    previewHeightStyle: (state) => `${state.previewHeight}px`,
    
    // Get timeline height (calculated as remaining space)
    timelineHeightStyle: (state) => `calc(100% - ${state.previewHeight}px - 40px)`, // 40px for transport controls
  },
  
  actions: {
    // Set media library width with constraints
    setMediaLibraryWidth(width) {
      this.mediaLibraryWidth = Math.max(
        this.minMediaLibraryWidth,
        Math.min(this.maxMediaLibraryWidth, width)
      );
      this.saveToStorage();
    },
    
    // Set preview height with constraints
    setPreviewHeight(height) {
      this.previewHeight = Math.max(
        this.minPreviewHeight,
        Math.min(this.maxPreviewHeight, height)
      );
      this.saveToStorage();
    },
    
    // Reset to default sizes
    resetSizes() {
      this.mediaLibraryWidth = 300;
      this.previewHeight = 200;
      this.saveToStorage();
    },
    
    // Load sizes from localStorage
    loadFromStorage() {
      try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.mediaLibraryWidth) {
            this.mediaLibraryWidth = Math.max(
              this.minMediaLibraryWidth,
              Math.min(this.maxMediaLibraryWidth, data.mediaLibraryWidth)
            );
          }
          if (data.previewHeight) {
            this.previewHeight = Math.max(
              this.minPreviewHeight,
              Math.min(this.maxPreviewHeight, data.previewHeight)
            );
          }
        }
      } catch (error) {
        console.warn('Failed to load layout sizes from storage:', error);
      }
    },
    
    // Save sizes to localStorage
    saveToStorage() {
      try {
        const data = {
          mediaLibraryWidth: this.mediaLibraryWidth,
          previewHeight: this.previewHeight
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
      } catch (error) {
        console.warn('Failed to save layout sizes to storage:', error);
      }
    },
    
    // Initialize store (call this on app startup)
    initialize() {
      this.loadFromStorage();
    }
  }
});
