import { pipeline } from '@xenova/transformers';
import logger from '../utils/logger.js';

/**
 * Resume Parser Service
 * Uses AI to extract structured information from resume text
 */
class ResumeParser {
  constructor() {
    this.model = null;
    this.initialized = false;
    this.initializing = false;
  }

  async initialize() {
    if (this.initialized || this.initializing) {
      return;
    }
    this.initializing = true;
    logger.info('Initializing resume parser AI model...');
    try {
      // Use the same model as semantic matching for consistency
      this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      this.initialized = true;
      logger.info('Resume parser AI model initialized successfully.');
    } catch (error) {
      logger.error('Failed to initialize resume parser model:', error);
      this.initialized = false;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Extract structured information from resume text using AI
   * @param {string} resumeText - Raw resume text
   * @returns {Object} Structured resume data
   */
  async parseResume(resumeText) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Extract key information using pattern matching and AI
      const skills = this.extractSkills(resumeText);
      const experience = this.extractExperience(resumeText);
      const education = this.extractEducation(resumeText);
      const technologies = this.extractTechnologies(resumeText);
      const yearsOfExperience = this.extractYearsOfExperience(resumeText);
      const experienceLevel = this.determineExperienceLevel(yearsOfExperience);
      
      // Create a summary embedding for semantic matching
      const summary = this.createSummary(resumeText, skills, technologies, experienceLevel);
      
      // Determine primary category using AI
      const primaryCategory = await this.determineCategory(resumeText, skills, technologies);
      
      logger.info(`Parsed resume: ${skills.length} skills, ${technologies.length} technologies, ${experienceLevel} level, category: ${primaryCategory}`);
      
      return {
        skills,
        technologies,
        experienceLevel,
        yearsOfExperience,
        experience,
        education,
        summary,
        rawText: resumeText,
        primaryCategory
      };
    } catch (error) {
      logger.error('Error parsing resume:', error);
      throw error;
    }
  }

