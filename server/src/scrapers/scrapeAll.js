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
      logger.info('Starting Jora scraping with exact URL format (all job types: developer, programmer, software engineer, frontend, backend, data, analyst, cloud, cybersecurity, web, IT)...');
      const scraper = new JoraScraper();
      // Use the exact URL format with OR search terms - scrape up to 10 pages
      jobs = await scraper.scrapeWithExactUrl('Sydney NSW', 10);
      await scraper.saveJobsToDatabase(jobs);
      logger.info(`Jora scraped ${jobs.length} jobs from exact URL`);
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

