import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import keywordExtractor from 'keyword-extractor';
import nlp from 'compromise';
import { getDatabase } from '../database/init.js';

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

// Removed AI-based matching; search now works over pre-scraped jobs only

// Removed LLM contextual job fit endpoint

// Keep /optimize only if needed. Otherwise, disable advanced features

// Removed ATS enhancement endpoint to simplify flow

// Removed rank-matches endpoint

export default router;
