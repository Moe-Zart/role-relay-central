import express from 'express';
import jobsRouter from './jobs.js';
import onDemandScrapingRoutes from './on-demand-scraping.js';
import resumeRouter from './resume.js';

const router = express.Router();

// API version prefix
router.use('/api/v1', jobsRouter);
router.use('/api/v1/scraping', onDemandScrapingRoutes);
router.use('/api/v1/resume', resumeRouter);

// Root endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Job Scraper API',
    version: '1.0.0',
    endpoints: {
      jobs: '/api/v1/jobs',
      jobById: '/api/v1/jobs/:id',
      jobStats: '/api/v1/jobs/stats',
      scrapingLogs: '/api/v1/scraping/logs',
      triggerScraping: '/api/v1/scraping/trigger',
      onDemandScraping: '/api/v1/scraping/scrape-on-demand',
      scrapingStatus: '/api/v1/scraping/scraping-status',
      jobSearch: '/api/v1/scraping/jobs/search'
    }
  });
});

export default router;