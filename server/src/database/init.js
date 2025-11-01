import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../data/jobs.db');

let db;

export const initDatabase = async () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logger.error('Error opening database:', err);
        reject(err);
        return;
      }
      
      logger.info('Connected to SQLite database');
      
      // Create tables
      createTables()
        .then(() => {
          logger.info('Database tables created successfully');
          resolve();
        })
        .catch(reject);
    });
  });
};

const createTables = async () => {
  const run = promisify(db.run.bind(db));
  
  try {
    // Jobs table
    await run(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        location TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        work_mode TEXT NOT NULL CHECK (work_mode IN ('Remote', 'On-site', 'Hybrid')),
        category TEXT NOT NULL,
        experience TEXT NOT NULL CHECK (experience IN ('Internship', 'Junior', 'Mid', 'Senior', 'Lead')),
        salary_min INTEGER,
        salary_max INTEGER,
        description_snippet TEXT NOT NULL,
        description_full TEXT NOT NULL,
        posted_at TEXT NOT NULL,
        logo_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Job sources table
    await run(`
      CREATE TABLE IF NOT EXISTS job_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        site TEXT NOT NULL CHECK (site IN ('Jora', 'Company', 'Other')),
        url TEXT NOT NULL,
        posted_at TEXT NOT NULL,
        external_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
        UNIQUE(job_id, site, external_id)
      )
    `);
    
    // Scraping logs table
    await run(`
      CREATE TABLE IF NOT EXISTS scraping_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial', 'completed', 'failed')),
        jobs_found INTEGER DEFAULT 0,
        jobs_added INTEGER DEFAULT 0,
        jobs_updated INTEGER DEFAULT 0,
        error_message TEXT,
        started_at DATETIME NOT NULL,
        completed_at DATETIME,
        duration_ms INTEGER
      )
    `);
    
    // Create indexes for better performance
    await run(`CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_job_sources_job_id ON job_sources(job_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_job_sources_site ON job_sources(site)`);
    
    logger.info('Database tables and indexes created');
  } catch (error) {
    logger.error('Error creating tables:', error);
    throw error;
  }
};

export const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

export const closeDatabase = () => {
  if (db) {
    db.close((err) => {
      if (err) {
        logger.error('Error closing database:', err);
      } else {
        logger.info('Database connection closed');
      }
    });
  }
};
