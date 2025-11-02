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
          'Content-Type': 'application/json',
          ...options.headers,
        },
        credentials: 'include', // Include credentials for CORS
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

    try {
      const response = await fetch(`${API_BASE_URL}/resume/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include credentials for CORS
        // Don't set Content-Type header - browser will set it with boundary for multipart/form-data
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Resume upload failed:', error);
      throw error;
    }
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

  /**
   * Match resume to ALL jobs in database
   * Returns matches with progress callback for progress bar
   */
  async matchAllJobs(
    parsedResume: ParsedResume,
    onProgress?: (progress: { current: number; total: number; matched: number }) => void
  ): Promise<{
    success: boolean;
    totalJobs: number;
    matchedJobs: number;
    matches: Array<{ jobId: string; matchDetails: ResumeMatchDetails }>;
  }> {
    // For now, use the endpoint directly - progress can be tracked on server side
    // In future, could use Server-Sent Events or WebSocket for real-time progress
    return this.request('/resume/match-all-jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parsedResume }),
    });
  }
}

export const resumeService = new ResumeService();

