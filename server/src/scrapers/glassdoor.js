import puppeteer from 'puppeteer';
import { getDatabase } from '../database/init.js';
import logger from '../utils/logger.js';

export class GlassdoorScraper {
  constructor() {
    this.baseUrl = 'https://www.glassdoor.com.au';
    this.searchUrl = 'https://www.glassdoor.com.au/Job/jobs.htm';
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
        logger.info(`Scraping Glassdoor for: ${searchTerm}`);
        
        for (let page = 1; page <= maxPages; page++) {
          const pageJobs = await this.scrapePage(browser, searchTerm, page);
          jobs.push(...pageJobs);
          
          // Add delay between pages
          await this.delay(3000);
        }
      }
      
      logger.info(`Found ${jobs.length} jobs from Glassdoor`);
      return jobs;
      
    } catch (error) {
      logger.error('Error scraping Glassdoor:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  async scrapePage(browser, searchTerm, pageNumber) {
    const page = await browser.newPage();
    
    try {
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      const url = `${this.searchUrl}?sc.keyword=${encodeURIComponent(searchTerm)}&p=${pageNumber}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Wait for job listings to load
      await page.waitForSelector('[data-test="job-listing"]', { timeout: 15000 });
      
      const jobs = await page.evaluate(() => {
        const jobElements = document.querySelectorAll('[data-test="job-listing"]');
        const jobs = [];
        
        jobElements.forEach((element, index) => {
          try {
            const titleElement = element.querySelector('[data-test="job-title"] a');
            const companyElement = element.querySelector('[data-test="employer-name"]');
            const locationElement = element.querySelector('[data-test="job-location"]');
            const salaryElement = element.querySelector('[data-test="detailSalary"]');
            const descriptionElement = element.querySelector('[data-test="job-description"]');
            const postedElement = element.querySelector('[data-test="job-age"]');
            
            if (titleElement && companyElement && locationElement) {
              const title = titleElement.textContent?.trim() || '';
              const company = companyElement.textContent?.trim() || '';
              const location = locationElement.textContent?.trim() || '';
              const salary = salaryElement?.textContent?.trim() || '';
              const description = descriptionElement?.textContent?.trim() || '';
              const jobUrl = titleElement.href || '';
              const postedText = postedElement?.textContent?.trim() || '';
              
              // Extract job ID from URL
              const jobIdMatch = jobUrl.match(/job-listing\/([^\/]+)/);
              const externalId = jobIdMatch ? jobIdMatch[1] : `glassdoor_${Date.now()}_${index}`;
              
              // Parse salary
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
              
              // Parse posted date
              let postedAt = new Date().toISOString();
              if (postedText) {
                const postedDate = this.parsePostedDate(postedText);
                if (postedDate) {
                  postedAt = postedDate.toISOString();
                }
              }
              
              // Determine work mode, experience, and category
              const workMode = this.determineWorkMode(description + ' ' + title);
              const experience = this.determineExperienceLevel(title + ' ' + description);
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
                descriptionFull: description,
                postedAt,
                sources: [{
                  site: 'Glassdoor',
                  url: jobUrl,
                  postedAt,
                  externalId
                }]
              });
            }
          } catch (error) {
            console.error('Error parsing Glassdoor job element:', error);
          }
        });
        
        return jobs;
      });
      
      return jobs;
      
    } catch (error) {
      logger.error(`Error scraping Glassdoor page ${pageNumber}:`, error);
      return [];
    } finally {
      await page.close();
    }
  }

  parsePostedDate(postedText) {
    const lowerText = postedText.toLowerCase();
    const now = new Date();
    
    if (lowerText.includes('today')) {
      return now;
    } else if (lowerText.includes('yesterday')) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    } else if (lowerText.includes('days ago')) {
      const daysMatch = postedText.match(/(\d+)\s*days?\s*ago/);
      if (daysMatch) {
        const days = parseInt(daysMatch[1]);
        const date = new Date(now);
        date.setDate(date.getDate() - days);
        return date;
      }
    } else if (lowerText.includes('week')) {
      const weeksMatch = postedText.match(/(\d+)\s*weeks?\s*ago/);
      if (weeksMatch) {
        const weeks = parseInt(weeksMatch[1]);
        const date = new Date(now);
        date.setDate(date.getDate() - (weeks * 7));
        return date;
      }
    } else if (lowerText.includes('month')) {
      const monthsMatch = postedText.match(/(\d+)\s*months?\s*ago/);
      if (monthsMatch) {
        const months = parseInt(monthsMatch[1]);
        const date = new Date(now);
        date.setMonth(date.getMonth() - months);
        return date;
      }
    }
    
    return null;
  }

  determineWorkMode(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('remote') || lowerText.includes('work from home') || lowerText.includes('wfh')) {
      return 'Remote';
    } else if (lowerText.includes('hybrid') || lowerText.includes('flexible')) {
      return 'Hybrid';
    } else {
      return 'On-site';
    }
  }

  determineExperienceLevel(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('senior') || lowerText.includes('lead') || lowerText.includes('principal') || lowerText.includes('architect') || lowerText.includes('staff')) {
      return 'Senior';
    } else if (lowerText.includes('mid') || lowerText.includes('intermediate') || lowerText.includes('3+') || lowerText.includes('4+') || lowerText.includes('5+')) {
      return 'Mid';
    } else if (lowerText.includes('junior') || lowerText.includes('entry') || lowerText.includes('graduate') || lowerText.includes('1+') || lowerText.includes('2+')) {
      return 'Junior';
    } else if (lowerText.includes('intern') || lowerText.includes('internship')) {
      return 'Internship';
    } else {
      return 'Mid';
    }
  }

  determineCategory(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('software') || lowerText.includes('developer') || lowerText.includes('engineer') || lowerText.includes('programmer') || lowerText.includes('full stack')) {
      return 'Software Engineering';
    } else if (lowerText.includes('data') || lowerText.includes('analyst') || lowerText.includes('scientist') || lowerText.includes('machine learning') || lowerText.includes('ai')) {
      return 'Data';
    } else if (lowerText.includes('design') || lowerText.includes('ui') || lowerText.includes('ux') || lowerText.includes('graphic') || lowerText.includes('visual')) {
      return 'Design';
    } else if (lowerText.includes('product') || lowerText.includes('manager') || lowerText.includes('project') || lowerText.includes('program manager')) {
      return 'Product';
    } else if (lowerText.includes('marketing') || lowerText.includes('digital') || lowerText.includes('content') || lowerText.includes('growth')) {
      return 'Marketing';
    } else if (lowerText.includes('sales') || lowerText.includes('business development') || lowerText.includes('account manager') || lowerText.includes('revenue')) {
      return 'Sales';
    } else if (lowerText.includes('customer') || lowerText.includes('support') || lowerText.includes('service') || lowerText.includes('success')) {
      return 'Customer Support';
    } else if (lowerText.includes('operations') || lowerText.includes('ops') || lowerText.includes('admin') || lowerText.includes('coordinator')) {
      return 'Operations';
    } else if (lowerText.includes('finance') || lowerText.includes('accounting') || lowerText.includes('bookkeeper') || lowerText.includes('analyst')) {
      return 'Finance';
    } else if (lowerText.includes('hr') || lowerText.includes('human resources') || lowerText.includes('recruiter') || lowerText.includes('talent')) {
      return 'HR';
    } else {
      return 'Software Engineering';
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveJobsToDatabase(jobs) {
    const db = getDatabase();
    
    for (const job of jobs) {
      try {
        const jobId = `glassdoor_${job.sources[0].externalId}_${Date.now()}`;
        
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
        logger.error('Error saving Glassdoor job to database:', error);
      }
    }
  }
}
