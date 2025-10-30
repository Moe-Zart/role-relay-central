import axios from 'axios';
import { load } from 'cheerio';
import { getDatabase } from '../database/init.js';
import logger from '../utils/logger.js';

export class JoraScraper {
  constructor() {
    this.baseUrl = 'https://au.jora.com';
    this.searchUrl = 'https://au.jora.com/jobs';
  }

  async scrapeJobs(searchTerms = [
    'software engineer','developer','software developer','web developer','frontend','backend','full stack','typescript','javascript','react','node',
    'data','data engineer','data analyst','data scientist','etl','sql','python',
    'devops','sre','platform','cloud','aws','azure','gcp',
    'cyber','security','soc','siem','penetration tester','iam',
    'qa','test engineer','automation',
    'support','helpdesk','service desk','it support','desktop support',
    'systems administrator','network engineer','infrastructure','site reliability',
    'mobile','ios','android','flutter','react native',
    'product manager','scrum master','agile','ba','business analyst'
  ], maxPages = 2) {
    const jobs = [];
    try {
      for (const term of searchTerms) {
        for (let page = 1; page <= maxPages; page++) {
          const pageJobs = await this.scrapePage(term, page);
          jobs.push(...pageJobs);
          await this.delay(1500);
        }
      }
      logger.info(`Jora: collected ${jobs.length} jobs`);
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 20000
    });
    const $ = load(res.data);

    const results = [];
    $('[data-automation="job-list"] [data-automation="job-card"], .job-card, article').each((i, el) => {
      try {
        const titleEl = $(el).find('[data-automation="job-title"], a.job-title, h2 a').first();
        const companyEl = $(el).find('[data-automation="job-company"], .job-company, .company, .job-organisation').first();
        const locationEl = $(el).find('[data-automation="job-location"], .job-location, .location').first();
        const descEl = $(el).find('[data-automation="job-short-description"], .job-abstract, .job-snippet, .job-description').first();
        const postedEl = $(el).find('[data-automation="job-date"], .job-listed-date, time').first();

        const title = titleEl.text().trim();
        if (!title) return;
        const company = companyEl.text().trim() || 'Unknown';
        const location = locationEl.text().trim() || '';
        const description = descEl.text().trim() || '';
        const href = titleEl.attr('href') || '';
        const jobUrl = href.startsWith('http') ? href : this.baseUrl + href;
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
