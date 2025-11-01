import express from 'express';
import { JoraScraper } from '../scrapers/jora.js';
import { getDatabase } from '../database/init.js';
import logger from '../utils/logger.js';

const router = express.Router();

// On-demand scraping with exact Jora URL format
router.post('/scrape-on-demand', async (req, res) => {
  try {
    const { searchQuery, location = 'Sydney NSW', maxJobs = 15 } = req.body;

    if (!searchQuery || !searchQuery.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    logger.info(`Starting on-demand scraping with exact URL format for: "${searchQuery}" in ${location}`);

    // Perform scraping in background
    try {
      const scraper = new JoraScraper();
      
      // Use the exact URL format with OR search terms
      // The search query from user is used for filtering/logging, but we use the exact OR terms
      // Scrape up to 10 pages to get all job types: developer, programmer, software engineer, frontend, backend, data, analyst, cloud, cybersecurity, web, IT
      const jobsFound = await scraper.scrapeWithExactUrl(location, 10);
      
      // Save jobs to database
      await scraper.saveJobsToDatabase(jobsFound);
      
      logger.info(`On-demand scraping completed: ${jobsFound.length} jobs found and saved`);
      
      // Return success response
      res.json({
        success: true,
        message: 'Scraping completed successfully',
        jobsFound: jobsFound.length,
        searchQuery,
        location
      });
      
    } catch (scrapingError) {
      logger.error(`On-demand scraping failed:`, scrapingError);
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Scraping failed',
          error: scrapingError.message
        });
      }
    }
    
  } catch (error) {
    logger.error('Error in on-demand scraping endpoint:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
});

// Get scraping status (simplified approach)
router.get('/scraping-status', async (req, res) => {
  try {
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

// Get jobs with search
router.get('/jobs/search', async (req, res) => {
  try {
    const { q: searchQuery, page = 1, limit = 20 } = req.query;
    const db = getDatabase();
    
    // Simple text search in job titles and descriptions
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = `%${searchQuery}%`;
    
    const jobs = await new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          j.*,
          GROUP_CONCAT(js.site) as sites,
          GROUP_CONCAT(js.url) as urls
        FROM jobs j
        LEFT JOIN job_sources js ON j.id = js.job_id
        WHERE j.title LIKE ? OR j.description_snippet LIKE ?
        GROUP BY j.id
        ORDER BY j.posted_at DESC
        LIMIT ? OFFSET ?
      `, [searchTerm, searchTerm, parseInt(limit), offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    const total = await new Promise((resolve, reject) => {
      db.get(`
        SELECT COUNT(DISTINCT j.id) as count
        FROM jobs j
        WHERE j.title LIKE ? OR j.description_snippet LIKE ?
      `, [searchTerm, searchTerm], (err, row) => {
        if (err) reject(err);
        else resolve(row?.count || 0);
      });
    });
    
    const formattedJobs = jobs.map(job => ({
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
      sources: job.sites ? job.sites.split(',').map((site, i) => ({
        site,
        url: job.urls ? job.urls.split(',')[i] : null
      })) : []
    }));
    
    res.json({
      jobs: formattedJobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    logger.error('Error searching jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search jobs',
      error: error.message
    });
  }
});

export default router;

