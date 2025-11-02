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

      // 1. Determine job category (CRITICAL for matching)
      const jobCategory = this.determineJobCategory(job.title, job.description_snippet || job.description_full || '');
      const resumeCategory = resumeData.primaryCategory || 'general';
      
      // Category match is THE MOST IMPORTANT factor
      const categoryMatch = this.calculateCategoryMatch(resumeCategory, jobCategory);
      matchDetails.categoryMatch = categoryMatch;
      matchDetails.resumeCategory = resumeCategory;
      matchDetails.jobCategory = jobCategory;

      // 2. Match skills
      const jobText = `${job.title} ${job.description_snippet || ''} ${job.description_full || ''}`.toLowerCase();
      const resumeSkills = resumeData.skills.map(s => s.toLowerCase());
      
      resumeSkills.forEach(skill => {
        if (jobText.includes(skill)) {
          matchDetails.skillsMatched.push(skill);
        } else {
          matchDetails.skillsMissing.push(skill);
        }
      });

      // 3. Match technologies
      const resumeTechnologies = resumeData.technologies.map(t => t.toLowerCase());
      resumeTechnologies.forEach(tech => {
        if (jobText.includes(tech)) {
          matchDetails.technologiesMatched.push(tech);
        } else {
          matchDetails.technologiesMissing.push(tech);
        }
      });

      // 4. Semantic similarity
      const semanticScore = await semanticMatcher.calculateSimilarity(
        resumeData.summary || resumeData.rawText?.substring(0, 500) || '',
        job.title,
        job.description_snippet || job.description_full || ''
      );

      // 4. Calculate match ratios (normalized 0-1)
      const skillMatchRatio = matchDetails.skillsMatched.length / Math.max(resumeData.skills.length, 1);
      const techMatchRatio = matchDetails.technologiesMatched.length / Math.max(resumeData.technologies.length, 1);
      
      // 5. IMPROVED MATCHING: More lenient but still accurate
      // Require at least 1 indicator OR moderate semantic score (>0.55)
      // This allows good matches to show up while filtering out unrelated jobs
      const hasSkillsMatch = matchDetails.skillsMatched.length > 0;
      const hasTechMatch = matchDetails.technologiesMatched.length > 0;
      const hasModerateSemantic = semanticScore > 0.55;
      
      const matchIndicators = (hasSkillsMatch ? 1 : 0) + (hasTechMatch ? 1 : 0) + (hasModerateSemantic ? 1 : 0);
      
      // Require at least 1 indicator (more lenient) OR good semantic (>0.6) alone
      if (matchIndicators === 0 && semanticScore <= 0.6) {
        // No match indicators - return 0%
        matchDetails.overallScore = 0;
        matchDetails.matchPercentage = 0;
        return matchDetails;
      }

      // 7. Calculate overall match score with CATEGORY as PRIMARY factor
      // Category match is THE MOST IMPORTANT - if categories don't match, heavily penalize
      // Base weights: Category is 40%, then skills/tech/semantic share the rest
      const categoryWeight = 0.40;   // MOST IMPORTANT - category alignment
      const semanticWeight = 0.25;   // Semantic similarity
      const skillWeight = 0.20;      // Skills
      const techWeight = 0.15;       // Technologies

      // Use gentler exponential scaling (1.2 instead of 1.5) to reward partial matches more
      // This makes 60% skill match give ~56% score instead of ~46%
      const skillScore = Math.pow(skillMatchRatio, 1.2) * skillWeight;
      const techScore = Math.pow(techMatchRatio, 1.2) * techWeight;
      
      // Enhanced semantic score contribution - more generous for good matches
      let effectiveSemanticScore = semanticScore;
      if (semanticScore > 0.7) {
        // Boost very high semantic scores (90%+ semantic = excellent match)
        effectiveSemanticScore = semanticScore * 1.1; // 10% boost
      } else if (semanticScore > 0.6) {
        // Slight boost for good semantic scores
        effectiveSemanticScore = semanticScore * 1.05; // 5% boost
      } else if (semanticScore > 0.5) {
        // Keep moderate scores as-is
        effectiveSemanticScore = semanticScore;
      } else {
        // Reduce low semantic scores slightly (but less penalty)
        effectiveSemanticScore = semanticScore * 0.8;
      }
      // Cap semantic at 1.0
      effectiveSemanticScore = Math.min(1.0, effectiveSemanticScore);
      
      const semanticContribution = effectiveSemanticScore * semanticWeight;
      
      // Category score is CRITICAL - if categories match perfectly, huge boost
      // If categories don't match well, heavy penalty
      const categoryScore = categoryMatch * categoryWeight;
      
      // Calculate base score with category as primary factor
      let baseScore = categoryScore + semanticContribution + skillScore + techScore;
      
      // Progressive bonuses for strong matches - helps reach 90-100%
      let bonusMultiplier = 1.0;
      
      // CRITICAL BONUS: Perfect category match
      if (categoryMatch >= 0.9) {
        bonusMultiplier += 0.20; // 20% bonus for perfect category alignment
      } else if (categoryMatch >= 0.7) {
        bonusMultiplier += 0.10; // 10% bonus for good category match
      } else if (categoryMatch < 0.3) {
        // Heavy penalty for category mismatch
        bonusMultiplier *= 0.5; // Cut score in half if categories don't match
      }
      
      // Bonus 1: Skills + Technologies both matched
      if (hasSkillsMatch && hasTechMatch) {
        bonusMultiplier += 0.10; // 10% bonus
      }
      
      // Bonus 2: High skill match rate (70%+)
      if (skillMatchRatio >= 0.7) {
        bonusMultiplier += 0.06; // 6% bonus
      }
      
      // Bonus 3: High tech match rate (70%+)
      if (techMatchRatio >= 0.7) {
        bonusMultiplier += 0.06; // 6% bonus
      }
      
      // Bonus 4: Very high semantic similarity (80%+)
      if (semanticScore >= 0.8) {
        bonusMultiplier += 0.08; // 8% bonus
      }
      
      // Bonus 5: Perfect category + strong technical match
      if (categoryMatch >= 0.9 && skillMatchRatio >= 0.6 && techMatchRatio >= 0.6) {
        bonusMultiplier += 0.15; // Additional 15% for exceptional category+technical matches
      }
      
      // Apply bonuses to base score
      // Note: bonusMultiplier accumulates (e.g., 1.0 + 0.12 + 0.08 = 1.20 = 20% bonus)
      matchDetails.overallScore = baseScore * bonusMultiplier;

      // Scale to 0-100
      matchDetails.matchPercentage = Math.round(matchDetails.overallScore * 100);
      
      // Threshold: Show jobs with at least 30% match IF category matches well
      // OR 40% match if category doesn't match (stricter for category mismatches)
      const minThreshold = categoryMatch >= 0.5 ? 30 : 40;
      if (matchDetails.matchPercentage < minThreshold) {
        matchDetails.matchPercentage = 0;
        matchDetails.overallScore = 0;
        return matchDetails;
      }
      
      // Cap at 100% but allow strong matches to reach it
      if (matchDetails.matchPercentage > 100) {
        matchDetails.matchPercentage = 100;
      }
      
      // Ensure very strong matches can reach 95-100%
      // If we have strong indicators across the board, boost to near-perfect
      if (skillMatchRatio >= 0.75 && techMatchRatio >= 0.75 && semanticScore >= 0.75) {
        matchDetails.matchPercentage = Math.max(matchDetails.matchPercentage, 95);
      }

      // 8. Generate match reasons with CATEGORY as primary reason
      const suggestions = [];
      
      // Category match is the PRIMARY reason
      if (categoryMatch >= 0.9) {
        matchDetails.matchReasons.push(`🎯 Perfect category match: ${resumeCategory} → ${jobCategory}`);
      } else if (categoryMatch >= 0.7) {
        matchDetails.matchReasons.push(`✓ Strong category alignment: ${resumeCategory} → ${jobCategory}`);
      } else if (categoryMatch >= 0.5) {
        matchDetails.matchReasons.push(`✓ Category match: ${resumeCategory} → ${jobCategory}`);
      } else if (categoryMatch < 0.3) {
        matchDetails.matchReasons.push(`⚠️ Category mismatch: Your ${resumeCategory} background vs ${jobCategory} role`);
      }
      
      if (matchDetails.skillsMatched.length > 0) {
        const topMatchedSkills = matchDetails.skillsMatched.slice(0, 5).join(', ');
        matchDetails.matchReasons.push(`✓ Matches your skills: ${topMatchedSkills}`);
      }

      if (matchDetails.technologiesMatched.length > 0) {
        const topMatchedTech = matchDetails.technologiesMatched.slice(0, 5).join(', ');
        matchDetails.matchReasons.push(`✓ Uses technologies you know: ${topMatchedTech}`);
      }

      if (semanticScore >= 0.75) {
        matchDetails.matchReasons.push('✓ Excellent semantic match with your background');
      } else if (semanticScore >= 0.65) {
        matchDetails.matchReasons.push('✓ Strong semantic alignment with your experience');
      } else if (semanticScore >= 0.55) {
        matchDetails.matchReasons.push('✓ Good semantic similarity to your profile');
      }

      // Add suggestions for how to get closer to 100%
      if (matchDetails.matchPercentage < 100) {
        if (skillMatchRatio < 0.7 && resumeData.skills.length > 0) {
          const missingCount = Math.ceil((1 - skillMatchRatio) * resumeData.skills.length);
          suggestions.push(`Learn ${missingCount} more required skill${missingCount > 1 ? 's' : ''} to increase match`);
        }
        if (techMatchRatio < 0.7 && resumeData.technologies.length > 0) {
          const missingCount = Math.ceil((1 - techMatchRatio) * resumeData.technologies.length);
          suggestions.push(`Gain experience with ${missingCount} more technology${missingCount > 1 ? 'ies' : ''} to boost score`);
        }
        if (semanticScore < 0.75) {
          suggestions.push('Gain more relevant experience to improve semantic match');
        }
      }
      
      if (suggestions.length > 0) {
        matchDetails.suggestionsForImprovement = suggestions;
      }

      if (matchDetails.matchReasons.length === 0) {
        matchDetails.matchReasons.push('Some overlap with your background');
      }
      
      // Add match quality indicator
      if (matchDetails.matchPercentage >= 90) {
        matchDetails.matchReasons.unshift('🎯 Excellent match!');
      } else if (matchDetails.matchPercentage >= 75) {
        matchDetails.matchReasons.unshift('⭐ Strong match');
      } else if (matchDetails.matchPercentage >= 60) {
        matchDetails.matchReasons.unshift('✓ Good match');
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

