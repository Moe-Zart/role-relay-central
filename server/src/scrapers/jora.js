import puppeteer from 'puppeteer';
import { load } from 'cheerio';
import { getDatabase } from '../database/init.js';
import logger from '../utils/logger.js';

export class JoraScraper {
  constructor() {
    this.baseUrl = 'https://au.jora.com';
  }

  // Scrape using EXACT URL provided by user - no modifications
  async scrapeWithExactUrl(location = 'Sydney NSW', maxPages = 5) {
    const jobs = [];
    const seen = new Set();
    
    try {
      // Use the EXACT URL as provided - no keyword manipulation
      // This URL searches for: developer, programmer, software engineer, frontend, backend, data, analyst, cloud, cybersecurity, web, IT
      const exactBaseUrl = 'https://au.jora.com/j?a=14d&disallow=true&l=Sydney+NSW&q=%22developer%22+OR+%22programmer%22+OR+%22software+engineer%22+OR+%22frontend%22+OR+%22backend%22+OR+%22data%22+OR+%22analyst%22+OR+%22cloud%22+OR+%22cybersecurity%22+OR+%22web%22+OR+%22IT%22&sa=70000&sp=facet_listed_date';
      
      logger.info(`Jora: Using EXACT URL with all search terms: developer, programmer, software engineer, frontend, backend, data, analyst, cloud, cybersecurity, web, IT`);
      
      for (let page = 1; page <= maxPages; page++) {
        // Add pagination parameter - Jora uses pn parameter (try including for page 1 too)
        // Some sites require pn=1 for page 1, others start from pn=2
        const url = page === 1 ? exactBaseUrl : `${exactBaseUrl}&pn=${page}`;
        
        logger.info(`Jora: Scraping page ${page} of ${maxPages}: ${url}`);
        const pageJobs = await this.scrapeExactUrlPage(url);
        
        logger.info(`Jora: Found ${pageJobs.length} jobs on page ${page}`);
        
        // Log sample job URLs from this page for debugging
        if (pageJobs.length > 0) {
          const sampleUrls = pageJobs.slice(0, 3).map(j => j.sources?.[0]?.url || 'no-url').join(', ');
          logger.info(`Jora: Sample job URLs from page ${page}: ${sampleUrls}`);
        }
        
        let addedThisPage = 0;
        let skippedThisPage = 0;
        
        // Add ALL jobs from the page - no filtering, with improved deduplication
        for (const job of pageJobs) {
          // Create a more robust deduplication key
          // Priority: URL > externalId > normalized title+company
          const jobUrl = job.sources?.[0]?.url || '';
          const externalId = job.sources?.[0]?.externalId || '';
          const normalizedTitle = (job.title || '').toLowerCase().trim().replace(/\s+/g, ' ');
          const normalizedCompany = (job.company || '').toLowerCase().trim().replace(/\s+/g, ' ');
          
          // Use URL as primary key if available (most reliable)
          // Extract job ID from URL pattern: /job/123456 or jk=abc123
          let key = '';
          if (jobUrl) {
            // Extract the job ID from URL
            const urlMatch = jobUrl.match(/\/job\/(\d+)|jk=([A-Za-z0-9]+)/);
            if (urlMatch) {
              key = (urlMatch[1] || urlMatch[2] || '').toLowerCase();
            } else {
              // Use normalized URL as fallback
              key = jobUrl.toLowerCase().trim();
            }
          } else if (externalId) {
            key = externalId.toLowerCase().trim();
          } else {
            key = `${normalizedTitle}|${normalizedCompany}`.toLowerCase().trim();
          }
          
          if (!key) {
            logger.warn(`Jora: Could not generate key for job: ${job.title} at ${job.company}`);
            continue;
          }
          
          if (!seen.has(key)) {
            seen.add(key);
            jobs.push(job);
            addedThisPage++;
          } else {
            skippedThisPage++;
            logger.debug(`Jora: Skipping duplicate on page ${page}: ${job.title} at ${job.company} (key: ${key})`);
          }
        }
        
        logger.info(`Jora: Page ${page} - Added ${addedThisPage} new, skipped ${skippedThisPage} duplicates`);
        
        // If we got fewer jobs than expected, we might have reached the end
        if (pageJobs.length === 0) {
          logger.info(`Jora: No jobs found on page ${page}, stopping pagination`);
          break;
        }
        
        // If all jobs on this page were duplicates, might have reached the end of unique results
        if (pageJobs.length > 0 && addedThisPage === 0) {
          logger.warn(`Jora: Page ${page} had ${pageJobs.length} jobs but all were duplicates. May have reached end of unique results.`);
          
          // If we get 2 consecutive pages with all duplicates, pagination might be broken
          // Check if previous page also had all duplicates
          if (page > 2 && pageJobs.length >= 10) {
            // Sample the first job URL from this page and previous page to verify
            const currentPageFirstUrl = pageJobs[0]?.sources?.[0]?.url || '';
            logger.warn(`Jora: Suspicious - page ${page} returned ${pageJobs.length} jobs but all duplicates. First job URL: ${currentPageFirstUrl}`);
            logger.warn(`Jora: This might indicate pagination is broken and returning the same page repeatedly.`);
          }
        }
        
        await this.delay(1000);
      }
      
      logger.info(`Jora: Collected ${jobs.length} jobs from exact URL (no filtering, all job types)`);
      return jobs;
    } catch (err) {
      logger.error('Jora scrape with exact URL failed:', err);
      throw err;
    }
  }

