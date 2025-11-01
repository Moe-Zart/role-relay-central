import { JoraScraper } from './jora.js';
import logger from '../utils/logger.js';

export async function scrapeAllSites(sites = ['jora']) {
  const results = {
    totalJobs: 0,
    jobsBySite: {},
    errors: []
  };

  for (const site of sites) {
    const startTime = Date.now();
    let jobs = [];
    let status = 'success';
    let errorMessage = null;

    try {
      if (site !== 'jora') throw new Error('Only Jora scraping supported');
      logger.info('Starting Jora scraping for IT jobs with exact URL format...');
      const scraper = new JoraScraper();
      // Use the exact URL format with OR search terms
      jobs = await scraper.scrapeWithExactUrl('Sydney NSW', 3);
      await scraper.saveJobsToDatabase(jobs);
      logger.info(`Jora scraped ${jobs.length} jobs`);
    } catch (error) {
      status = 'error';
      errorMessage = error.message;
      results.errors.push({ site, error: errorMessage });
      logger.error('Error scraping:', error);
    }

    const endTime = Date.now();
    results.jobsBySite[site] = jobs.length;
    results.totalJobs += jobs.length;
  }
  logger.info('Scraping completed. Total jobs:', results.totalJobs);
  return results;
}

