import axios from 'axios';
import { load } from 'cheerio';
import { getDatabase } from '../database/init.js';
import logger from '../utils/logger.js';

export class JoraScraper {
  constructor() {
    this.baseUrl = 'https://au.jora.com';
    this.searchUrl = 'https://au.jora.com/jobs';
  }

  async scrapeJobs(maxPages = 3) {
    const itKeywords = ['developer', 'engineer', 'programmer', 'software', 'full stack', 'frontend', 'backend', 'data', 'analytics', 'cloud', 'cybersecurity', 'designer', 'it'];
    const jobs = [];
    const seen = new Set();
    try {
      // Use a broad IT search term that Jora will accept
      const searchQuery = 'developer software IT technology';
      for (let page = 1; page <= maxPages; page++) {
        const pageJobs = await this.scrapePage(searchQuery, page);
        // Filter to only IT-related jobs matching our OR keywords
        const itJobs = pageJobs.filter(job => {
          const combinedText = (job.title + ' ' + job.descriptionSnippet + ' ' + job.category).toLowerCase();
          return itKeywords.some(keyword => combinedText.includes(keyword.toLowerCase()));
        });
        for (const j of itJobs) {
          const key = j.sources?.[0]?.externalId || j.sources?.[0]?.url || (j.title + j.company);
          if (!seen.has(key)) {
            seen.add(key);
            jobs.push(j);
          }
        }
        await this.delay(1000);
      }
      logger.info(`Jora: collected ${jobs.length} IT jobs (filtered from broader search)`);
      return jobs;
    } catch (err) {
      logger.error('Jora scrape failed:', err);
      throw err;
    }
  }

  async scrapePage(searchTerm, pageNumber) {
    const params = new URLSearchParams({
      q: searchTerm,
      pn: String(pageNumber)
    });
    const url = `${this.searchUrl}?${params.toString()}`;
    logger.info(`Jora: GET ${url}`);
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 20000
    });
    const $ = load(res.data);

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
      logger.warn(`Jora: No jobs found on page ${pageNumber}. HTML length: ${res.data.length}`);
      // Log a sample of the HTML for debugging
      logger.debug(`Jora: HTML sample (first 500 chars): ${res.data.substring(0, 500)}`);
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

    // Try to augment each job with a Company website source (best-effort)
    for (const job of results) {
      try {
        const companyUrl = await this.fetchCompanySite(job.sources[0].url);
        if (companyUrl) {
          job.sources.push({ site: 'Company', url: companyUrl, postedAt: job.postedAt, externalId: `company_${Date.now()}` });
        }
        await this.delay(500);
      } catch (_) {
        // ignore failures to fetch company site
      }
    }

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

  async fetchCompanySite(jobUrl) {
    try {
      const res = await axios.get(jobUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 20000
      });
      const $ = load(res.data);

      // 1) Look for explicit "Apply on company site" link text
      const applyTextSelectors = [
        'a:contains("Apply on company site")',
        'a:contains("Apply on employer website")',
        'a:contains("Apply on company website")',
        'a:contains("Apply on employer site")',
        'a:contains("Company site")',
        'a:contains("Employer site")'
      ];
      for (const sel of applyTextSelectors) {
        const el = $(sel).first();
        if (el && el.attr('href')) {
          const href = el.attr('href');
          if (href && !href.toLowerCase().includes('jora.com')) return href;
        }
      }

      // 2) Some pages may have a primary apply button wrapping an anchor
      const buttonCandidates = [
        'a[data-automation="apply-button"]',
        'a[aria-label*="company"]',
        'a[href*="apply"]',
        'a[target="_blank"]'
      ];
      for (const sel of buttonCandidates) {
        const el = $(sel).first();
        if (el && el.attr('href')) {
          const href = el.attr('href');
          if (href && !href.toLowerCase().includes('jora.com')) return href;
        }
      }

      // 3) Fallback: first external non-Jora link on page
      let fallback = '';
      $('a[href^="http"]').each((_, a) => {
        const href = $(a).attr('href') || '';
        if (!href) return;
        const lower = href.toLowerCase();
        if (lower.includes('jora.com')) return;
        fallback = href;
        return false;
      });
      return fallback || null;
    } catch (e) {
      return null;
    }
  }

  async saveJobsToDatabase(jobs) {
    const db = getDatabase();
    const exec = (sql) => new Promise((resolve, reject) => db.exec(sql, (err) => err ? reject(err) : resolve()));
    const run = (sql, params) => new Promise((resolve, reject) => db.run(sql, params, function(err){ err ? reject(err) : resolve(this.lastID); }));

    try {
      await exec('BEGIN');
      for (const job of jobs) {
        try {
          const jobId = `jora_${job.sources[0].externalId}`;
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
          for (const source of job.sources) {
            await run(`
              INSERT OR REPLACE INTO job_sources (
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
        } catch (e) {
          if (e && e.code === 'SQLITE_BUSY') {
            await this.delay(200);
          } else {
            logger.error('Jora: save job failed', e);
          }
        }
      }
      await exec('COMMIT');
    } catch (txErr) {
      try { await exec('ROLLBACK'); } catch(_) {}
      logger.error('Jora: transaction failed', txErr);
    }
  }
}
