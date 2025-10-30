import OpenAI from 'openai';

export class BrollSearchHandler {
  constructor() {
    this.openai = null;
    this.apiKey = process.env.OPENAI_API_KEY;
    
    console.log('BrollSearchHandler initialized:');
    console.log('- API Key present:', !!this.apiKey);
    console.log('- API Key length:', this.apiKey ? this.apiKey.length : 0);
    console.log('- API Key starts with sk-:', this.apiKey ? this.apiKey.startsWith('sk-') : false);
    
    if (this.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.apiKey
      });
    }
  }

  /**
   * Check if OpenAI API key is configured
   * @returns {boolean} True if API key is available
   */
  hasApiKey() {
    return !!this.apiKey && !!this.openai;
  }

  /**
   * Generate descriptive tags for a video file using GPT-4o with vision
   * @param {string} filePath - The full path to the video file
   * @returns {Promise<string[]>} Array of 5 descriptive tags
   */
  async generateTags(filePath) {
    if (!this.hasApiKey()) {
      throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.');
    }

    try {
      // Extract frames from video for analysis
      const frames = await this.extractVideoFrames(filePath);
      
      if (frames.length === 0) {
        throw new Error('Could not extract frames from video');
      }

      // Convert frames to base64 for OpenAI vision
      const frameImages = await Promise.all(
        frames.map(frame => this.convertFrameToBase64(frame))
      );

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a nightlife video specialist. Analyze these 15 frames and generate exactly 5 descriptive tags focusing on SPECIFIC visual elements you see:\n\nLOOK FOR:\n- Lighting: strobe lights, neon, laser beams, light patterns, darkness, colored lighting\n- DJ/Equipment: DJ close-up, DJ booth, hands on equipment, turntables, mixer, CDJs\n- Dancing: people dancing, shuffling, jumping, hands up, crowd movement\n- Crowd: panning crowd shots, crowd density, crowd energy, raised hands\n- Movement: camera panning, tracking shots, driving shots, handheld movement\n- People: smiling faces, close-ups, expressions, silhouettes\n- Venue: stage, dance floor, bar area, VIP section\n\nReturn only 5 specific tags, one per line. Be VERY specific about what you see (e.g., "DJ hands on mixer" not just "DJ", "strobe lighting" not just "lights").'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Generate 5 specific tags describing exactly what you see in these frames. Focus on: lighting effects (strobe/neon/laser), DJ actions (hands on equipment, close-ups), dancing styles (shuffling, jumping, hands up), crowd movement (panning, density), camera movement (driving, tracking), and facial expressions (smiling, energy).'
              },
              ...frameImages.map((image, index) => ({
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image}`,
                  detail: 'low'
                }
              }))
            ]
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      const content = response.choices[0].message.content.trim();
      const tags = content.split('\n')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .slice(0, 5); // Ensure exactly 5 tags

      return tags;
    } catch (error) {
      console.error('Error generating tags:', error);
      throw new Error(`Failed to generate tags: ${error.message}`);
    }
  }

  /**
   * Create embedding for text using text-embedding-3-small
   * @param {string} text - Text to create embedding for
   * @returns {Promise<number[]>} 1536-dimensional embedding vector
   */
  async createEmbedding(text) {
    if (!this.hasApiKey()) {
      throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: text
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error creating embedding:', error);
      throw new Error(`Failed to create embedding: ${error.message}`);
    }
  }

  /**
   * Compute cosine similarity between query embedding and clip embeddings
   * @param {number[]} queryEmbedding - Query embedding vector
   * @param {Array<{id: string, embedding: number[]}>} clipEmbeddings - Array of clips with embeddings
   * @returns {Array<{id: string, similarity: number}>} Clips sorted by similarity (descending)
   */
  computeSimilarity(queryEmbedding, clipEmbeddings) {
    if (!queryEmbedding || queryEmbedding.length === 0) {
      return [];
    }

    const results = clipEmbeddings
      .filter(clip => clip.embedding && clip.embedding.length > 0)
      .map(clip => {
        const similarity = this.cosineSimilarity(queryEmbedding, clip.embedding);
        return {
          id: clip.id,
          similarity: similarity
        };
      })
      .sort((a, b) => b.similarity - a.similarity); // Sort by similarity descending

    return results;
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {number[]} vectorA - First vector
   * @param {number[]} vectorB - Second vector
   * @returns {number} Cosine similarity score (-1 to 1)
   */
  cosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Extract representative frames from a video file
   * @param {string} filePath - Full path to the video file
   * @returns {Promise<string[]>} Array of frame file paths
   */
  async extractVideoFrames(filePath) {
    const ffmpeg = require('fluent-ffmpeg');
    const path = require('path');
    const fs = require('fs').promises;
    const os = require('os');
    
    // Create temp directory for frames
    const tempDir = path.join(os.tmpdir(), 'broll-frames');
    await fs.mkdir(tempDir, { recursive: true });
    
    const framePaths = [];
    const videoId = path.basename(filePath, path.extname(filePath));
    
    return new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .on('end', async () => {
          try {
            // Read the generated frame files
            const files = await fs.readdir(tempDir);
            const frameFiles = files
              .filter(file => file.startsWith(videoId))
              .map(file => path.join(tempDir, file))
              .sort();
            
            resolve(frameFiles);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject)
        .screenshots({
          timestamps: [
            '5%', '10%', '15%', '25%', '35%', '45%', '50%', 
            '55%', '65%', '75%', '85%', '90%', '95%', '98%', '99%'
          ], // Extract 15 frames for better coverage
          filename: `${videoId}-frame-%i.jpg`,
          folder: tempDir,
          size: '320x240' // Small size for faster processing
        });
    });
  }

  /**
   * Convert a frame image to base64 for OpenAI vision
   * @param {string} framePath - Path to the frame image
   * @returns {Promise<string>} Base64 encoded image
   */
  async convertFrameToBase64(framePath) {
    const fs = require('fs').promises;
    const imageBuffer = await fs.readFile(framePath);
    return imageBuffer.toString('base64');
  }

  /**
   * Generate tags and embedding for a clip (convenience method)
   * @param {string} filePath - Full path to the video file
   * @returns {Promise<{tags: string[], embedding: number[]}>} Generated tags and embedding
   */
  async indexClip(filePath) {
    if (!this.hasApiKey()) {
      throw new Error('OpenAI API key not configured. Please add OPENAI_API_KEY to your .env file.');
    }

    try {
      // Generate tags from video content
      const tags = await this.generateTags(filePath);
      
      // Create embedding from tags
      const tagsText = tags.join(' ');
      const embedding = await this.createEmbedding(tagsText);

      return {
        tags,
        embedding
      };
    } catch (error) {
      console.error('Error indexing clip:', error);
      throw error;
    }
  }
}
