import puppeteer from 'puppeteer';
import { load } from 'cheerio';
import { getDatabase } from '../database/init.js';
import logger from '../utils/logger.js';

export class JoraScraper {
  constructor() {
    this.baseUrl = 'https://au.jora.com';
  }

  // Scrape using EXACT URL provided by user - no modifications
  // But also run separate searches for diversity since OR queries can rank certain terms too high
  async scrapeWithExactUrl(location = 'Sydney NSW', maxPages = 10) {
    const jobs = [];
    const seen = new Set();
    
    try {
      // Strategy: Run the exact URL search, but also run separate targeted searches
      // to get more diverse results since Jora may rank "software engineer" too high in OR queries
      
      // 1. Original exact URL with all terms (for completeness)
      const exactBaseUrl = 'https://au.jora.com/j?a=14d&disallow=true&l=Sydney+NSW&q=%22developer%22+OR+%22programmer%22+OR+%22software+engineer%22+OR+%22frontend%22+OR+%22backend%22+OR+%22data%22+OR+%22analyst%22+OR+%22cloud%22+OR+%22cybersecurity%22+OR+%22web%22+OR+%22IT%22&sa=70000&sp=facet_listed_date';
      
      // 2. Separate searches for non-engineer terms to ensure diversity
      // These separate searches help balance results since the OR query ranks "software engineer" too high
      const searchTerms = [
        { name: 'developer', query: '%22developer%22', pages: 3 },
        { name: 'analyst', query: '%22analyst%22+OR+%22data+analyst%22', pages: 3 },
        { name: 'programmer', query: '%22programmer%22', pages: 2 },
        { name: 'frontend-developer', query: '%22frontend+developer%22+OR+%22front-end+developer%22', pages: 2 },
        { name: 'backend-developer', query: '%22backend+developer%22+OR+%22back-end+developer%22', pages: 2 },
        { name: 'cloud-engineer', query: '%22cloud%22+OR+%22aws%22+OR+%22azure%22', pages: 2 },
        { name: 'cybersecurity', query: '%22cybersecurity%22+OR+%22security+analyst%22', pages: 2 },
        { name: 'web-developer', query: '%22web+developer%22', pages: 2 },
        { name: 'IT-support', query: '%22IT+support%22+OR+%22IT+technician%22', pages: 2 }
      ];
      
      logger.info(`Jora: Running diversified search strategy - exact URL + separate term searches for better diversity`);
      
      // First, run the exact URL search (reduced pages since we're adding separate searches)
      const exactUrlPages = Math.min(5, Math.floor(maxPages / 2));
      for (let page = 1; page <= exactUrlPages; page++) {
        // Build URL based on Jora's pagination pattern:
        // Page 1: Base URL as provided
        // Page 2: sp=search&trigger_source=serp format
        // Page 3+: p=N parameter with sp=search&trigger_source=serp
        let url = '';
        if (page === 1) {
          url = exactBaseUrl;
        } else if (page === 2) {
          // Page 2 uses different format: sp=search&trigger_source=serp&a=14d&q=...&l=...
          url = `https://au.jora.com/j?sp=search&trigger_source=serp&a=14d&q=%22developer%22+OR+%22programmer%22+OR+%22software+engineer%22+OR+%22frontend%22+OR+%22backend%22+OR+%22data%22+OR+%22analyst%22+OR+%22cloud%22+OR+%22cybersecurity%22+OR+%22web%22+OR+%22IT%22&l=Sydney+NSW`;
        } else {
          // Page 3+: Use p=N parameter
          url = `https://au.jora.com/j?a=14d&disallow=true&l=Sydney+NSW&p=${page}&q=%22developer%22+OR+%22programmer%22+OR+%22software+engineer%22+OR+%22frontend%22+OR+%22backend%22+OR+%22data%22+OR+%22analyst%22+OR+%22cloud%22+OR+%22cybersecurity%22+OR+%22web%22+OR+%22IT%22&sp=search&surl=0&trigger_source=serp`;
        }
        
        logger.info(`Jora: Scraping page ${page} of ${maxPages}: ${url}`);
        const pageJobs = await this.scrapeExactUrlPage(url);
        
        logger.info(`Jora: Found ${pageJobs.length} jobs on page ${page}`);
        
        // Log detailed job info from this page for verification
        if (pageJobs.length > 0) {
          logger.info(`Jora: === PAGE ${page} JOBS (ALL ${pageJobs.length} jobs) ===`);
          pageJobs.forEach((job, idx) => {
            const jobUrl = job.sources?.[0]?.url || 'no-url';
            const externalId = job.sources?.[0]?.externalId || 'no-id';
            // Extract hash for verification
            const hashMatch = jobUrl.match(/-([a-f0-9]{32})(?:\?|$)/);
            const extractedHash = hashMatch ? hashMatch[1] : 'no-hash';
            logger.info(`Jora: Page ${page}, Job ${idx + 1}/${pageJobs.length}: "${job.title}" at ${job.company} | Hash: ${extractedHash}`);
          });
          
          // Also log a comprehensive summary of job types found
          const jobTypes = pageJobs.map(j => j.title.toLowerCase()).join(' | ');
          const hasFrontend = jobTypes.includes('frontend');
          const hasBackend = jobTypes.includes('backend');
          const hasData = jobTypes.includes('data') || jobTypes.includes('analyst');
          const hasCloud = jobTypes.includes('cloud');
          const hasCyber = jobTypes.includes('cyber') || jobTypes.includes('security');
          const hasWeb = jobTypes.includes('web');
          const hasIT = jobTypes.includes(' it ') || jobTypes.includes('it ') || /\bit\b/.test(jobTypes);
          const hasProgrammer = jobTypes.includes('programmer');
          const hasDeveloper = jobTypes.includes('developer') && !jobTypes.includes('engineer');
          const hasEngineer = jobTypes.includes('engineer');
          
          // Count job title patterns
          const engineerCount = pageJobs.filter(j => /engineer/i.test(j.title)).length;
          const developerCount = pageJobs.filter(j => /developer/i.test(j.title) && !/engineer/i.test(j.title)).length;
          const analystCount = pageJobs.filter(j => /analyst/i.test(j.title)).length;
          const programmerCount = pageJobs.filter(j => /programmer/i.test(j.title)).length;
          
          logger.info(`Jora: Page ${page} Job Type Summary - Frontend: ${hasFrontend}, Backend: ${hasBackend}, Data: ${hasData}, Cloud: ${hasCloud}, Cybersecurity: ${hasCyber}, Web: ${hasWeb}, IT: ${hasIT}, Programmer: ${hasProgrammer}, Developer (not engineer): ${hasDeveloper}`);
          logger.info(`Jora: Page ${page} Job Title Counts - Engineer: ${engineerCount}, Developer (only): ${developerCount}, Analyst: ${analystCount}, Programmer: ${programmerCount}`);
          
          // Show unique job title patterns to verify diversity
          const uniqueTitleWords = new Set();
          pageJobs.forEach(job => {
            const words = job.title.toLowerCase().split(/\s+/);
            words.forEach(word => {
              if (word.length > 3 && !['the', 'and', 'for', 'with', 'from'].includes(word)) {
                uniqueTitleWords.add(word);
              }
            });
          });
          logger.info(`Jora: Page ${page} Unique job title keywords (sample): ${Array.from(uniqueTitleWords).slice(0, 20).join(', ')}`);
          logger.info(`Jora: === END PAGE ${page} JOBS ===`);
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
          // Extract job hash from URL pattern: /job/Job-Title-hash32chars
          // Jora uses format: /job/Job-Title-ef0bff38847e6c5e0993739857d4f106
          let key = '';
          if (jobUrl) {
            // Extract the 32-char hash from URL (everything after last dash before query params)
            // Pattern: /job/anything-hash32chars -> extract hash32chars
            const hashMatch = jobUrl.match(/-([a-f0-9]{32})(?:\?|$)/);
            if (hashMatch) {
              // The hash is the unique identifier (32 hex chars)
              key = hashMatch[1].toLowerCase();
            } else {
              // Fallback: extract everything after last dash in the job path
              const pathMatch = jobUrl.match(/\/job\/[^?]+-([a-zA-Z0-9]+)(?:\?|$)/);
              if (pathMatch && pathMatch[1].length >= 16) {
                // If we got something that looks like a hash (at least 16 chars), use it
                key = pathMatch[1].toLowerCase();
              } else {
                // Use base URL path without query params as fallback
                const urlWithoutParams = jobUrl.split('?')[0].toLowerCase().trim();
                key = urlWithoutParams;
              }
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
      
      logger.info(`Jora: Collected ${jobs.length} jobs from exact URL search`);
      
      // Now run separate targeted searches for diversity
      for (const searchTerm of searchTerms) {
        logger.info(`Jora: Running separate search for "${searchTerm.name}" (${searchTerm.pages} pages)`);
        
        for (let page = 1; page <= searchTerm.pages; page++) {
          let url = '';
          if (page === 1) {
            url = `https://au.jora.com/j?a=14d&disallow=true&l=${encodeURIComponent(location)}&q=${searchTerm.query}&sa=70000&sp=facet_listed_date`;
          } else if (page === 2) {
            url = `https://au.jora.com/j?sp=search&trigger_source=serp&a=14d&q=${searchTerm.query}&l=${encodeURIComponent(location)}`;
          } else {
            url = `https://au.jora.com/j?a=14d&disallow=true&l=${encodeURIComponent(location)}&p=${page}&q=${searchTerm.query}&sp=search&surl=0&trigger_source=serp`;
          }
          
          logger.info(`Jora: Scraping "${searchTerm.name}" page ${page}: ${url}`);
          const pageJobs = await this.scrapeExactUrlPage(url);
          
          logger.info(`Jora: Found ${pageJobs.length} jobs for "${searchTerm.name}" page ${page}`);
          
          // Add jobs with deduplication
          let addedForTerm = 0;
          for (const job of pageJobs) {
            const jobUrl = job.sources?.[0]?.url || '';
            const externalId = job.sources?.[0]?.externalId || '';
            
            let key = '';
            if (jobUrl) {
              const hashMatch = jobUrl.match(/-([a-f0-9]{32})(?:\?|$)/);
              if (hashMatch) {
                key = hashMatch[1].toLowerCase();
              } else {
                const pathMatch = jobUrl.match(/\/job\/[^?]+-([a-zA-Z0-9]+)(?:\?|$)/);
                if (pathMatch && pathMatch[1].length >= 16) {
                  key = pathMatch[1].toLowerCase();
                } else {
                  key = jobUrl.split('?')[0].toLowerCase().trim();
                }
              }
            } else if (externalId) {
              key = externalId.toLowerCase().trim();
            } else {
              const normalizedTitle = (job.title || '').toLowerCase().trim().replace(/\s+/g, ' ');
              const normalizedCompany = (job.company || '').toLowerCase().trim().replace(/\s+/g, ' ');
              key = `${normalizedTitle}|${normalizedCompany}`.toLowerCase().trim();
            }
            
            if (!key) continue;
            
          if (!seen.has(key)) {
            seen.add(key);
              jobs.push(job);
              addedForTerm++;
          }
        }
          
          logger.info(`Jora: "${searchTerm.name}" page ${page} - Added ${addedForTerm} new jobs`);
          
          if (pageJobs.length === 0) break;
          
        await this.delay(1000);
      }
        
        logger.info(`Jora: Completed "${searchTerm.name}" search, total jobs so far: ${jobs.length}`);
      }
      
      logger.info(`Jora: Collected ${jobs.length} total jobs from all searches (exact URL + separate term searches)`);
      
      // Sort all jobs by posted date (most recent first)
      jobs.sort((a, b) => {
        const dateA = new Date(a.postedAt || 0).getTime();
        const dateB = new Date(b.postedAt || 0).getTime();
        return dateB - dateA; // Descending order (newest first)
      });
      
      logger.info(`Jora: Sorted ${jobs.length} jobs by posted date (most recent first)`);
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
        await page.waitForSelector('.job-card, [data-automation="job-card"], a[href*="/job/"]', { timeout: 15000 });
      } catch (e) {
        logger.warn(`Jora: Job cards selector not found, continuing anyway`);
      }

      // Wait a bit more for JavaScript to fully render
      await page.waitForTimeout(2000);
      
      // Scroll multiple times to trigger all lazy-loaded jobs
      // Jora uses lazy loading, so we need to scroll through the page
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 300;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            // Stop scrolling if we've reached the bottom or scrolled enough
            if (totalHeight >= scrollHeight || totalHeight > 5000) {
              clearInterval(timer);
              resolve();
            }
          }, 200);
        });
        
        // Scroll back to top to ensure all content is in DOM
        window.scrollTo(0, 0);
      });

      // Wait for any animations/lazy loading to complete
      await page.waitForTimeout(2000);

      // Get the page HTML
      const html = await page.content();
      
      // Log a sample of job titles found in HTML for debugging
      const titleMatches = html.match(/<[^>]*data-automation="job-title"[^>]*>([^<]+)<\/[^>]*>/gi) || 
                          html.match(/<a[^>]*href="[^"]*\/job\/[^"]*"[^>]*>([^<]+)<\/a>/gi);
      if (titleMatches && titleMatches.length > 0) {
        const sampleTitles = titleMatches.slice(0, 10).map(m => {
          const textMatch = m.match(/>([^<]+)</);
          return textMatch ? textMatch[1].trim() : '';
        }).filter(t => t).join(', ');
        logger.info(`Jora: Sample job titles found in HTML (first 10): ${sampleTitles}`);
      }
      
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
    // We want to find ALL job cards, not just the first matching selector
    const jobSelectors = [
      '[data-automation="job-card"]',
      '[data-automation="job-list"] [data-automation="job-card"]',
      '.job-card',
      '.job-item',
      'article[data-testid="job-card"]',
      'div[class*="job-card"]',
      '[class*="JobCard"]',
      'a[href*="/job/"][href*="-"]'  // More specific: links to job pages with dash (hash format)
    ];

    // Try each selector and accumulate unique job elements
    let jobElements = [];
    const seenUrls = new Set();
    
    for (const selector of jobSelectors) {
      const elements = $(selector).toArray();
      for (const el of elements) {
        const $el = $(el);
        // Try to get the job URL from this element
        let href = $el.attr('href') || $el.find('a[href*="/job/"]').first().attr('href') || '';
        if (href) {
          const jobUrl = href.startsWith('http') ? href : (href ? this.baseUrl + href : '');
          // Only add if we haven't seen this URL before and it looks like a valid job URL
          if (jobUrl && jobUrl.includes('/job/') && !seenUrls.has(jobUrl.split('?')[0])) {
            seenUrls.add(jobUrl.split('?')[0]);
            jobElements.push(el);
          }
        } else if (!href) {
          // If no href but matches selector, might be a wrapper - check for nested links
          const nestedLink = $el.find('a[href*="/job/"]').first();
          if (nestedLink.length) {
            href = nestedLink.attr('href') || '';
            const jobUrl = href.startsWith('http') ? href : (href ? this.baseUrl + href : '');
            if (jobUrl && jobUrl.includes('/job/') && !seenUrls.has(jobUrl.split('?')[0])) {
              seenUrls.add(jobUrl.split('?')[0]);
              jobElements.push(el);
            }
          }
        }
      }
      if (jobElements.length > 0) {
        logger.info(`Jora: Found ${jobElements.length} unique jobs using selector: ${selector} (and previous selectors)`);
        // Don't break - continue to accumulate from other selectors if needed
      }
    }
    
    // If we didn't find many jobs, try a more aggressive approach
    if (jobElements.length < 10) {
      logger.warn(`Jora: Found only ${jobElements.length} jobs, trying broader search...`);
      const allJobLinks = $('a[href*="/job/"]').toArray();
      for (const el of allJobLinks) {
        const $el = $(el);
        const href = $el.attr('href') || '';
        if (href) {
          const jobUrl = href.startsWith('http') ? href : (href ? this.baseUrl + href : '');
          if (jobUrl && jobUrl.includes('/job/') && jobUrl.includes('-') && !seenUrls.has(jobUrl.split('?')[0])) {
            seenUrls.add(jobUrl.split('?')[0]);
            // Find the parent container that likely holds the full job info
            const parent = $el.closest('[data-automation="job-card"], .job-card, [class*="job"], article, div').first();
            if (parent.length) {
              jobElements.push(parent[0]);
            } else {
              jobElements.push(el);
            }
          }
        }
      }
      if (jobElements.length > 0) {
        logger.info(`Jora: After broader search, found ${jobElements.length} total unique jobs`);
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

        // Try multiple selectors for posted date - Jora shows "18h ago, from eFinancialCareers"
        let postedEl = $el.find('[data-automation="job-date"]').first();
        if (!postedEl.length) postedEl = $el.find('time').first();
        if (!postedEl.length) postedEl = $el.find('[class*="date"], [class*="ago"]').first();
        if (!postedEl.length) postedEl = $el.find('[class*="posted"], [class*="listed"]').first();
        // Try finding text that contains "ago" - this is Jora's format
        if (!postedEl.length) {
          $el.find('*').each((_, elem) => {
            const $elem = $(elem);
            const text = $elem.text();
            if (text && text.includes('ago')) {
              postedEl = $elem;
              return false; // break
            }
          });
        }
        
        // Try to get date from datetime attribute first (most reliable)
        let postedAt = null;
        const datetimeAttr = postedEl.attr('datetime') || postedEl.attr('data-date') || postedEl.attr('title');
        
        if (datetimeAttr) {
          // Parse ISO date string if available
          postedAt = new Date(datetimeAttr).toISOString();
        } else {
          // Extract the posted date text - Jora format: "18h ago, from eFinancialCareers" or "3 days ago"
          let postedText = postedEl.text().trim();
          
          // Extract just the time part before comma (e.g., "18h ago, from eFinancialCareers" -> "18h ago")
          if (postedText.includes(',')) {
            postedText = postedText.split(',')[0].trim();
          }
          
          // Also try getting from parent if it contains "ago"
          if (!postedText || !postedText.includes('ago')) {
            const parentText = $el.parent().text();
            if (parentText && parentText.includes('ago')) {
              // Extract the part with "ago" from parent
              const agoMatch = parentText.match(/(\d+[hd]\s*ago|\d+\s*(?:hours?|days?|weeks?|months?)\s*ago)/i);
              if (agoMatch) {
                postedText = agoMatch[1];
              }
            }
          }
          
          logger.debug(`Jora: Extracted posted date text: "${postedText}" for job: ${title}`);
          postedAt = this.parsePostedDate(postedText);
        }

        // Extract hash from Jora URL format: /job/Job-Title-hash32chars
        // The hash is the last segment after the final dash (32 hex characters)
        let externalId = null;
        if (jobUrl) {
          // Match: /job/anything-hash where hash is 32 hex chars at the end
          const hashMatch = jobUrl.match(/-([a-f0-9]{32})(?:\?|$)/);
          if (hashMatch) {
            externalId = hashMatch[1];
          } else {
            // Fallback: extract everything after last dash
            const pathMatch = jobUrl.match(/\/job\/[^?]+-([a-zA-Z0-9]+)/);
            if (pathMatch) {
              externalId = pathMatch[1];
            } else {
              externalId = `jora_${Date.now()}_${i}`;
            }
          }
        } else {
          externalId = `jora_${Date.now()}_${i}`;
        }

        // Only use current date as fallback if we truly couldn't find any date element
        // Otherwise, log that we couldn't parse the date but still try to save something
        if (!postedAt || isNaN(new Date(postedAt).getTime())) {
          if (!postedEl.length) {
            // No date element found at all - use current date as fallback
            logger.warn(`Jora: No date element found for job: ${title} at ${company}`);
            postedAt = new Date().toISOString();
          } else {
            // Date element found but couldn't parse - log and use current date
            const postedText = postedEl.text().trim();
            logger.warn(`Jora: Could not parse posted date for job "${title} at ${company}". Date text: "${postedText}"`);
            postedAt = new Date().toISOString();
          }
        } else {
          logger.debug(`Jora: Successfully parsed posted date: ${postedAt} for job: ${title}`);
        }

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

  parsePostedDate(dateText) {
    if (!dateText) return null;
    
    // Clean the text - remove any extra content after comma
    let text = dateText.trim();
    if (text.includes(',')) {
      text = text.split(',')[0].trim();
    }
    // Remove "from X" suffix if present
    text = text.replace(/\s+from\s+.*$/i, '').trim();
    
    text = text.toLowerCase();
    const now = new Date();
    
    // Match patterns like "18h ago", "3d ago", "X hours ago", "X days ago", etc.
    // Handle "Xh ago" format (common on Jora)
    const hourMatch = text.match(/(\d+)\s*h\s*ago/);
    if (hourMatch) {
      const hours = parseInt(hourMatch[1]);
      const date = new Date(now.getTime() - hours * 60 * 60 * 1000);
      return date.toISOString();
    }
    
    // Handle "Xd ago" format (days abbreviation)
    const dayAbbrMatch = text.match(/(\d+)\s*d\s*ago/);
    if (dayAbbrMatch) {
      const days = parseInt(dayAbbrMatch[1]);
      const date = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return date.toISOString();
    }
    
    // Match full patterns like "X hours ago", "X days ago", "X weeks ago", "X months ago"
    const hourFullMatch = text.match(/(\d+)\s*(?:hour|hr|hours|hrs)\s*ago/);
    if (hourFullMatch) {
      const hours = parseInt(hourFullMatch[1]);
      const date = new Date(now.getTime() - hours * 60 * 60 * 1000);
      return date.toISOString();
    }
    
    const dayMatch = text.match(/(\d+)\s*(?:day|days)\s*ago/);
    if (dayMatch) {
      const days = parseInt(dayMatch[1]);
      const date = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return date.toISOString();
    }
    
    const weekMatch = text.match(/(\d+)\s*(?:week|wk|weeks)\s*ago/);
    if (weekMatch) {
      const weeks = parseInt(weekMatch[1]);
      const date = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
      return date.toISOString();
    }
    
    const monthMatch = text.match(/(\d+)\s*(?:month|mo|months)\s*ago/);
    if (monthMatch) {
      const months = parseInt(monthMatch[1]);
      const date = new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
      return date.toISOString();
    }
    
    // Handle "today" or "just now"
    if (text.includes('today') || text.includes('just now') || text.includes('now')) {
      return now.toISOString();
    }
    
    // Handle "yesterday"
    if (text.includes('yesterday')) {
      const date = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return date.toISOString();
    }
    
    // Try to parse as a date string if it looks like one
    const parsedDate = new Date(dateText);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    }
    
    logger.warn(`Jora: Could not parse posted date: "${dateText}"`);
    return null;
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
          
          // Extract the base URL path (without query params) for duplicate checking
          // Same job will have same path but different query params on different pages
          const baseUrlPath = jobUrl ? jobUrl.split('?')[0] : '';
          
          let jobId = '';
          if (jobUrl) {
            // Extract job hash from URL - Jora format: /job/Job-Title-ef0bff38847e6c5e0993739857d4f106
            // The hash is 32 hex characters after the last dash
            const hashMatch = jobUrl.match(/-([a-f0-9]{32})(?:\?|$)/);
            if (hashMatch) {
              // Use the 32-char hash as the unique identifier
              jobId = `jora_${hashMatch[1]}`;
            } else {
              // Fallback: extract everything after last dash in path
              const pathMatch = jobUrl.match(/\/job\/[^?]+-([a-zA-Z0-9]+)(?:\?|$)/);
              if (pathMatch && pathMatch[1].length >= 16) {
                // If we got something that looks like a hash, use it
                jobId = `jora_${pathMatch[1]}`;
              } else {
                // Use hash of base URL path as fallback
                jobId = `jora_${Buffer.from(baseUrlPath).toString('base64').slice(0, 20).replace(/[^a-zA-Z0-9]/g, '')}`;
              }
            }
          } else if (externalId) {
            jobId = `jora_${externalId}`;
          } else {
            // Fallback: use normalized title+company hash
            const normalized = `${(job.title || '').toLowerCase().trim()}_${(job.company || '').toLowerCase().trim()}`;
            jobId = `jora_${Buffer.from(normalized).toString('base64').slice(0, 20).replace(/[^a-zA-Z0-9]/g, '')}`;
          }
          
          logger.debug(`Jora: Processing job "${job.title}" - Extracted hash from URL, jobId: ${jobId}, basePath: ${baseUrlPath}`);
          
          // Check if job already exists by base URL path (without query params)
          // This ensures the same job from different pages is detected as a duplicate
          let existingJob = null;
          if (baseUrlPath) {
            existingJob = await get(`
              SELECT j.id FROM jobs j
              INNER JOIN job_sources js ON j.id = js.job_id
              WHERE js.url LIKE ?
              LIMIT 1
            `, [`${baseUrlPath}%`]);
          }
          
          // Also check by job ID as backup
          if (!existingJob) {
            existingJob = await get(`SELECT id FROM jobs WHERE id = ?`, [jobId]);
          }
          
          if (existingJob) {
            duplicateCount++;
            logger.info(`Jora: Skipping duplicate job in database: ${job.title} at ${job.company} (ID: ${jobId}, basePath: ${baseUrlPath})`);
            continue;
          }
          
          logger.debug(`Jora: New unique job found: ${job.title} at ${job.company} (ID: ${jobId}, basePath: ${baseUrlPath})`);
          
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
