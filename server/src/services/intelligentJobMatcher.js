// AI-powered job matching service for server-side use
// This service provides intelligent job search by understanding role synonyms and related positions

import natural from 'natural';
import cosineSimilarity from 'cosine-similarity';
import keywordExtractor from 'keyword-extractor';

export class IntelligentJobMatcher {
  constructor() {
    this.roleMappings = [
      {
        primary: "developer",
        synonyms: ["dev", "programmer", "coder", "software developer", "software engineer"],
        related: ["frontend developer", "backend developer", "full stack developer", "web developer", "mobile developer", "game developer", "devops engineer", "software architect"],
        categories: ["Software Engineering", "Technology"]
      },
      {
        primary: "frontend developer",
        synonyms: ["front-end developer", "frontend dev", "front-end dev", "web developer", "ui developer"],
        related: ["ui designer", "ux designer", "web designer", "react developer", "vue developer", "angular developer", "javascript developer", "css developer"],
        categories: ["Software Engineering", "Design"]
      },
      {
        primary: "backend developer",
        synonyms: ["back-end developer", "backend dev", "back-end dev", "server developer", "api developer"],
        related: ["full stack developer", "devops engineer", "database developer", "python developer", "java developer", "node.js developer", "php developer"],
        categories: ["Software Engineering"]
      },
      {
        primary: "full stack developer",
        synonyms: ["fullstack developer", "full-stack developer", "fullstack dev", "full-stack dev"],
        related: ["frontend developer", "backend developer", "web developer", "software engineer", "devops engineer"],
        categories: ["Software Engineering"]
      },
      {
        primary: "data scientist",
        synonyms: ["data analyst", "data engineer", "ml engineer", "machine learning engineer", "ai engineer"],
        related: ["business analyst", "statistician", "research scientist", "data architect", "analytics engineer", "bi engineer"],
        categories: ["Data", "Software Engineering"]
      },
      {
        primary: "ui designer",
        synonyms: ["user interface designer", "ui/ux designer", "interface designer", "visual designer"],
        related: ["ux designer", "web designer", "graphic designer", "frontend developer", "product designer", "interaction designer"],
        categories: ["Design"]
      },
      {
        primary: "ux designer",
        synonyms: ["user experience designer", "ux/ui designer", "experience designer", "usability designer"],
        related: ["ui designer", "product designer", "interaction designer", "service designer", "user researcher", "information architect"],
        categories: ["Design"]
      },
      {
        primary: "product manager",
        synonyms: ["pm", "product owner", "product lead", "product director"],
        related: ["project manager", "program manager", "business analyst", "product marketing manager", "technical product manager"],
        categories: ["Product", "Management"]
      },
      {
        primary: "devops engineer",
        synonyms: ["devops", "site reliability engineer", "sre", "platform engineer", "infrastructure engineer"],
        related: ["cloud engineer", "system administrator", "backend developer", "full stack developer", "security engineer"],
        categories: ["Software Engineering", "Operations"]
      },
      {
        primary: "marketing manager",
        synonyms: ["marketing lead", "marketing director", "brand manager", "digital marketing manager"],
        related: ["content manager", "social media manager", "seo specialist", "growth hacker", "marketing analyst", "product marketing manager"],
        categories: ["Marketing"]
      },
      {
        primary: "sales manager",
        synonyms: ["sales lead", "sales director", "account manager", "business development manager"],
        related: ["account executive", "sales representative", "customer success manager", "partnership manager", "sales engineer"],
        categories: ["Sales"]
      }
    ];
  }

  // Expand a search query to include synonyms and related roles
  expandSearchQuery(query) {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Find matching role mapping
    const matchingRole = this.roleMappings.find(role => 
      role.primary === normalizedQuery ||
      role.synonyms.some(synonym => synonym === normalizedQuery) ||
      role.related.some(related => related === normalizedQuery)
    );

    if (matchingRole) {
      return {
        searchTerms: [
          matchingRole.primary,
          ...matchingRole.synonyms,
          ...matchingRole.related
        ],
        categories: matchingRole.categories,
        relatedRoles: matchingRole.related
      };
    }

    // If no exact match, try partial matching
    const partialMatches = this.roleMappings.filter(role =>
      role.primary.includes(normalizedQuery) ||
      role.synonyms.some(synonym => synonym.includes(normalizedQuery)) ||
      role.related.some(related => related.includes(normalizedQuery))
    );

    if (partialMatches.length > 0) {
      const allTerms = new Set();
      const allCategories = new Set();
      const allRelated = new Set();

      partialMatches.forEach(match => {
        allTerms.add(match.primary);
        match.synonyms.forEach(syn => allTerms.add(syn));
        match.related.forEach(rel => allRelated.add(rel));
        match.categories.forEach(cat => allCategories.add(cat));
      });

      return {
        searchTerms: Array.from(allTerms),
        categories: Array.from(allCategories),
        relatedRoles: Array.from(allRelated)
      };
    }

    // Fallback: return the original query
    return {
      searchTerms: [query],
      categories: [],
      relatedRoles: []
    };
  }

  // Generate intelligent search terms for scraping
  generateScrapingTerms(query) {
    const expansion = this.expandSearchQuery(query);
    
    // Prioritize the most relevant terms
    const priorityTerms = [
      query, // Original query first
      ...expansion.searchTerms.slice(0, 3), // Top 3 synonyms/related
    ];

    // Remove duplicates and limit to 5 terms
    return Array.from(new Set(priorityTerms)).slice(0, 5);
  }

