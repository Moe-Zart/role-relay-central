import { pipeline } from '@xenova/transformers';
import logger from '../utils/logger.js';

class SemanticMatcher {
  constructor() {
    this.model = null;
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize the semantic model (lazy loading)
   */
  async initialize() {
    if (this.initialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        logger.info('Initializing semantic matching model...');
        // Use a lightweight sentence similarity model optimized for speed
        // This model is good for semantic similarity without being too heavy
        this.model = await pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2', // Fast, lightweight, good quality
          { quantized: true } // Use quantized model for faster inference
        );
        this.initialized = true;
        logger.info('Semantic matching model initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize semantic model:', error);
        // Fallback to keyword matching if model fails
        this.initialized = false;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Generate embeddings for a text
   */
  async getEmbedding(text) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.model || !this.initialized) {
      return null; // Fallback to keyword matching
    }

    try {
      const result = await this.model(text, {
        pooling: 'mean',
        normalize: true,
      });
      return Array.from(result.data);
    } catch (error) {
      logger.error('Error generating embedding:', error);
      return null;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Calculate semantic similarity between a query and job text
   * Returns a score between 0 and 1
   * Higher scores mean better semantic match
   */
  async calculateSimilarity(query, jobTitle, jobDescription = '') {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.model || !this.initialized) {
      // Fallback: return 0 to use keyword matching only
      return 0;
    }

    try {
      // Prioritize job title for matching - titles are more specific
      // Use description as secondary context (shorter snippet for faster processing)
      const descriptionSnippet = (jobDescription || '').substring(0, 200).trim();
      const jobText = `${jobTitle} ${descriptionSnippet}`.trim().substring(0, 512);
      
      // Get embeddings
      const queryEmbedding = await this.getEmbedding(query);
      const jobEmbedding = await this.getEmbedding(jobText);

      if (!queryEmbedding || !jobEmbedding) {
        return 0;
      }

      // Calculate similarity
      const similarity = this.cosineSimilarity(queryEmbedding, jobEmbedding);
      
      // Normalize to 0-1 range (cosine similarity is already -1 to 1, but we normalize to 0-1)
      let normalizedScore = (similarity + 1) / 2;
      
      // Boost score if query keywords appear directly in title (exact match boost)
      const queryLower = query.toLowerCase();
      const titleLower = jobTitle.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3); // Only significant words
      
      let exactMatchBoost = 0;
      queryWords.forEach(word => {
        if (titleLower.includes(word)) {
          exactMatchBoost += 0.15; // Boost for each matching keyword
        }
      });
      
      // Apply boost but cap at reasonable level
      normalizedScore = Math.min(1.0, normalizedScore + exactMatchBoost);
      
      // More conservative scoring - penalize very low similarities more
      if (normalizedScore < 0.4) {
        // Heavily penalize low similarities
        normalizedScore = normalizedScore * 0.5;
      }
      
      return normalizedScore;
    } catch (error) {
      logger.error('Error calculating semantic similarity:', error);
      return 0;
    }
  }

  /**
   * Calculate semantic relevance scores for multiple jobs
   * Filters out jobs with similarity below threshold
   * Returns jobs with added semanticScore field
   * 
   * @param {string} query - Search query
   * @param {Array} jobs - Array of job objects
   * @param {number} minSimilarityThreshold - Minimum similarity score to include (0-1), default 0.5
   * @returns {Array} Filtered and scored jobs
   */
  async scoreJobs(query, jobs, minSimilarityThreshold = 0.5) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.model || !this.initialized || !jobs || jobs.length === 0) {
      // Return jobs without semantic scores if model isn't available
      return jobs.map(job => ({ ...job, semanticScore: 0 }));
    }

    try {
      // Process in batches to avoid overwhelming the model
      const batchSize = 10;
      const scoredJobs = [];

      for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (job) => {
          const jobText = `${job.title || ''} ${job.description_snippet || ''}`.trim();
          const similarity = await this.calculateSimilarity(query, job.title || '', jobText);
          return {
            ...job,
            semanticScore: similarity
          };
        });

        const scoredBatch = await Promise.all(batchPromises);
        scoredJobs.push(...scoredBatch);
      }

      // Filter out jobs below similarity threshold
      // This ensures we only show semantically relevant jobs
      const filteredJobs = scoredJobs.filter(job => job.semanticScore >= minSimilarityThreshold);
      
      logger.info(`Semantic filtering: ${scoredJobs.length} jobs scored, ${filteredJobs.length} above threshold ${minSimilarityThreshold}`);
      
      return filteredJobs;
    } catch (error) {
      logger.error('Error scoring jobs semantically:', error);
      // Return jobs without semantic scores on error
      return jobs.map(job => ({ ...job, semanticScore: 0 }));
    }
  }
}

// Export singleton instance
export const semanticMatcher = new SemanticMatcher();

