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
      
      // 5. STRICT MATCHING: Require MULTIPLE indicators of match
      // Must have at least 2 out of 3: skills match, technologies match, OR high semantic (>0.65)
      // Single indicator alone is not enough
      const hasSkillsMatch = matchDetails.skillsMatched.length > 0;
      const hasTechMatch = matchDetails.technologiesMatched.length > 0;
      const hasHighSemantic = semanticScore > 0.65; // Higher threshold for semantic
      
      const matchIndicators = (hasSkillsMatch ? 1 : 0) + (hasTechMatch ? 1 : 0) + (hasHighSemantic ? 1 : 0);
      
      // Require at least 2 indicators OR very high semantic (>0.75) alone
      if (matchIndicators < 2 && semanticScore <= 0.75) {
        // Not enough match indicators - return 0%
        matchDetails.overallScore = 0;
        matchDetails.matchPercentage = 0;
        return matchDetails;
      }

      // 6. Calculate overall match score with STRICTER weighting
      // Require meaningful matches - boost scores for jobs with multiple match types
      const semanticWeight = 0.25; // Reduced - semantic is less reliable alone
      const skillWeight = 0.45;     // Increased - skills are most important
      const techWeight = 0.30;      // Increased - technologies are very important

      // Apply exponential scaling to emphasize STRONG matches
      // Jobs with 100% skill match get MUCH higher score than 50% match
      const skillScore = Math.pow(skillMatchRatio, 1.5) * skillWeight;
      const techScore = Math.pow(techMatchRatio, 1.5) * techWeight;
      
      // Semantic score only contributes if it's reasonably high
      const effectiveSemanticScore = semanticScore > 0.6 ? semanticScore : semanticScore * 0.5;
      const semanticContribution = effectiveSemanticScore * semanticWeight;
      
      // Bonus multiplier if job has BOTH skills AND technologies matched
      const multiMatchBonus = (hasSkillsMatch && hasTechMatch) ? 1.15 : 1.0;
      
      matchDetails.overallScore = (
        (semanticContribution + skillScore + techScore) * multiMatchBonus
      );

      // Scale to 0-100
      matchDetails.matchPercentage = Math.round(matchDetails.overallScore * 100);
      
      // STRICT THRESHOLD: Only show jobs with at least 40% match
      // This ensures only genuinely relevant jobs appear
      if (matchDetails.matchPercentage < 40) {
        matchDetails.matchPercentage = 0;
        matchDetails.overallScore = 0;
        return matchDetails;
      }
      
      // Cap at 100%
      if (matchDetails.matchPercentage > 100) {
        matchDetails.matchPercentage = 100;
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

