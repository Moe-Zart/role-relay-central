import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export interface ParsedResume {
  skills: string[];
  technologies: string[];
  experienceLevel: string;
  yearsOfExperience: number;
  experience: Array<{
    title: string;
    company: string | null;
    duration: string | null;
    description: string[];
  }>;
  education: string[];
  summary: string;
  rawText: string;
}

export interface ResumeMatchDetails {
  overallScore: number;
  skillsMatched: string[];
  skillsMissing: string[];
  technologiesMatched: string[];
  technologiesMissing: string[];
  experienceLevelMatch: boolean;
  experienceLevel: string;
  jobExperienceLevel: string;
  matchReasons: string[];
  matchPercentage: number;
}

export interface MatchedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: string;
  experience: string;
  descriptionSnippet: string;
  descriptionFull: string;
  postedAt: string;
  sources: Array<{
    site: string;
    url: string;
    postedAt: string;
    externalId: string;
  }>;
  resumeMatch: ResumeMatchDetails;
}

class ResumeService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Resume API request failed:', error);
      throw error;
    }
  }

  /**
   * Upload and parse resume
   */
  async uploadResume(file: File): Promise<{ success: boolean; parsedResume: ParsedResume; fileName: string }> {
    const formData = new FormData();
    formData.append('resume', file);

    const response = await axios.post(`${API_BASE_URL}/resume/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  /**
   * Match resume to jobs in database
   */
  async matchResumeToJobs(parsedResume: ParsedResume): Promise<{
    success: boolean;
    totalJobs: number;
    relevantJobs: number;
    matchedJobs: MatchedJob[];
    resumeSummary: {
      skills: string[];
      technologies: string[];
      experienceLevel: string;
      yearsOfExperience: number;
    };
  }> {
    return this.request('/resume/match-jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parsedResume }),
    });
  }

  /**
   * Match resume to a single job
   */
  async matchSingleJob(parsedResume: ParsedResume, job: any): Promise<{
    success: boolean;
    matchDetails: ResumeMatchDetails;
  }> {
    return this.request('/resume/match-single-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parsedResume, job }),
    });
  }
}

export const resumeService = new ResumeService();

