import cron from 'node-cron';
import { scrapeAllSites } from '../scrapers/scrapeAll.js';
import logger from '../utils/logger.js';

export function startScrapingScheduler() {
  // Schedule scraping every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Starting scheduled scraping job');
    try {
      const results = await scrapeAllSites();
      logger.info('Scheduled scraping completed:', results);
    } catch (error) {
      logger.error('Scheduled scraping failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "Australia/Sydney"
  });

  // Schedule a lighter scraping job every 2 hours (fewer pages)
  cron.schedule('0 */2 * * *', async () => {
    logger.info('Starting light scraping job');
    try {
      // Scrape with fewer pages to avoid overwhelming the sites
      const results = await scrapeAllSites(['indeed', 'seek']); // Only scrape Indeed and Seek more frequently
      logger.info('Light scraping completed:', results);
    } catch (error) {
      logger.error('Light scraping failed:', error);
    }
  }, {
    scheduled: true,
    timezone: "Australia/Sydney"
  });

  logger.info('Scraping scheduler started - Full scraping every 6 hours, light scraping every 2 hours');
}
