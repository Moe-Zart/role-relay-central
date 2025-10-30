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
      sources
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
    
    if (search) {
      conditions.push('(j.title LIKE ? OR j.company LIKE ? OR j.description_snippet LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
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
      conditions.push('j.work_mode = ?');
      params.push(workMode);
    }
    
    if (experience) {
      conditions.push('j.experience = ?');
      params.push(experience);
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
    
    query += ' GROUP BY j.id ORDER BY j.posted_at DESC';
    
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
    let countQuery = 'SELECT COUNT(*) as total FROM jobs j';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    
    const countResult = await new Promise((resolve, reject) => {
      db.get(countQuery, params.slice(0, -2), (err, row) => {
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

// Get scraping logs
router.get('/scraping/logs', async (req, res) => {
  try {
    const db = getDatabase();
    const { limit = 50 } = req.query;
    
    const logs = await new Promise((resolve, reject) => {
      db.all(`
        SELECT *
        FROM scraping_logs
        ORDER BY started_at DESC
        LIMIT ?
      `, [parseInt(limit)], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
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
    // Jora is the only supported site now; ignore provided sites
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
