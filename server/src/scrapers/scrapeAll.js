import { IndeedScraper } from './indeed.js';
import { SeekScraper } from './seek.js';
import { GlassdoorScraper } from './glassdoor.js';
import { LinkedInScraper } from './linkedin.js';
import { getDatabase } from '../database/init.js';
import logger from '../utils/logger.js';

export async function scrapeAllSites(sites = ['indeed', 'seek', 'glassdoor', 'linkedin']) {
  const results = {
    totalJobs: 0,
    jobsBySite: {},
    errors: []
  };

  for (const site of sites) {
    const startTime = Date.now();
    let scraper;
    let jobs = [];
    let status = 'success';
    let errorMessage = null;

    try {
      logger.info(`Starting scraping for ${site}`);
      
      // Initialize appropriate scraper
      switch (site.toLowerCase()) {
        case 'indeed':
          scraper = new IndeedScraper();
          break;
        case 'seek':
          scraper = new SeekScraper();
          break;
        case 'glassdoor':
          scraper = new GlassdoorScraper();
          break;
        case 'linkedin':
          scraper = new LinkedInScraper();
          break;
        default:
          throw new Error(`Unknown site: ${site}`);
      }

      // Scrape jobs
      jobs = await scraper.scrapeJobs();
      
      // Save to database
      await scraper.saveJobsToDatabase(jobs);
      
      results.jobsBySite[site] = jobs.length;
      results.totalJobs += jobs.length;
      
      logger.info(`Successfully scraped ${jobs.length} jobs from ${site}`);
      
    } catch (error) {
      status = 'error';
      errorMessage = error.message;
      results.errors.push({ site, error: errorMessage });
      logger.error(`Error scraping ${site}:`, error);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Log scraping result to database
    try {
      const db = getDatabase();
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO scraping_logs (
            site, status, jobs_found, jobs_added, jobs_updated,
            error_message, started_at, completed_at, duration_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          site,
          status,
          jobs.length,
          jobs.length, // Assuming all jobs are new for simplicity
          0, // No updates for now
          errorMessage,
          new Date(startTime).toISOString(),
          new Date(endTime).toISOString(),
          duration
        ], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
    } catch (logError) {
      logger.error('Error logging scraping result:', logError);
    }

    // Add delay between sites to avoid being blocked
    if (sites.indexOf(site) < sites.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
    }
  }

  logger.info(`Scraping completed. Total jobs: ${results.totalJobs}`);
  return results;
}

// Individual site scraping functions for manual triggers
export async function scrapeIndeed() {
  const scraper = new IndeedScraper();
  const jobs = await scraper.scrapeJobs();
  await scraper.saveJobsToDatabase(jobs);
  return jobs;
}

export async function scrapeSeek() {
  const scraper = new SeekScraper();
  const jobs = await scraper.scrapeJobs();
  await scraper.saveJobsToDatabase(jobs);
  return jobs;
}

export async function scrapeGlassdoor() {
  const scraper = new GlassdoorScraper();
  const jobs = await scraper.scrapeJobs();
  await scraper.saveJobsToDatabase(jobs);
  return jobs;
}

export async function scrapeLinkedIn() {
  const scraper = new LinkedInScraper();
  const jobs = await scraper.scrapeJobs();
  await scraper.saveJobsToDatabase(jobs);
  return jobs;
}