  // Check if a job title matches the search criteria
  isJobRelevant(jobTitle, searchQuery) {
    const expansion = this.expandSearchQuery(searchQuery);
    const normalizedTitle = jobTitle.toLowerCase();
    
    // Check if job title contains any of the search terms
    return expansion.searchTerms.some(term => 
      normalizedTitle.includes(term.toLowerCase())
    );
  }

  // Get related job suggestions
  getRelatedJobSuggestions(query) {
    const expansion = this.expandSearchQuery(query);
    return expansion.relatedRoles.slice(0, 5); // Return top 5 related roles
  }
}

export const intelligentJobMatcher = new IntelligentJobMatcher();

// Compute cosine similarity between a resume and array of jobs
export function scoreResumeAgainstJobs(resumeText, jobs) {
  // Collect descriptions
  const jobDescriptions = jobs.map(j => j.description_full || j.descriptionSnippet || "");
  const corpus = [resumeText, ...jobDescriptions];

  // TF-IDF vectorization
  const tfidf = new natural.TfIdf();
  corpus.forEach(doc => tfidf.addDocument(doc));

  // Convert each doc vector to array
  function vectorFor(docIdx) {
    // Get list of all terms
    const dict = {};
    tfidf.listTerms(docIdx).forEach(item => {
      dict[item.term] = item.tfidf;
    });
    // Turn all terms into the same order
    const allTerms = tfidf.listTerms(0).map(t => t.term);
    return allTerms.map(term => dict[term] || 0);
  }
  // Doc 0 is the resume
  const resumeVec = vectorFor(0);

  const jobScores = jobs.map((job, idx) => {
    const jobIdx = idx + 1;
    const jobVec = vectorFor(jobIdx);
    return {
      job,
      score: cosineSimilarity(resumeVec, jobVec),
    };
  });
  // Sort by score, descending
  return jobScores.sort((a,b)=>b.score-a.score);
}

// --- LLM-Based Contextual Job Fit Scoring ---
/**
 * Evaluate contextual job fit between a resume and job description using LLM
 * @param {string} resumeText - Resume text
 * @param {string} jobText - Job description
 * @returns {Promise<number>} score from 0 (worst) to 1 (perfect fit)
 */
export async function llmContextualJobFitScore(resumeText, jobText) {
  // Placeholder for actual LLM/API integration
  // Example for OpenAI in future:
  // const completion = await openai.createCompletion({ ... })
  // return parseFloat(completion.data.choices[0].text);

  // Demo: return a random score
  return Math.round(Math.random() * 100) / 100;
}

/**
 * Extract job/education timeline and produce reverse-chronological string for the resume
 * @param {string} text resume text
 * @returns {string} resume in reverse-chronological format
 */
export function formatResumeReverseChronological(text) {
  // Find lines that look like experience (simple regex for year/role separator)
  const lines = text.split(/\r?\n/).filter(Boolean);
  // e.g. 'Software Engineer at XYZ Corp, 2022-2024'
  const expRegex = /(.+?)\s*(at|@)\s*(.+?),?\s*(\d{4})\s*[-–]?\s*(\d{4}|present|now)?/i;
  const experiences = [];
  for (const line of lines) {
    const match = line.match(expRegex);
    if (match) {
      experiences.push({
        role: match[1].trim(),
        company: match[3].trim(),
        start: parseInt(match[4]),
        end: match[5] && match[5].toLowerCase() !== 'present' && match[5].toLowerCase() !== 'now' ? parseInt(match[5]) : 9999,
        raw: line.trim()
      });
    }
  }
  // Sort by end year descending (or start if no end)
  experiences.sort((a, b) => (b.end || b.start) - (a.end || a.start));
  // Return formatted string of experiences, then rest of resume
  const formatted = experiences.map(e => e.raw).join('\n');
  // Add unclassified blocks after
  const expLines = new Set(experiences.map(e => e.raw));
  const remainder = lines.filter(line => !expLines.has(line)).join('\n');
  return formatted + (remainder ? '\n\n' + remainder : '');
}

/**
 * Analyze job description to determine critical ATS keywords, suggest enhancements for a resume.
 * - Extract keywords from both texts
 * - Identify keywords in jobText not present in resumeText
 * - Suggests updating resume to include these if relevant
 */
export function atsEnhanceResume(resumeText, jobText) {
  const jobKeywords = keywordExtractor.extract(jobText, {
    language: 'english', return_changed_case: true, remove_digits: true, remove_duplicates: true
  });
  const resumeKeywords = keywordExtractor.extract(resumeText, {
    language: 'english', return_changed_case: true, remove_digits: true, remove_duplicates: true
  });
  // Remove generic stop words aggressively
  const stopWords = new Set([
    'the', 'and', 'in', 'on', 'to', 'a', 'of', 'for', 'is', 'with', 'by', 'as', 'at', 'an', 'or', 'from', 'be', 'are', 'we', 'your', 'will', 'our', 'can', 'that', 'you', 'this', 'may', 'it', 'not', 'have', 'has', 'if', 'job', 'role', 'team', 'so'  // etc.
  ]);
  const jobKW = jobKeywords.filter(k => !stopWords.has(k));
  const resumeKW = new Set(resumeKeywords.filter(k => !stopWords.has(k)));
  const missingATSKW = jobKW.filter(k => !resumeKW.has(k));
  // Suggest a sentence with keywords
  const suggestion = missingATSKW.length ?
    `Consider adding these keywords for better ATS ranking: ${missingATSKW.join(', ')}.`:
    'Your resume already contains the most relevant job keywords.';
  return {
    atsKeywords: missingATSKW,
    suggestion
  };
}
