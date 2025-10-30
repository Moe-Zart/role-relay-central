import express from 'express';
import jobsRouter from './jobs.js';
// Removed intelligent on-demand scraping routes
import resumeRouter from './resume.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// API version prefix
router.use('/api/v1', jobsRouter);
// router.use('/api/v1/scraping', onDemandScrapingRoutes);
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
      
    }
  });
});

// Logs endpoints for debugging (return last 50 lines)
router.get('/api/v1/status/errors', (req, res) => {
  try {
    const errLogPath = path.join(process.cwd(), 'server', 'logs', 'error.log');
    if (!fs.existsSync(errLogPath)) return res.json({ log: [] });
    const data = fs.readFileSync(errLogPath, 'utf8');
    const lines = data.trim().split(/\r?\n/).slice(-50);
    res.json({ log: lines });
  } catch (e) {
    res.status(500).json({ error: 'Could not read error log' });
  }
});
router.get('/api/v1/status/logs', (req, res) => {
  try {
    const logPath = path.join(process.cwd(), 'server', 'logs', 'combined.log');
    if (!fs.existsSync(logPath)) return res.json({ log: [] });
    const data = fs.readFileSync(logPath, 'utf8');
    const lines = data.trim().split(/\r?\n/).slice(-50);
    res.json({ log: lines });
  } catch (e) {
    res.status(500).json({ error: 'Could not read combined log' });
  }
});

export default router;