  async scrapeExactUrlPage(url) {
    logger.info(`Jora: Loading page with Puppeteer: ${url}`);
    let browser = null;
    try {
      // Launch Puppeteer with realistic browser settings
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      
      // Set realistic viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set additional headers to appear more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-AU,en-US;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
      });

      // Navigate to the page and wait for content
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for job cards to be visible (ensures JavaScript has loaded)
      try {
        await page.waitForSelector('.job-card, [data-automation="job-card"]', { timeout: 10000 });
      } catch (e) {
        logger.warn(`Jora: Job cards selector not found, continuing anyway`);
      }

      // Wait a bit more for JavaScript to fully render pagination
      await page.waitForTimeout(3000);
      
      // Scroll down to trigger lazy loading if needed
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(1000);

      // Get the page HTML
      const html = await page.content();
      
      await browser.close();
      
      logger.info(`Jora: Successfully loaded page, parsing jobs...`);
      return this.parseJobPage(html);
    } catch (error) {
      if (browser) {
        await browser.close();
      }
      logger.error(`Jora: Error scraping page with Puppeteer: ${error.message}`);
      throw error;
    }
  }

  parseJobPage(html) {
    const $ = load(html);

    // Try multiple selector strategies for Jora's job listings
    const jobSelectors = [
      '[data-automation="job-card"]',
      '[data-automation="job-list"] [data-automation="job-card"]',
      '.job-card',
      '.job-item',
      'article[data-testid="job-card"]',
      'div[class*="job"]',
      'a[href*="/job/"]'
    ];

    let jobElements = [];
    for (const selector of jobSelectors) {
      jobElements = $(selector).toArray();
      if (jobElements.length > 0) {
        logger.info(`Jora: Found ${jobElements.length} jobs using selector: ${selector}`);
        break;
      }
    }

    if (jobElements.length === 0) {
      logger.warn(`Jora: No jobs found. HTML length: ${html.length}`);
      logger.debug(`Jora: HTML sample (first 500 chars): ${html.substring(0, 500)}`);
      return [];
    }

    const results = [];
    jobElements.forEach((el, i) => {
      try {
        const $el = $(el);
        // Try multiple ways to find the job title/link
        let titleEl = $el.find('[data-automation="job-title"]').first();
        if (!titleEl.length) titleEl = $el.find('a[href*="/job/"]').first();
        if (!titleEl.length) titleEl = $el.find('h2 a, h3 a, .title a').first();
        if (!titleEl.length) titleEl = $el.find('a').first();

        const title = titleEl.text().trim();
        if (!title) {
          logger.debug(`Jora: Skipping job ${i} - no title found`);
          return;
        }

        const href = titleEl.attr('href') || '';
        const jobUrl = href.startsWith('http') ? href : (href ? this.baseUrl + href : '');

        // Try multiple selectors for company
        let companyEl = $el.find('[data-automation="job-company"]').first();
        if (!companyEl.length) companyEl = $el.find('.job-company, .company, .employer, [class*="company"]').first();
        const company = companyEl.text().trim() || 'Unknown';

        // Try multiple selectors for location
        let locationEl = $el.find('[data-automation="job-location"]').first();
        if (!locationEl.length) locationEl = $el.find('.job-location, .location, [class*="location"]').first();
        const location = locationEl.text().trim() || '';

        // Try multiple selectors for description
        let descEl = $el.find('[data-automation="job-short-description"]').first();
        if (!descEl.length) descEl = $el.find('.job-abstract, .job-snippet, .job-description, .description').first();
        const description = descEl.text().trim() || '';

        // Try multiple selectors for posted date
        let postedEl = $el.find('[data-automation="job-date"]').first();
        if (!postedEl.length) postedEl = $el.find('.job-listed-date, time, .date').first();
        const postedText = postedEl.text().trim();

        const externalIdMatch = jobUrl.match(/job\/(\d+)|jk=([A-Za-z0-9]+)/);
        const externalId = (externalIdMatch && (externalIdMatch[1] || externalIdMatch[2])) || `jora_${Date.now()}_${i}`;

        const postedAt = new Date().toISOString();

        const workMode = this.determineWorkMode(title + ' ' + description);
        const experience = this.determineExperienceLevel(title + ' ' + description);
        const category = 'Software Engineering';

        results.push({
          title,
          company,
          location,
          workMode,
          category,
          experience,
          salaryMin: null,
          salaryMax: null,
          descriptionSnippet: description,
          descriptionFull: description,
          postedAt,
          sources: [{ site: 'Jora', url: jobUrl, postedAt, externalId }]
        });
      } catch (e) {
        // ignore element errors
      }
    });

    return results;
  }

  determineWorkMode(text) {
    const t = text.toLowerCase();
    if (t.includes('remote') || t.includes('work from home') || t.includes('wfh')) return 'Remote';
    if (t.includes('hybrid') || t.includes('flexible')) return 'Hybrid';
    return 'On-site';
  }

  determineExperienceLevel(text) {
    const t = text.toLowerCase();
    if (t.includes('senior') || t.includes('lead') || t.includes('principal') || t.includes('architect')) return 'Senior';
    if (t.includes('junior') || t.includes('graduate') || t.includes('entry')) return 'Junior';
    return 'Mid';
  }

  delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  async saveJobsToDatabase(jobs) {
    const db = getDatabase();
    const exec = (sql) => new Promise((resolve, reject) => db.exec(sql, (err) => err ? reject(err) : resolve()));
    const run = (sql, params) => new Promise((resolve, reject) => db.run(sql, params, function(err){ err ? reject(err) : resolve(this.lastID); }));
    const get = (sql, params) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));

    try {
      await exec('BEGIN');
      let savedCount = 0;
      let duplicateCount = 0;
      
      for (const job of jobs) {
        try {
          // Create a reliable job ID from URL or externalId
          const jobUrl = job.sources?.[0]?.url || '';
          const externalId = job.sources?.[0]?.externalId || '';
          
          let jobId = '';
          if (jobUrl) {
            // Extract job ID from URL
            const urlMatch = jobUrl.match(/job\/(\d+)|jk=([A-Za-z0-9]+)/);
            if (urlMatch) {
              jobId = `jora_${urlMatch[1] || urlMatch[2]}`;
            } else {
              // Use hash of URL as fallback
              jobId = `jora_${Buffer.from(jobUrl).toString('base64').slice(0, 20).replace(/[^a-zA-Z0-9]/g, '')}`;
            }
          } else if (externalId) {
            jobId = `jora_${externalId}`;
          } else {
            // Fallback: use normalized title+company hash
            const normalized = `${(job.title || '').toLowerCase().trim()}_${(job.company || '').toLowerCase().trim()}`;
            jobId = `jora_${Buffer.from(normalized).toString('base64').slice(0, 20).replace(/[^a-zA-Z0-9]/g, '')}`;
          }
          
          // Check if job already exists by URL (most reliable check)
          let existingJob = null;
          if (jobUrl) {
            existingJob = await get(`
              SELECT j.id FROM jobs j
              INNER JOIN job_sources js ON j.id = js.job_id
              WHERE js.url = ?
              LIMIT 1
            `, [jobUrl]);
          }
          
          // Also check by job ID as backup
          if (!existingJob) {
            existingJob = await get(`SELECT id FROM jobs WHERE id = ?`, [jobId]);
          }
          
          if (existingJob) {
            duplicateCount++;
            logger.debug(`Jora: Skipping duplicate job in database: ${job.title} at ${job.company} (ID: ${jobId})`);
            continue;
          }
          
          // Insert new job
          await run(`
            INSERT OR REPLACE INTO jobs (
              id, title, company, location, work_mode, category, experience,
              salary_min, salary_max, description_snippet, description_full,
              posted_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            jobId,
            job.title,
            job.company,
            job.location,
            job.workMode,
            job.category,
            job.experience,
            job.salaryMin,
            job.salaryMax,
            job.descriptionSnippet,
            job.descriptionFull,
            job.postedAt,
            new Date().toISOString()
          ]);
          
          // Insert job sources
          for (const source of job.sources) {
            await run(`
              INSERT OR IGNORE INTO job_sources (
                job_id, site, url, posted_at, external_id
              ) VALUES (?, ?, ?, ?, ?)
            `, [
              jobId,
              source.site,
              source.url,
              source.postedAt,
              source.externalId
            ]);
          }
          
          savedCount++;
        } catch (e) {
          if (e && e.code === 'SQLITE_BUSY') {
            await this.delay(200);
          } else {
            logger.error('Jora: save job failed', e);
          }
        }
      }
      
      await exec('COMMIT');
      logger.info(`Jora: Saved ${savedCount} new jobs, skipped ${duplicateCount} duplicates`);
    } catch (txErr) {
      try { await exec('ROLLBACK'); } catch(_) {}
      logger.error('Jora: transaction failed', txErr);
    }
  }
}
