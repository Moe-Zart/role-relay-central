import express from 'express';
import { getDatabase } from '../database/init.js';
import logger from '../utils/logger.js';
import { semanticMatcher } from '../services/semanticMatcher.js';

const router = express.Router();

// Get all jobs with optional filtering
router.get('/jobs', async (req, res) => {
  try {
    const db = getDatabase();
    const { 
      page = 1, 
      limit = 20, 
      search, 
      location, 
      category, 
      workMode, 
      experience,
      salaryMin,
      salaryMax,
      company,
      postedWithin
    } = req.query;
    
    let query = `
      SELECT j.*, 
             GROUP_CONCAT(
               json_object(
                 'site', js.site,
                 'url', js.url,
                 'postedAt', js.posted_at,
                 'externalId', js.external_id
               )
             ) as sources_json
      FROM jobs j
      LEFT JOIN job_sources js ON j.id = js.job_id
    `;
    
    const conditions = [];
    const params = [];
    let whereParamsCount = 0; // Track how many params are for WHERE conditions
    
    if (search) {
      // Intelligent search: split by space to handle multiple terms
      // First term is the core query, remaining are synonyms/expansions from intelligent matcher
      // Make search more specific: prioritize matches in title/company over description
      // This ensures jobs are relevant to the search term, not just tangentially mentioned
      const searchTerms = search.trim().split(/\s+/).filter(term => term.length > 0);
      
      if (searchTerms.length > 0) {
        // Require that at least one search term matches in title OR company
        // This ensures the job is actually about the searched role, not just mentions it in description
        const titleCompanyConditions = searchTerms.map(() => {
          return '(j.title LIKE ? OR j.company LIKE ?)';
        });
        
        // Also allow description matches, but only as secondary (will be lower relevance)
        const descriptionConditions = searchTerms.map(() => {
          return '(j.description_snippet LIKE ? OR j.description_full LIKE ?)';
        });
        
        // Match if: any term in title/company OR (any term in description AND at least core term in title/company)
        // This keeps results specific while still finding related roles via synonyms
        const coreTerm = searchTerms[0];
        conditions.push(`((${titleCompanyConditions.join(' OR ')}) OR ((${descriptionConditions.join(' OR ')}) AND (j.title LIKE ? OR j.company LIKE ?)))`);
        
        // Add parameters in order:
        // 1. All terms for title/company matches
        searchTerms.forEach(term => {
          const pattern = `%${term}%`;
          params.push(pattern, pattern);
        });
        // 2. All terms for description matches
        searchTerms.forEach(term => {
          const pattern = `%${term}%`;
          params.push(pattern, pattern);
        });
        // 3. Core term again for the "at least one title/company" requirement
        params.push(`%${coreTerm}%`, `%${coreTerm}%`);
      }
    }
    
    if (location) {
      conditions.push('j.location LIKE ?');
      params.push(`%${location}%`);
    }
    
    if (category) {
      conditions.push('j.category = ?');
      params.push(category);
    }
    
    if (workMode) {
      // Handle comma-separated array or single value
      const workModes = typeof workMode === 'string' ? workMode.split(',').filter(Boolean) : [workMode];
      if (workModes.length > 0) {
        const placeholders = workModes.map(() => '?').join(',');
        conditions.push(`j.work_mode IN (${placeholders})`);
        params.push(...workModes);
      }
    }
    
    if (experience) {
      // Handle comma-separated array or single value
      const experiences = typeof experience === 'string' ? experience.split(',').filter(Boolean) : [experience];
      if (experiences.length > 0) {
        const placeholders = experiences.map(() => '?').join(',');
        conditions.push(`j.experience IN (${placeholders})`);
        params.push(...experiences);
      }
    }
    
    if (company) {
      conditions.push('j.company LIKE ?');
      params.push(`%${company}%`);
    }
    
    if (postedWithin) {
      const now = new Date();
      let daysAgo = 0;
      
      switch (postedWithin) {
        case '24h':
          daysAgo = 1;
          break;
        case '3d':
          daysAgo = 3;
          break;
        case '7d':
          daysAgo = 7;
          break;
        case '14d':
          daysAgo = 14;
          break;
        default:
          daysAgo = 0;
      }
      
      if (daysAgo > 0) {
        const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        conditions.push('j.posted_at >= ?');
        params.push(cutoffDate.toISOString());
      }
    }
    
    if (salaryMin) {
      conditions.push('j.salary_min >= ?');
      params.push(parseInt(salaryMin));
    }
    
    if (salaryMax) {
      conditions.push('j.salary_max <= ?');
      params.push(parseInt(salaryMax));
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // Track where WHERE params end (before ORDER BY params)
    whereParamsCount = params.length;
    
    // Order by: If search query exists, prioritize relevance (title matches > company matches > description matches)
    // Otherwise, order by posted_at DESC (newest first)
    // Note: Frontend will apply additional sorting (newest, company a-z, etc.) if user selects a sort option
    let orderBy = 'j.posted_at DESC';
    if (search) {
      const searchTerms = search.trim().split(/\s+/).filter(term => term.length > 0);
      if (searchTerms.length > 0) {
        // Build relevance scoring: title matches score highest, then company, then description
        // Each term adds to the score
        const relevanceParts = [];
        const relevanceParams = [];
        
        searchTerms.forEach((term, termIdx) => {
          const weight = searchTerms.length - termIdx; // First term gets highest weight
          relevanceParts.push(`CASE WHEN j.title LIKE ? THEN ${weight * 10} ELSE 0 END`);
          relevanceParts.push(`CASE WHEN j.company LIKE ? THEN ${weight * 5} ELSE 0 END`);
          relevanceParts.push(`CASE WHEN j.description_snippet LIKE ? THEN ${weight * 2} ELSE 0 END`);
          relevanceParams.push(`%${term}%`, `%${term}%`, `%${term}%`);
        });
        
        orderBy = `(${relevanceParts.join(' + ')}) DESC, j.posted_at DESC`;
        // Add parameters for ORDER BY CASE statements
        params.push(...relevanceParams);
      }
    }
    
    query += ` GROUP BY j.id ORDER BY ${orderBy}`;
    
    // IMPORTANT: For AI semantic matching, we need to process ALL matching jobs first,
    // then apply pagination after semantic filtering
    // If no search query, apply pagination directly
    let processedJobs;
    let totalCount;
    
    if (search) {
      // For search queries, fetch ALL matching jobs (no pagination yet)
      // AI will filter and rank them, then we'll paginate
      const allJobs = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      // Parse sources JSON
      let allProcessedJobs = allJobs.map(job => ({
        ...job,
        sources: job.sources_json ? JSON.parse(`[${job.sources_json}]`) : []
      }));
      
      logger.info(`Applying AI semantic matching to ${allProcessedJobs.length} jobs for query: "${search}"`);
      logger.info('AI is analyzing all jobs to find the best matches...');
      
      // Use a stricter similarity threshold (0.55) to filter out unrelated jobs
      const minSimilarity = 0.55;
      
      // Score ALL jobs semantically and filter out low-similarity matches
      const scoredJobs = await semanticMatcher.scoreJobs(search, allProcessedJobs, minSimilarity);
      
      if (scoredJobs.length === 0) {
        logger.warn(`No jobs passed semantic similarity threshold (${minSimilarity}) for query: "${search}"`);
        processedJobs = [];
        totalCount = 0;
      } else {
        // Map and sort by semantic relevance (higher is better)
        processedJobs = scoredJobs.map(job => ({
          ...job,
          combinedRelevanceScore: job.semanticScore
        }));
        
        // Sort by semantic relevance (higher is better)
        processedJobs.sort((a, b) => {
          // Primary: semantic score (higher is better)
          const scoreDiff = b.semanticScore - a.semanticScore;
          if (Math.abs(scoreDiff) > 0.01) {
            return scoreDiff;
          }
          // Secondary: posted date (newer is better)
          const dateA = new Date(a.posted_at || 0).getTime();
          const dateB = new Date(b.posted_at || 0).getTime();
          return dateB - dateA;
        });
        
        totalCount = processedJobs.length;
        
        // NOW apply pagination after AI filtering and ranking
        const offset = (parseInt(page) - 1) * parseInt(limit);
        processedJobs = processedJobs.slice(offset, offset + parseInt(limit));
        
        logger.info(`AI semantic matching completed. ${totalCount} jobs passed threshold, showing page ${page} (${processedJobs.length} jobs). Top job semantic score: ${processedJobs[0]?.semanticScore?.toFixed(3)}`);
      }
    } else {
      // No search query - apply pagination directly to SQL query
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += ` LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), offset);
      
      const jobs = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      // Parse sources JSON
      processedJobs = jobs.map(job => ({
        ...job,
        sources: job.sources_json ? JSON.parse(`[${job.sources_json}]`) : []
      }));
      
      // Get total count from count query (will be set below)
      totalCount = null; // Will be set from count query
    }
    
    // Get total count for pagination
    // For search queries, we already have the count from AI filtering
    // For non-search queries, get count from database
    let finalTotal;
    if (search && totalCount !== null) {
      // Use the count from AI-filtered results
      finalTotal = totalCount;
    } else {
      // Get total count from database query
      let countQuery = 'SELECT COUNT(DISTINCT j.id) as total FROM jobs j';
      if (conditions.length > 0) {
        countQuery += ' WHERE ' + conditions.join(' AND ');
      }
      
      const countResult = await new Promise((resolve, reject) => {
        // Only use params for WHERE conditions (exclude ORDER BY and pagination params)
        const whereParams = params.slice(0, whereParamsCount);
        db.get(countQuery, whereParams, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      finalTotal = countResult.total;
    }
    
    res.json({
      jobs: processedJobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: finalTotal,
        totalPages: Math.ceil(finalTotal / parseInt(limit))
      }
    });
    
  } catch (error) {
    logger.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get job by ID
router.get('/jobs/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const job = await new Promise((resolve, reject) => {
      db.get(`
        SELECT j.*, 
               GROUP_CONCAT(
                 json_object(
                   'site', js.site,
                   'url', js.url,
                   'postedAt', js.posted_at,
                   'externalId', js.external_id
                 )
               ) as sources_json
        FROM jobs j
        LEFT JOIN job_sources js ON j.id = js.job_id
        WHERE j.id = ?
        GROUP BY j.id
      `, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    job.sources = job.sources_json ? JSON.parse(`[${job.sources_json}]`) : [];
    
    res.json(job);
    
  } catch (error) {
    logger.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Get job statistics
router.get('/jobs/stats', async (req, res) => {
  try {
    const db = getDatabase();
    
    const stats = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(*) as total_jobs,
          COUNT(DISTINCT company) as unique_companies,
          COUNT(DISTINCT category) as unique_categories,
          COUNT(DISTINCT location) as unique_locations,
          AVG(salary_min) as avg_salary_min,
          AVG(salary_max) as avg_salary_max
        FROM jobs
      `, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    // Get jobs by category
    const categoryStats = await new Promise((resolve, reject) => {
      db.all(`
        SELECT category, COUNT(*) as count
        FROM jobs
        GROUP BY category
        ORDER BY count DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Get jobs by source
    const sourceStats = await new Promise((resolve, reject) => {
      db.all(`
        SELECT js.site, COUNT(*) as count
        FROM job_sources js
        GROUP BY js.site
        ORDER BY count DESC
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({
      ...stats,
      categoryBreakdown: categoryStats,
      sourceBreakdown: sourceStats
    });
    
  } catch (error) {
    logger.error('Error fetching job stats:', error);
    res.status(500).json({ error: 'Failed to fetch job statistics' });
  }
});

// Get all companies for dropdown
router.get('/companies', async (req, res) => {
  try {
    const db = getDatabase();
    
    const companies = await new Promise((resolve, reject) => {
      db.all(`
        SELECT DISTINCT company, COUNT(*) as job_count
        FROM jobs
        GROUP BY company
        ORDER BY company ASC
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    res.json({
      companies: companies.map(c => ({
        name: c.company,
        jobCount: c.job_count
      }))
    });
    
  } catch (error) {
    logger.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get all categories for dropdown
router.get('/categories', async (req, res) => {
  try {
    const db = getDatabase();
    
    const categories = await new Promise((resolve, reject) => {
      db.all(`
        SELECT DISTINCT category, COUNT(*) as job_count
        FROM jobs
        WHERE category IS NOT NULL AND category != ''
        GROUP BY category
        ORDER BY category ASC
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    res.json({
      categories: categories.map(c => ({
        name: c.category,
        jobCount: c.job_count
      }))
    });
    
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get scraping logs (Jora only - filter out old entries from other sites)
router.get('/scraping/logs', async (req, res) => {
  try {
    const db = getDatabase();
    const { limit = 50 } = req.query;
    
    // Only return logs for Jora scraping (ignore old Indeed, Seek, LinkedIn, Glassdoor entries)
    const logs = await new Promise((resolve, reject) => {
      db.all(`
        SELECT *
        FROM scraping_logs
        WHERE site = 'jora' OR site IS NULL OR site = ''
        ORDER BY started_at DESC
        LIMIT ?
      `, [parseInt(limit)], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    res.json(logs);
    
  } catch (error) {
    logger.error('Error fetching scraping logs:', error);
    res.status(500).json({ error: 'Failed to fetch scraping logs' });
  }
});

// Trigger manual scraping (Jora only)
router.post('/scraping/trigger', async (req, res) => {
  try {
    // Jora is the only supported site now
    const { scrapeAllSites } = await import('../scrapers/scrapeAll.js');
    scrapeAllSites(['jora'])
      .then(() => { logger.info('Manual scraping completed (Jora)'); })
      .catch((error) => { logger.error('Manual scraping failed:', error); });
    res.json({ message: 'Scraping started', sites: ['jora'] });
    
  } catch (error) {
    logger.error('Error triggering scraping:', error);
    res.status(500).json({ error: 'Failed to trigger scraping' });
  }
});

// Also support GET for convenience (though POST is preferred)
router.get('/scraping/trigger', async (req, res) => {
  try {
    // Jora is the only supported site now
    const { scrapeAllSites } = await import('../scrapers/scrapeAll.js');
    scrapeAllSites(['jora'])
      .then(() => { logger.info('Manual scraping completed (Jora)'); })
      .catch((error) => { logger.error('Manual scraping failed:', error); });
    res.json({ message: 'Scraping started', sites: ['jora'] });
    
  } catch (error) {
    logger.error('Error triggering scraping:', error);
    res.status(500).json({ error: 'Failed to trigger scraping' });
  }
});

export default router;
