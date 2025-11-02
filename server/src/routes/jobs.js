import express from 'express';
import { getDatabase } from '../database/init.js';
import logger from '../utils/logger.js';

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
      // Any term matching is enough (OR of ORs) - this allows broader results from expanded search queries
      const searchTerms = search.trim().split(/\s+/).filter(term => term.length > 0);
      
      if (searchTerms.length > 0) {
        // For each search term, create OR conditions (title OR company OR description)
        // Then combine all terms with OR (any term matching is enough)
        const termConditions = searchTerms.map(() => {
          return '(j.title LIKE ? OR j.company LIKE ? OR j.description_snippet LIKE ? OR j.description_full LIKE ?)';
        });
        
        conditions.push(`(${termConditions.join(' OR ')})`);
        
        // Add parameters for each term (title, company, snippet, full description)
        searchTerms.forEach(term => {
          const searchPattern = `%${term}%`;
          params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        });
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
    
    // Add pagination
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
    const processedJobs = jobs.map(job => ({
      ...job,
      sources: job.sources_json ? JSON.parse(`[${job.sources_json}]`) : []
    }));
    
    // Get total count for pagination
    // Use only WHERE condition params (not ORDER BY or LIMIT/OFFSET params)
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
    
    res.json({
      jobs: processedJobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / parseInt(limit))
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
