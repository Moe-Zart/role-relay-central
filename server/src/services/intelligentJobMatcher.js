// AI-powered job matching service for server-side use
// This service provides intelligent job search by understanding role synonyms and related positions

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
