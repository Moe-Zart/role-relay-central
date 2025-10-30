import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import keywordExtractor from 'keyword-extractor';
import nlp from 'compromise';
import { getDatabase } from '../database/init.js';
import { scoreResumeAgainstJobs, llmContextualJobFitScore } from '../services/intelligentJobMatcher.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/v1/resume/upload
router.post('/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Only allow PDF
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are supported' });
    }

    const pdfData = await pdfParse(req.file.buffer);
    res.json({
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      numPages: pdfData.numpages,
      text: pdfData.text,
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    res.status(500).json({ error: 'Failed to parse PDF resume' });
  }
});

// POST /api/v1/resume/extract-keywords
router.post('/extract-keywords', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No resume text provided' });
    }

    // Basic keyword-extractor usage
    const basicKeywords = keywordExtractor.extract(text, {
      language: 'english',
      remove_digits: true,
      return_changed_case: true,
      remove_duplicates: true,
    });
    
    // Named Entity Recognition (NER) using compromise
    const doc = nlp(text);
    const people = doc.people().out('array');
    const organizations = doc.organizations().out('array');
    const skills = doc.match('#Skill+').out('array'); // #Skill is not default tag; could use patterns or custom
    const dates = doc.dates().out('array');
    // Other relevant custom extraction patterns can be configured here.

    res.json({
      basicKeywords,
      entities: {
        people,
        organizations,
        skills,
        dates,
      }
    });
  } catch (error) {
    console.error('Keyword extraction error:', error);
    res.status(500).json({ error: 'Keyword extraction failed' });
  }
});

// POST /api/v1/resume/match-jobs
router.post('/match-jobs', async (req, res) => {
  try {
    const { text, limit = 10 } = req.body;
    if (!text) return res.status(400).json({ error: 'No resume text provided' });
    // Fetch jobs
    const db = getDatabase();
    const jobs = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM jobs ORDER BY posted_at DESC LIMIT 100', (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });
    // Run semantic similarity scoring
    const ranked = scoreResumeAgainstJobs(text, jobs).slice(0, limit);
    res.json({ matches: ranked });
  } catch (error) {
    console.error('Job match error:', error);
    res.status(500).json({ error: 'Failed to match jobs to resume' });
  }
});

// POST /api/v1/resume/llm-job-fit
router.post('/llm-job-fit', async (req, res) => {
  try {
    const { resumeText, jobText } = req.body;
    if (!resumeText || !jobText) return res.status(400).json({ error: 'resumeText and jobText are required' });
    const score = await llmContextualJobFitScore(resumeText, jobText);
    res.json({ score, note: 'This is a demo value. Replace with actual LLM API call for production.' });
  } catch (error) {
    console.error('LLM job fit error:', error);
    res.status(500).json({ error: 'Failed to compute LLM job fit score' });
  }
});

export default router;
