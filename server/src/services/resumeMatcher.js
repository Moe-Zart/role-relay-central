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

      // 3. Match experience level
      const experienceLevels = ['Internship', 'Junior', 'Mid', 'Senior', 'Lead'];
      const resumeLevelIndex = experienceLevels.indexOf(resumeData.experienceLevel);
      const jobLevelIndex = experienceLevels.indexOf(job.experience || 'Mid');
      
      matchDetails.experienceLevelMatch = Math.abs(resumeLevelIndex - jobLevelIndex) <= 1; // Allow 1 level difference

      // 4. Semantic similarity
      const semanticScore = await semanticMatcher.calculateSimilarity(
        resumeData.summary,
        job.title,
        job.description_snippet || job.description_full || ''
      );

      // 5. Calculate overall match score
      const skillMatchRatio = matchDetails.skillsMatched.length / Math.max(resumeData.skills.length, 1);
      const techMatchRatio = matchDetails.technologiesMatched.length / Math.max(resumeData.technologies.length, 1);
      const semanticWeight = 0.4;
      const skillWeight = 0.3;
      const techWeight = 0.2;
      const experienceWeight = 0.1;

      matchDetails.overallScore = (
        semanticScore * semanticWeight +
        skillMatchRatio * skillWeight +
        techMatchRatio * techWeight +
        (matchDetails.experienceLevelMatch ? 1 : 0) * experienceWeight
      );

      matchDetails.matchPercentage = Math.round(matchDetails.overallScore * 100);

      // 6. Generate match reasons
      if (matchDetails.skillsMatched.length > 0) {
        const topMatchedSkills = matchDetails.skillsMatched.slice(0, 5).join(', ');
        matchDetails.matchReasons.push(`Matches your skills: ${topMatchedSkills}`);
      }

      if (matchDetails.technologiesMatched.length > 0) {
        const topMatchedTech = matchDetails.technologiesMatched.slice(0, 5).join(', ');
        matchDetails.matchReasons.push(`Uses technologies you know: ${topMatchedTech}`);
      }

      if (matchDetails.experienceLevelMatch) {
        matchDetails.matchReasons.push(`Experience level matches: ${resumeData.experienceLevel}`);
      }

      if (semanticScore > 0.6) {
        matchDetails.matchReasons.push('High semantic similarity to your background');
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