  /**
   * Extract skills from resume text
   */
  extractSkills(text) {
    const skillPatterns = [
      // Technical skills
      /(?:skills|technologies|proficient in|expertise in|knowledge of)[\s:]+([^\.]+)/gi,
      // Common skill keywords
      /\b(?:javascript|python|java|react|node|sql|aws|docker|kubernetes|git|typescript|vue|angular|html|css|sass|less|redux|graphql|rest|api|mongodb|postgresql|mysql|redis|elasticsearch|kafka|rabbitmq|jenkins|ci\/cd|terraform|ansible|linux|bash|powershell|agile|scrum|kanban)\b/gi,
      // Soft skills
      /\b(?:leadership|communication|problem-solving|teamwork|collaboration|time management|project management|analytical|creative|detail-oriented)\b/gi
    ];

    const skills = new Set();
    
    skillPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Extract individual skills from phrases
          const skillList = match.replace(/^(?:skills|technologies|proficient in|expertise in|knowledge of)[\s:]+/i, '');
          skillList.split(/[,;&|]/).forEach(skill => {
            const cleaned = skill.trim().toLowerCase();
            if (cleaned && cleaned.length > 2) {
              skills.add(cleaned);
            }
          });
        });
      }
    });

    // Also look for common technology patterns
    const techKeywords = [
      'javascript', 'typescript', 'python', 'java', 'c#', 'c\\+\\+', 'go', 'rust', 'php', 'ruby',
      'react', 'vue', 'angular', 'node', 'express', 'next', 'nuxt', 'svelte',
      'html', 'css', 'sass', 'less', 'styled-components', 'tailwind',
      'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'dynamodb',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ansible',
      'git', 'jenkins', 'github actions', 'gitlab ci', 'circleci',
      'rest', 'graphql', 'grpc', 'websocket', 'microservices'
    ];

    techKeywords.forEach(tech => {
      try {
        // Escape special regex characters and handle tech name normalization
        const normalizedTech = tech.replace(/\\/g, ''); // Remove escape chars for display
        const regex = new RegExp(`\\b${tech}\\b`, 'gi');
        if (regex.test(text)) {
          // Normalize the name for storage (e.g., "c++" becomes "c++" without escapes)
          skills.add(normalizedTech.toLowerCase());
        }
      } catch (regexError) {
        // Skip invalid regex patterns
        logger.warn(`Invalid regex pattern for tech: ${tech}`, regexError);
      }
    });

    return Array.from(skills).slice(0, 30); // Limit to top 30 skills
  }

  /**
   * Extract technologies/frameworks from resume
   */
  extractTechnologies(text) {
    const technologies = new Set();
    const techPatterns = [
      // Frameworks and libraries
      /\b(react|vue|angular|svelte|ember|backbone|jquery)\b/gi,
      /\b(express|koa|nest|fastify|hapi|sails)\b/gi,
      /\b(next|nuxt|gatsby|remix|sveltekit)\b/gi,
      // Databases
      /\b(mongodb|postgresql|mysql|mariadb|sqlite|redis|elasticsearch|dynamodb|cassandra)\b/gi,
      // Cloud platforms
      /\b(aws|azure|gcp|digitalocean|heroku|vercel|netlify)\b/gi,
      // Tools
      /\b(docker|kubernetes|terraform|ansible|jenkins|github actions|gitlab ci)\b/gi,
      // Languages (note: c++ needs special handling)
      /\b(javascript|typescript|python|java|c#|go|rust|php|ruby|swift|kotlin)\b/gi,
      // Special handling for c++ (has + which needs escaping)
      /\bc\+\+/gi
    ];

    techPatterns.forEach(pattern => {
      try {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach(match => {
            // Normalize c++ variations
            const normalized = match.toLowerCase().replace(/c\+\+/gi, 'c++');
            technologies.add(normalized);
          });
        }
      } catch (error) {
        // Skip invalid patterns
        logger.warn('Error matching tech pattern:', error);
      }
    });

    return Array.from(technologies);
  }

  /**
   * Extract work experience information
   */
  extractExperience(text) {
    const experience = [];
    const lines = text.split('\n');
    
    let currentJob = null;
    lines.forEach((line, index) => {
      // Look for job title patterns
      if (/^(senior|junior|mid|lead|principal|staff|intern|entry level)/i.test(line.trim()) ||
          /\b(developer|engineer|architect|manager|analyst|designer|consultant)\b/i.test(line)) {
        
        if (currentJob) {
          experience.push(currentJob);
        }
        
        currentJob = {
          title: line.trim(),
          company: null,
          duration: null,
          description: []
        };
      } else if (currentJob) {
        // Look for company name
        if (!currentJob.company && line.trim() && !/^\d/.test(line.trim())) {
          currentJob.company = line.trim();
        }
        // Look for duration
        else if (!currentJob.duration && /(\d{4}|\d{1,2}\/\d{4}|present|current)/i.test(line)) {
          currentJob.duration = line.trim();
        }
        // Add to description
        else if (line.trim().length > 10) {
          currentJob.description.push(line.trim());
        }
      }
    });

    if (currentJob) {
      experience.push(currentJob);
    }

    return experience.slice(0, 10); // Limit to last 10 positions
  }

  /**
   * Extract education information
   */
  extractEducation(text) {
    const education = [];
    const eduKeywords = ['bachelor', 'master', 'phd', 'degree', 'diploma', 'certificate', 'university', 'college'];
    
    const lines = text.split('\n');
    lines.forEach(line => {
      if (eduKeywords.some(keyword => line.toLowerCase().includes(keyword))) {
        education.push(line.trim());
      }
    });

    return education.slice(0, 5); // Limit to 5 entries
  }

  /**
   * Extract years of experience
   */
  extractYearsOfExperience(text) {
    const patterns = [
      /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i,
      /experience[:\s]+(\d+)\+?\s*(?:years?|yrs?)/i,
      /(\d+)\+?\s*years?/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const years = parseInt(match[1]);
        if (years > 0 && years < 50) {
          return years;
        }
      }
    }

    // Estimate based on experience entries
    const experienceEntries = this.extractExperience(text);
    if (experienceEntries.length > 0) {
      // Rough estimate: 2-3 years per entry, or parse dates
      return Math.min(experienceEntries.length * 2.5, 15);
    }

    return 0;
  }

  /**
   * Determine experience level based on years
   */
  determineExperienceLevel(years) {
    if (years === 0) return 'Internship';
    if (years < 2) return 'Junior';
    if (years < 5) return 'Mid';
    if (years < 8) return 'Senior';
    return 'Lead';
  }

  /**
   * Create a summary text for semantic matching
   */
  createSummary(text, skills, technologies, experienceLevel) {
    const topSkills = skills.slice(0, 10).join(', ');
    const topTech = technologies.slice(0, 10).join(', ');
    
    return `${experienceLevel} professional with expertise in ${topSkills}. 
            Proficient in ${topTech}. 
            ${text.substring(0, 500)}`;
  }

  /**
   * Determine primary category of the resume using AI and pattern matching
   * Categories: data, frontend, backend, fullstack, mobile, devops, cybersecurity, cloud, etc.
   */
  async determineCategory(resumeText, skills, technologies) {
    const text = resumeText.toLowerCase();
    const skillsLower = skills.map(s => s.toLowerCase());
    const techsLower = technologies.map(t => t.toLowerCase());
    const allText = `${text} ${skillsLower.join(' ')} ${techsLower.join(' ')}`.toLowerCase();

    // Category definitions with keywords and technologies
    const categories = {
      data: {
        keywords: ['data', 'analyst', 'analytics', 'data engineer', 'data scientist', 'bi', 'etl', 'warehouse', 'sql', 'database'],
        techs: ['sql', 'python', 'pandas', 'numpy', 'spark', 'hadoop', 'tableau', 'power bi', 'r', 'jupyter', 'snowflake', 'redshift'],
        weight: 0
      },
      frontend: {
        keywords: ['frontend', 'front-end', 'ui', 'ux', 'client-side', 'user interface', 'web design'],
        techs: ['react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css', 'sass', 'less', 'tailwind', 'next.js', 'nuxt'],
        weight: 0
      },
      backend: {
        keywords: ['backend', 'back-end', 'server', 'api', 'microservices', 'rest', 'graphql'],
        techs: ['node', 'express', 'django', 'flask', 'spring', 'java', 'c#', '.net', 'php', 'ruby', 'rails', 'go', 'rust'],
        weight: 0
      },
      fullstack: {
        keywords: ['fullstack', 'full-stack', 'full stack'],
        techs: ['react', 'node', 'javascript', 'typescript', 'express', 'next.js'],
        weight: 0
      },
      mobile: {
        keywords: ['mobile', 'ios', 'android', 'react native', 'flutter', 'swift', 'kotlin'],
        techs: ['react native', 'flutter', 'swift', 'kotlin', 'ios', 'android', 'xcode', 'android studio'],
        weight: 0
      },
      devops: {
        keywords: ['devops', 'sre', 'infrastructure', 'ci/cd', 'deployment', 'automation'],
        techs: ['docker', 'kubernetes', 'jenkins', 'terraform', 'ansible', 'aws', 'azure', 'gcp', 'github actions', 'gitlab ci'],
        weight: 0
      },
      cloud: {
        keywords: ['cloud', 'aws', 'azure', 'gcp', 'cloud engineer', 'cloud architect'],
        techs: ['aws', 'azure', 'gcp', 'lambda', 'ec2', 's3', 'cloudformation', 'serverless'],
        weight: 0
      },
      cybersecurity: {
        keywords: ['security', 'cybersecurity', 'penetration', 'vulnerability', 'compliance', 'pci', 'soc'],
        techs: ['security', 'penetration testing', 'siem', 'firewall', 'vpn'],
        weight: 0
      }
    };

    // Calculate weights for each category
    Object.keys(categories).forEach(category => {
      const cat = categories[category];
      
      // Check keywords
      cat.keywords.forEach(keyword => {
        if (allText.includes(keyword)) {
          cat.weight += 2; // Keywords are important
        }
      });
      
      // Check technologies (higher weight)
      cat.techs.forEach(tech => {
        if (techsLower.includes(tech) || skillsLower.includes(tech)) {
          cat.weight += 3; // Technologies are very important
        } else if (allText.includes(tech)) {
          cat.weight += 1; // Mentioned but not in tech list
        }
      });
    });

    // Special handling for fullstack: check if both frontend AND backend are present
    const hasFrontend = categories.frontend.weight > 5;
    const hasBackend = categories.backend.weight > 5;
    if (hasFrontend && hasBackend && !categories.fullstack.keywords.some(kw => allText.includes(kw))) {
      // If both frontend and backend indicators exist, boost fullstack
      categories.fullstack.weight += 10;
    }

    // Find category with highest weight
    let maxWeight = 0;
    let primaryCategory = 'general';
    
    Object.keys(categories).forEach(category => {
      if (categories[category].weight > maxWeight) {
        maxWeight = categories[category].weight;
        primaryCategory = category;
      }
    });

    // If no clear category, default based on most common technologies
    if (maxWeight < 3) {
      // Check for most common tech pattern
      const frontendCount = techsLower.filter(t => ['react', 'vue', 'angular', 'html', 'css'].some(ft => t.includes(ft))).length;
      const backendCount = techsLower.filter(t => ['node', 'express', 'django', 'spring', 'api'].some(bt => t.includes(bt))).length;
      const dataCount = techsLower.filter(t => ['sql', 'python', 'data', 'analytics'].some(dt => t.includes(dt))).length;
      
      if (frontendCount > 2 && backendCount > 1) {
        primaryCategory = 'fullstack';
      } else if (frontendCount > backendCount && frontendCount > dataCount) {
        primaryCategory = 'frontend';
      } else if (backendCount > frontendCount && backendCount > dataCount) {
        primaryCategory = 'backend';
      } else if (dataCount > 2) {
        primaryCategory = 'data';
      }
    }

    logger.info(`Resume category determined: ${primaryCategory} (weight: ${maxWeight})`);
    return primaryCategory;
  }
}

export const resumeParser = new ResumeParser();

