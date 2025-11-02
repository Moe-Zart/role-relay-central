import { semanticMatcher } from './semanticMatcher.js';
import { resumeParser } from './resumeParser.js';
import logger from '../utils/logger.js';

/**
 * Resume Matcher Service
 * Matches resume to jobs and identifies what parts match
 */
class ResumeMatcher {
  /**
   * Match resume to a single job and identify matching components
   * @param {Object} resumeData - Parsed resume data from resumeParser
   * @param {Object} job - Job object
   * @returns {Object} Match details with scores and matched components
   */
  async matchJobToResume(resumeData, job) {
    try {
      const matchDetails = {
        overallScore: 0,
        skillsMatched: [],
        skillsMissing: [],
        technologiesMatched: [],
        technologiesMissing: [],
        experienceLevelMatch: false,
        experienceLevel: resumeData.experienceLevel,
        jobExperienceLevel: job.experience || 'Mid',
        matchReasons: [],
        matchPercentage: 0
      };

      // 1. Match skills
      const jobText = `${job.title} ${job.description_snippet || ''} ${job.description_full || ''}`.toLowerCase();
      const resumeSkills = resumeData.skills.map(s => s.toLowerCase());
      
      resumeSkills.forEach(skill => {
        if (jobText.includes(skill)) {
          matchDetails.skillsMatched.push(skill);
        } else {
          matchDetails.skillsMissing.push(skill);
        }
      });

      // 2. Match technologies
      const resumeTechnologies = resumeData.technologies.map(t => t.toLowerCase());
      resumeTechnologies.forEach(tech => {
        if (jobText.includes(tech)) {
          matchDetails.technologiesMatched.push(tech);
        } else {
          matchDetails.technologiesMissing.push(tech);
        }
      });

      // 3. Semantic similarity
      const semanticScore = await semanticMatcher.calculateSimilarity(
        resumeData.summary || resumeData.rawText?.substring(0, 500) || '',
        job.title,
        job.description_snippet || job.description_full || ''
      );

      // 4. Calculate match ratios (normalized 0-1)
      const skillMatchRatio = matchDetails.skillsMatched.length / Math.max(resumeData.skills.length, 1);
      const techMatchRatio = matchDetails.technologiesMatched.length / Math.max(resumeData.technologies.length, 1);
      
      // 5. Strict matching: require at least some match (skills OR technologies OR high semantic)
      // If NO skills match AND NO techs match AND semantic score is low, filter out (0% match)
      const hasAnyMatch = matchDetails.skillsMatched.length > 0 || 
                         matchDetails.technologiesMatched.length > 0 || 
                         semanticScore > 0.5;
      
      if (!hasAnyMatch) {
        // No meaningful match - return 0%
        matchDetails.overallScore = 0;
        matchDetails.matchPercentage = 0;
        return matchDetails;
      }

      // 6. Calculate overall match score with improved weighting
      // Higher weight for skills and technologies (more concrete matches)
      // Semantic similarity is important but secondary
      const semanticWeight = 0.3;
      const skillWeight = 0.4;  // Increased from 0.3
      const techWeight = 0.3;   // Increased from 0.2

      // Use squared ratios to emphasize strong matches
      // This means 100% skill match contributes more than 50% skill match
      matchDetails.overallScore = (
        semanticScore * semanticWeight +
        Math.pow(skillMatchRatio, 1.2) * skillWeight +
        Math.pow(techMatchRatio, 1.2) * techWeight
      );

      // Scale to 0-100, but ensure minimum threshold
      matchDetails.matchPercentage = Math.round(matchDetails.overallScore * 100);
      
      // Only return matches with at least 20% relevance (stricter threshold)
      if (matchDetails.matchPercentage < 20) {
        matchDetails.matchPercentage = 0;
        matchDetails.overallScore = 0;
        return matchDetails;
      }

      // 6. Generate match reasons
      if (matchDetails.skillsMatched.length > 0) {
        const topMatchedSkills = matchDetails.skillsMatched.slice(0, 5).join(', ');
        matchDetails.matchReasons.push(`Matches your skills: ${topMatchedSkills}`);
      }

      if (matchDetails.technologiesMatched.length > 0) {
        const topMatchedTech = matchDetails.technologiesMatched.slice(0, 5).join(', ');
        matchDetails.matchReasons.push(`Uses technologies you know: ${topMatchedTech}`);
      }

      if (semanticScore > 0.7) {
        matchDetails.matchReasons.push('High semantic similarity to your background');
      } else if (semanticScore > 0.5) {
        matchDetails.matchReasons.push('Good semantic alignment with your experience');
      }

      if (matchDetails.matchReasons.length === 0) {
        matchDetails.matchReasons.push('Some overlap with your background');
      }

      return matchDetails;
    } catch (error) {
      logger.error('Error matching job to resume:', error);
      return {
        overallScore: 0,
        skillsMatched: [],
        skillsMissing: [],
        technologiesMatched: [],
        technologiesMissing: [],
        experienceLevelMatch: false,
        matchReasons: ['Unable to analyze match'],
        matchPercentage: 0
      };
    }
  }

  /**
   * Match resume to multiple jobs and rank them
   * @param {Object} resumeData - Parsed resume data
   * @param {Array} jobs - Array of job objects
   * @returns {Array} Jobs with match details, sorted by match score
   */
  async matchResumeToJobs(resumeData, jobs) {
    logger.info(`Matching resume to ${jobs.length} jobs...`);
    
    const jobsWithMatches = await Promise.all(
      jobs.map(async (job) => {
        const matchDetails = await this.matchJobToResume(resumeData, job);
        return {
          ...job,
          resumeMatch: matchDetails
        };
      })
    );

    // Sort by match score (highest first)
    jobsWithMatches.sort((a, b) => {
      return b.resumeMatch.overallScore - a.resumeMatch.overallScore;
    });

    logger.info(`Resume matching completed. Top match: ${jobsWithMatches[0]?.resumeMatch?.matchPercentage}%`);
    
    return jobsWithMatches;
  }
}

export const resumeMatcher = new ResumeMatcher();

