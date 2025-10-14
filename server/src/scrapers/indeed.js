import puppeteer from 'puppeteer';
import { getDatabase } from '../database/init.js';
import logger from '../utils/logger.js';

export class IndeedScraper {
  constructor() {
    this.baseUrl = 'https://au.indeed.com';
    this.searchUrl = 'https://au.indeed.com/jobs';
  }

  async scrapeJobs(searchTerms = ['software engineer', 'developer', 'data scientist'], maxPages = 3) {
    const browser = await puppeteer.launch({
      headless: 'new',
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

    const jobs = [];
    
    try {
      for (const searchTerm of searchTerms) {
        logger.info(`Scraping Indeed for: ${searchTerm}`);
        
        for (let page = 0; page < maxPages; page++) {
          const pageJobs = await this.scrapePage(browser, searchTerm, page);
          jobs.push(...pageJobs);
          
          // Add delay between pages to avoid being blocked
          await this.delay(2000);
        }
      }
      
      logger.info(`Found ${jobs.length} jobs from Indeed`);
      return jobs;
      
    } catch (error) {
      logger.error('Error scraping Indeed:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  async scrapePage(browser, searchTerm, pageNumber) {
    const page = await browser.newPage();
    
    try {
      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      const url = `${this.searchUrl}?q=${encodeURIComponent(searchTerm)}&start=${pageNumber * 10}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for job listings to load
      await page.waitForSelector('[data-testid="job-title"]', { timeout: 10000 });
      
      const jobs = await page.evaluate(() => {
        const jobElements = document.querySelectorAll('[data-testid="job-title"]');
        const jobs = [];
        
        jobElements.forEach((element, index) => {
          try {
            const titleElement = element.querySelector('a[data-testid="job-title"]');
            const companyElement = document.querySelector(`[data-testid="company-name"]:nth-of-type(${index + 1})`);
            const locationElement = document.querySelector(`[data-testid="job-location"]:nth-of-type(${index + 1})`);
            const salaryElement = document.querySelector(`[data-testid="attribute_snippet_testid"]:nth-of-type(${index + 1})`);
            const descriptionElement = document.querySelector(`[data-testid="job-snippet"]:nth-of-type(${index + 1})`);
            
            if (titleElement && companyElement && locationElement) {
              const title = titleElement.textContent?.trim() || '';
              const company = companyElement.textContent?.trim() || '';
              const location = locationElement.textContent?.trim() || '';
              const salary = salaryElement?.textContent?.trim() || '';
              const description = descriptionElement?.textContent?.trim() || '';
              const jobUrl = titleElement.href || '';
              
              // Extract job ID from URL
              const jobIdMatch = jobUrl.match(/jk=([^&]+)/);
              const externalId = jobIdMatch ? jobIdMatch[1] : `indeed_${Date.now()}_${index}`;
              
              // Parse salary if available
              let salaryMin, salaryMax;
              if (salary) {
                const salaryMatch = salary.match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*-\s*\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
                if (salaryMatch) {
                  salaryMin = parseInt(salaryMatch[1].replace(/,/g, ''));
                  salaryMax = parseInt(salaryMatch[2].replace(/,/g, ''));
                } else {
                  const singleSalaryMatch = salary.match(/\$?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
                  if (singleSalaryMatch) {
                    salaryMin = parseInt(singleSalaryMatch[1].replace(/,/g, ''));
                    salaryMax = salaryMin;
                  }
                }
              }
              
              // Determine work mode from description
              const workMode = this.determineWorkMode(description + ' ' + title);
              
              // Determine experience level
              const experience = this.determineExperienceLevel(title + ' ' + description);
              
              // Determine category
              const category = this.determineCategory(title + ' ' + description);
              
              jobs.push({
                title,
                company,
                location,
                workMode,
                category,
                experience,
                salaryMin,
                salaryMax,
                descriptionSnippet: description,
                descriptionFull: description, // Indeed doesn't provide full descriptions in listings
                postedAt: new Date().toISOString(),
                sources: [{
                  site: 'Indeed',
                  url: jobUrl,
                  postedAt: new Date().toISOString(),
                  externalId
                }]
              });
            }
          } catch (error) {
            console.error('Error parsing job element:', error);
          }
        });
        
        return jobs;
      });
      
      return jobs;
      
    } catch (error) {
      logger.error(`Error scraping Indeed page ${pageNumber}:`, error);
      return [];
    } finally {
      await page.close();
    }
  }

  determineWorkMode(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('remote') || lowerText.includes('work from home')) {
      return 'Remote';
    } else if (lowerText.includes('hybrid') || lowerText.includes('flexible')) {
      return 'Hybrid';
    } else {
      return 'On-site';
    }
  }

  determineExperienceLevel(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('senior') || lowerText.includes('lead') || lowerText.includes('principal')) {
      return 'Senior';
    } else if (lowerText.includes('mid') || lowerText.includes('intermediate')) {
      return 'Mid';
    } else if (lowerText.includes('junior') || lowerText.includes('entry') || lowerText.includes('graduate')) {
      return 'Junior';
    } else if (lowerText.includes('intern') || lowerText.includes('internship')) {
      return 'Internship';
    } else {
      return 'Mid'; // Default to Mid level
    }
  }

  determineCategory(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('software') || lowerText.includes('developer') || lowerText.includes('engineer')) {
      return 'Software Engineering';
    } else if (lowerText.includes('data') || lowerText.includes('analyst') || lowerText.includes('scientist')) {
      return 'Data';
    } else if (lowerText.includes('design') || lowerText.includes('ui') || lowerText.includes('ux')) {
      return 'Design';
    } else if (lowerText.includes('product') || lowerText.includes('manager')) {
      return 'Product';
    } else if (lowerText.includes('marketing') || lowerText.includes('digital')) {
      return 'Marketing';
    } else if (lowerText.includes('sales') || lowerText.includes('business development')) {
      return 'Sales';
    } else if (lowerText.includes('customer') || lowerText.includes('support')) {
      return 'Customer Support';
    } else if (lowerText.includes('operations') || lowerText.includes('ops')) {
      return 'Operations';
    } else if (lowerText.includes('finance') || lowerText.includes('accounting')) {
      return 'Finance';
    } else if (lowerText.includes('hr') || lowerText.includes('human resources')) {
      return 'HR';
    } else {
      return 'Software Engineering'; // Default category
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveJobsToDatabase(jobs) {
    const db = getDatabase();
    
    for (const job of jobs) {
      try {
        // Generate unique ID
        const jobId = `indeed_${job.sources[0].externalId}_${Date.now()}`;
        
        // Insert job
        await new Promise((resolve, reject) => {
          db.run(`
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
          ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          });
        });
        
        // Insert job sources
        for (const source of job.sources) {
          await new Promise((resolve, reject) => {
            db.run(`
              INSERT OR REPLACE INTO job_sources (
                job_id, site, url, posted_at, external_id
              ) VALUES (?, ?, ?, ?, ?)
            `, [
              jobId,
              source.site,
              source.url,
              source.postedAt,
              source.externalId
            ], function(err) {
              if (err) reject(err);
              else resolve(this.lastID);
            });
          });
        }
        
      } catch (error) {
        logger.error('Error saving job to database:', error);
      }
    }
  }
}
