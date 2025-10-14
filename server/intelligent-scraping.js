import axios from 'axios';
import * as cheerio from 'cheerio';
import { initDatabase, getDatabase } from './src/database/init.js';
import { intelligentJobMatcher } from './src/services/intelligentJobMatcher.js';

async function intelligentJobScraping(searchQuery) {
  try {
    console.log(`\n🔍 Starting intelligent job search for: "${searchQuery}"`);
    
    // Use existing database connection instead of initializing again
    const db = getDatabase();
    
    // Get intelligent search terms
    const searchTerms = intelligentJobMatcher.generateScrapingTerms(searchQuery);
    console.log(`📝 Generated search terms: ${searchTerms.join(', ')}`);
    
    // Get related roles for context
    const relatedRoles = intelligentJobMatcher.getRelatedJobSuggestions(searchQuery);
    console.log(`🔗 Related roles: ${relatedRoles.join(', ')}`);
    
    let totalSaved = 0;
    const processedJobs = new Set();
    
    for (const term of searchTerms) {
      try {
        console.log(`\n🔎 Scraping Jora for: "${term}"`);
        
        const response = await axios.get(`https://au.jora.com/jobs?q=${encodeURIComponent(term)}&l=Australia`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-AU,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.google.com/',
            'Cache-Control': 'no-cache'
          },
          timeout: 15000
        });
        
        const $ = cheerio.load(response.data);
        
        // Look for job listings
        const jobs = [];
        $('.job-item, .job-card, .result-item').each((index, element) => {
          const titleElement = $(element).find('h3 a, .job-title a, .title a');
          const title = titleElement.text().trim();
          const url = titleElement.attr('href');
          const company = $(element).find('.company, .employer, .job-company').text().trim();
          const location = $(element).find('.location, .job-location').text().trim();
          
          if (title && company && location && title.length > 5) {
            // Always include jobs, but calculate relevance score
            jobs.push({
              title,
              company,
              location,
              url: url ? (url.startsWith('http') ? url : `https://au.jora.com${url}`) : '',
              source: 'Jora',
              searchTerm: term,
              relevanceScore: calculateRelevanceScore(title, searchQuery)
            });
          }
        });
        
        console.log(`📊 Found ${jobs.length} relevant jobs for "${term}"`);
        
        // Sort by relevance score
        jobs.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        // Save unique jobs (avoid duplicates)
        let savedCount = 0;
        for (const jobData of jobs.slice(0, 3)) { // Save top 3 most relevant
          const jobKey = `${jobData.title}_${jobData.company}`.toLowerCase();
          
          if (processedJobs.has(jobKey)) {
            console.log(`⏭️  Skipping duplicate: ${jobData.title} at ${jobData.company}`);
            continue;
          }
          
          processedJobs.add(jobKey);
          
          const jobId = `jora_intelligent_${searchQuery.replace(/\s+/g, '_')}_${Date.now()}_${savedCount}`;
          
          try {
            // Determine job category based on intelligent matching
            const category = intelligentJobMatcher.expandSearchQuery(searchQuery).categories[0] || 'Software Engineering';
            const experience = determineExperienceLevel(jobData.title);
            const workMode = determineWorkMode(jobData.title, jobData.location);
            
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
                jobData.title,
                jobData.company,
                jobData.location,
                workMode,
                category,
                experience,
                null,
                null,
                `Intelligent match for "${searchQuery}" - Found via "${jobData.searchTerm}"`,
                `Full job description available on Jora. Relevance score: ${jobData.relevanceScore}`,
                new Date().toISOString(),
                new Date().toISOString()
              ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
              });
            });
            
            // Insert job source
            await new Promise((resolve, reject) => {
              db.run(`
                INSERT OR REPLACE INTO job_sources (
                  job_id, site, url, posted_at, external_id
                ) VALUES (?, ?, ?, ?, ?)
              `, [
                jobId,
                'Jora',
                jobData.url,
                new Date().toISOString(),
                jobId
              ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
              });
            });
            
            savedCount++;
            totalSaved++;
            console.log(`✅ Saved: ${jobData.title} at ${jobData.company} (Score: ${jobData.relevanceScore})`);
            
          } catch (error) {
            console.error('❌ Error saving job:', error);
          }
        }
        
        // Wait between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.log(`❌ Error scraping ${term}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Total jobs saved: ${totalSaved}`);
    console.log(`💡 Search suggestions: ${relatedRoles.join(', ')}`);
    console.log('🔄 Refresh your frontend to see the intelligent job matches!');
    
    return totalSaved;
    
  } catch (error) {
    console.error('❌ Error during intelligent scraping:', error);
    throw error;
  }
}

// Helper functions
function calculateRelevanceScore(jobTitle, searchQuery) {
  const title = jobTitle.toLowerCase();
  const query = searchQuery.toLowerCase();
  
  let score = 0;
  
  // Exact match gets highest score
  if (title.includes(query)) {
    score += 100;
  }
  
  // Check for synonyms and related terms
  const expansion = intelligentJobMatcher.expandSearchQuery(searchQuery);
  expansion.searchTerms.forEach(term => {
    if (title.includes(term.toLowerCase())) {
      score += 50;
    }
  });
  
  // Check for related roles
  expansion.relatedRoles.forEach(role => {
    if (title.includes(role.toLowerCase())) {
      score += 25;
    }
  });
  
  return score;
}


function determineExperienceLevel(jobTitle) {
  const title = jobTitle.toLowerCase();
  
  if (title.includes('senior') || title.includes('lead') || title.includes('principal')) {
    return 'Senior';
  } else if (title.includes('junior') || title.includes('entry') || title.includes('graduate')) {
    return 'Junior';
  } else if (title.includes('intern') || title.includes('internship')) {
    return 'Internship';
  } else {
    return 'Mid';
  }
}

function determineWorkMode(jobTitle, location) {
  const title = jobTitle.toLowerCase();
  const loc = location.toLowerCase();
  
  if (title.includes('remote') || loc.includes('remote')) {
    return 'Remote';
  } else if (title.includes('hybrid') || loc.includes('hybrid')) {
    return 'Hybrid';
  } else {
    return 'On-site';
  }
}

// Export for use in other scripts
export { intelligentJobScraping };

// If run directly, use command line argument
if (process.argv[2]) {
  const searchQuery = process.argv[2];
  intelligentJobScraping(searchQuery)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}
