import express from 'express';
import { intelligentJobScraping } from '../../intelligent-scraping.js';
import { initDatabase, getDatabase } from '../database/init.js';
import logger from '../utils/logger.js';

const router = express.Router();

// On-demand intelligent scraping endpoint
router.post('/scrape-on-demand', async (req, res) => {
  try {
    const { searchQuery, maxJobs = 10 } = req.body;
    
    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Search query is required',
        message: 'Please provide a search term to scrape jobs for'
      });
    }

    logger.info(`Starting on-demand scraping for: "${searchQuery}"`);
    
    // Start scraping in background and return immediately
    res.json({ 
      message: 'Scraping started',
      searchQuery,
      status: 'started',
      estimatedTime: '30-60 seconds'
    });

    // Perform scraping in background
    try {
      const jobsFound = await intelligentJobScraping(searchQuery.trim());
      
      logger.info(`On-demand scraping completed for "${searchQuery}": ${jobsFound} jobs found`);
      
      // Log the scraping result (simplified - no database logging)
      console.log(`✅ Scraping completed successfully: ${jobsFound} jobs found`);
      
    } catch (scrapingError) {
      logger.error(`On-demand scraping failed for "${searchQuery}":`, scrapingError);
      
      // Log the error (simplified - no database logging)
      console.log(`❌ Scraping failed: ${scrapingError.message}`);
    }
    
  } catch (error) {
    logger.error('Error in on-demand scraping endpoint:', error);
    // Only send response if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: 'Failed to start scraping process'
      });
    }
  }
});

// Get scraping status (simplified approach)
router.get('/scraping-status', async (req, res) => {
  try {
    // Simple status - always return idle since we're not tracking in database
    res.json({ 
      status: 'idle',
      message: 'Scraping system ready'
    });
  } catch (error) {
    logger.error('Error getting scraping status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get scraping status',
      error: error.message 
    });
  }
});

// Get jobs with intelligent search
router.get('/jobs/search', async (req, res) => {
  try {
    const { q: searchQuery, page = 1, limit = 20 } = req.query;
    
    if (!searchQuery) {
      return res.status(400).json({ 
        error: 'Search query is required',
        message: 'Please provide a search term (q parameter)'
      });
    }

    const db = getDatabase();
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Search jobs with intelligent matching
    const jobs = await new Promise((resolve, reject) => {
      db.all(`
        SELECT j.*, js.site, js.url as source_url, js.external_id
        FROM jobs j
        JOIN job_sources js ON j.id = js.job_id
        WHERE (
          LOWER(j.title) LIKE LOWER(?) OR
          LOWER(j.company) LIKE LOWER(?) OR
          LOWER(j.description_snippet) LIKE LOWER(?)
        )
        ORDER BY j.posted_at DESC
        LIMIT ? OFFSET ?
      `, [
        `%${searchQuery}%`,
        `%${searchQuery}%`, 
        `%${searchQuery}%`,
        parseInt(limit),
        offset
      ], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Get total count
    const totalCount = await new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(*) as count
        FROM jobs j
        JOIN job_sources js ON j.id = js.job_id
        WHERE (
          LOWER(j.title) LIKE LOWER(?) OR
          LOWER(j.company) LIKE LOWER(?) OR
          LOWER(j.description_snippet) LIKE LOWER(?)
        )
      `, [
        `%${searchQuery}%`,
        `%${searchQuery}%`,
        `%${searchQuery}%`
      ], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    
    // Transform to frontend format
    const transformedJobs = jobs.map(job => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      workMode: job.work_mode,
      category: job.category,
      experience: job.experience,
      salaryMin: job.salary_min,
      salaryMax: job.salary_max,
      descriptionSnippet: job.description_snippet,
      descriptionFull: job.description_full,
      postedAt: job.posted_at,
      logoUrl: job.logo_url,
      sources: [{
        site: job.site,
        url: job.source_url,
        postedAt: job.posted_at,
        externalId: job.external_id
      }]
    }));
    
    res.json({
      jobs: transformedJobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      },
      searchQuery
    });
    
  } catch (error) {
    logger.error('Error searching jobs:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to search jobs'
    });
  }
});

export default router;
