import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { resumeParser } from '../services/resumeParser.js';
import { resumeMatcher } from '../services/resumeMatcher.js';
import { getDatabase } from '../database/init.js';
import logger from '../utils/logger.js';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * POST /api/v1/resume/upload
 * Upload and parse resume
 */
router.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Accept PDF and DOCX (for now, PDF only for parsing)
    if (req.file.mimetype !== 'application/pdf') {
      res.status(400).json({ 
        error: 'Only PDF files are supported. Please convert your resume to PDF.' 
      });
      return;
    }

    logger.info(`Processing resume upload: ${req.file.originalname} (${req.file.size} bytes)`);

    // Parse PDF
    const pdfData = await pdfParse(req.file.buffer);
    const resumeText = pdfData.text;

    if (!resumeText || resumeText.trim().length < 50) {
      res.status(400).json({ 
        error: 'Resume text could not be extracted. Please ensure the PDF contains selectable text.' 
      });
      return;
    }

    logger.info(`Extracted ${resumeText.length} characters from resume`);

    // Parse resume using AI
    logger.info('Starting AI resume parsing...');
    const parsedResume = await resumeParser.parseResume(resumeText);

    logger.info('Resume parsing completed successfully');

    res.json({
      success: true,
      fileName: req.file.originalname,
      size: req.file.size,
      parsedResume,
      message: 'Resume parsed successfully'
    });
  } catch (error) {
    logger.error('Resume upload error:', error);
    res.status(500).json({ 
      error: 'Failed to parse resume',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/resume/match-jobs
 * Match resume to existing jobs in database
 */
router.post('/match-jobs', async (req, res) => {
  try {
    const { parsedResume } = req.body;

    if (!parsedResume) {
      res.status(400).json({ error: 'No parsed resume data provided' });
      return;
    }

    logger.info('Matching resume to jobs in database...');

    // Fetch all jobs from database
    const db = getDatabase();
    const jobs = await new Promise((resolve, reject) => {
      db.all(`
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
        GROUP BY j.id
        ORDER BY j.posted_at DESC
        LIMIT 500
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Parse sources JSON
    const processedJobs = jobs.map(job => ({
      ...job,
      sources: job.sources_json ? JSON.parse(`[${job.sources_json}]`) : []
    }));

    logger.info(`Found ${processedJobs.length} jobs to match against`);

    // Match resume to jobs
    const matchedJobs = await resumeMatcher.matchResumeToJobs(parsedResume, processedJobs);

    // Filter jobs with match score above threshold (50%)
    const relevantJobs = matchedJobs.filter(job => job.resumeMatch.matchPercentage >= 50);

    logger.info(`Found ${relevantJobs.length} relevant jobs (>=50% match)`);

    res.json({
      success: true,
      totalJobs: processedJobs.length,
      relevantJobs: relevantJobs.length,
      matchedJobs: relevantJobs.map(job => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        workMode: job.work_mode,
        experience: job.experience,
        descriptionSnippet: job.description_snippet,
        descriptionFull: job.description_full,
        postedAt: job.posted_at,
        sources: job.sources,
        resumeMatch: job.resumeMatch
      })),
      resumeSummary: {
        skills: parsedResume.skills.slice(0, 10),
        technologies: parsedResume.technologies.slice(0, 10),
        experienceLevel: parsedResume.experienceLevel,
        yearsOfExperience: parsedResume.yearsOfExperience
      }
    });
  } catch (error) {
    logger.error('Error matching resume to jobs:', error);
    res.status(500).json({ 
      error: 'Failed to match resume to jobs',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/resume/match-single-job
 * Match resume to a single job (for individual job cards)
 */
router.post('/match-single-job', async (req, res) => {
  try {
    const { parsedResume, job } = req.body;

    if (!parsedResume || !job) {
      res.status(400).json({ error: 'Missing parsedResume or job data' });
      return;
    }

    const matchDetails = await resumeMatcher.matchJobToResume(parsedResume, job);

    res.json({
      success: true,
      matchDetails
    });
  } catch (error) {
    logger.error('Error matching single job:', error);
    res.status(500).json({ 
      error: 'Failed to match job',
      details: error.message 
    });
  }
});

/**
 * POST /api/v1/resume/match-all-jobs
 * Match resume to ALL jobs in database (for comprehensive matching)
 */
router.post('/match-all-jobs', async (req, res) => {
  try {
    const { parsedResume } = req.body;

    if (!parsedResume) {
      res.status(400).json({ error: 'No parsed resume data provided' });
      return;
    }

    logger.info('Matching resume to ALL jobs in database...');

    // Fetch ALL jobs from database (no limit)
    const db = getDatabase();
    const jobs = await new Promise((resolve, reject) => {
      db.all(`
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
        GROUP BY j.id
        ORDER BY j.posted_at DESC
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Parse sources JSON
    const processedJobs = jobs.map(job => ({
      ...job,
      sources: job.sources_json ? JSON.parse(`[${job.sources_json}]`) : []
    }));

    logger.info(`Found ${processedJobs.length} total jobs to match against`);

    // Match resume to all jobs with progress tracking
    // Process in smaller batches for better control and to ensure all jobs are processed
    const batchSize = 10; // Smaller batches for more accurate processing
    const allMatches = [];
    
    logger.info(`Starting strict matching process on ${processedJobs.length} jobs (minimum 40% match required)...`);
    
    for (let i = 0; i < processedJobs.length; i += batchSize) {
      const batch = processedJobs.slice(i, i + batchSize);
      
      // Process batch sequentially to ensure each job is properly analyzed
      for (const job of batch) {
        try {
          const matchDetails = await resumeMatcher.matchJobToResume(parsedResume, job);
          
          // Only include jobs with match percentage >= 40% (strict threshold)
          if (matchDetails.matchPercentage >= 40) {
            allMatches.push({ jobId: job.id, matchDetails });
          }
        } catch (error) {
          logger.error(`Error matching job ${job.id}:`, error);
          // Continue with next job if one fails
        }
      }
      
      // Log progress every 50 jobs
      if ((i + batchSize) % 50 === 0 || (i + batchSize) >= processedJobs.length) {
        const processed = Math.min(i + batchSize, processedJobs.length);
        const progressPercent = ((processed / processedJobs.length) * 100).toFixed(1);
        logger.info(`Progress: ${processed}/${processedJobs.length} jobs (${progressPercent}%) - ${allMatches.length} matches found so far (>=40% match)`);
      }
    }

    // Sort by match percentage (highest first)
    allMatches.sort((a, b) => b.matchDetails.matchPercentage - a.matchDetails.matchPercentage);

    logger.info(`✅ Resume matching completed. ${allMatches.length} relevant jobs found (out of ${processedJobs.length} total) with >=40% match. Top match: ${allMatches[0]?.matchDetails?.matchPercentage}%`);

    // Return job IDs and match details
    // Frontend will fetch full job data using these IDs
    res.json({
      success: true,
      totalJobs: processedJobs.length,
      matchedJobs: allMatches.length,
      matches: allMatches // Array of { jobId, matchDetails }
    });
  } catch (error) {
    logger.error('Error matching resume to all jobs:', error);
    res.status(500).json({ 
      error: 'Failed to match resume to all jobs',
      details: error.message 
    });
  }
});

export default router;
