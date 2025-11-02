import { Job, JobBundle, SearchFilters } from '@/types/jobs';
import { intelligentJobMatcher } from './intelligentJobMatcher';

const API_BASE_URL = 'http://localhost:3001/api/v1';

export interface ApiJob extends Job {
  sources_json?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface JobsResponse {
  jobs: ApiJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface JobStats {
  total_jobs: number;
  unique_companies: number;
  unique_categories: number;
  unique_locations: number;
  avg_salary_min: number;
  avg_salary_max: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
  sourceBreakdown: Array<{ site: string; count: number }>;
}

class JobApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async getJobs(filters: Partial<SearchFilters> = {}, page = 1, limit = 20): Promise<JobsResponse> {
    const params = new URLSearchParams();
    
    if (filters.query) {
      // Use intelligent search expansion
      const searchTerms = intelligentJobMatcher.generateScrapingTerms(filters.query);
      params.set('search', searchTerms.join(' ')); // Send expanded search terms
    }
    if (filters.location) params.set('location', filters.location);
    if (filters.category && filters.category !== 'all') params.set('category', filters.category);
    if (filters.workMode?.length) params.set('workMode', filters.workMode.join(','));
    if (filters.experience?.length) params.set('experience', filters.experience.join(','));
    if (filters.salaryMin) params.set('salaryMin', filters.salaryMin.toString());
    if (filters.salaryMax) params.set('salaryMax', filters.salaryMax.toString());
    if (filters.company) params.set('company', filters.company);
    if (filters.postedWithin) params.set('postedWithin', filters.postedWithin);
    
    params.set('page', page.toString());
    params.set('limit', limit.toString());

    return this.request<JobsResponse>(`/jobs?${params.toString()}`);
  }

  async getJobById(id: string): Promise<ApiJob> {
    return this.request<ApiJob>(`/jobs/${id}`);
  }

  async getCompanies(): Promise<{ companies: Array<{ name: string; jobCount: number }> }> {
    return this.request<{ companies: Array<{ name: string; jobCount: number }> }>('/companies');
  }

  async getJobStats(): Promise<JobStats> {
    return this.request<JobStats>('/jobs/stats');
  }

  async getScrapingLogs(limit = 50): Promise<any[]> {
    return this.request<any[]>(`/scraping/logs?limit=${limit}`);
  }

  async triggerScraping(sites?: string[]): Promise<{ message: string; sites: string[] }> {
    return this.request<{ message: string; sites: string[] }>('/scraping/trigger', {
      method: 'POST',
      body: JSON.stringify({ sites }),
    });
  }

  // Get intelligent search suggestions
  getSearchSuggestions(query: string): string[] {
    return intelligentJobMatcher.getRelatedJobSuggestions(query);
  }

  // Get all available roles
  getAllRoles(): string[] {
    return intelligentJobMatcher.getAllRoles();
  }

  // Get all role categories
  getAllRoleCategories(): string[] {
    return intelligentJobMatcher.getAllRoleCategories();
  }

  // Expand search query intelligently
  expandSearchQuery(query: string) {
    return intelligentJobMatcher.expandSearchQuery(query);
  }

  // Convert API jobs to JobBundles format for compatibility with existing components
  convertToJobBundles(apiJobs: ApiJob[]): JobBundle[] {
    const bundles: JobBundle[] = [];
    const processedJobs = new Set<string>();

    apiJobs.forEach(job => {
      if (processedJobs.has(job.id)) return;

      // Parse sources from JSON string if needed
      let sources = job.sources;
      if (typeof job.sources_json === 'string') {
        try {
          sources = JSON.parse(`[${job.sources_json}]`);
        } catch (error) {
          console.error('Error parsing sources JSON:', error);
          sources = [];
        }
      }

      // Transform snake_case fields to camelCase for frontend compatibility
      const jobWithSources = { 
        ...job, 
        sources,
        postedAt: job.posted_at,
        workMode: job.work_mode,
        salaryMin: job.salary_min,
        salaryMax: job.salary_max,
        descriptionSnippet: job.description_snippet,
        descriptionFull: job.description_full,
        logoUrl: job.logo_url
      };

      // Find duplicates (same title + company)
      const duplicates = apiJobs.filter(otherJob => 
        otherJob.id !== job.id &&
        otherJob.title.toLowerCase() === job.title.toLowerCase() &&
        otherJob.company.toLowerCase() === job.company.toLowerCase() &&
        !processedJobs.has(otherJob.id)
      );

      // Choose canonical job: prefer Company site, then LinkedIn, then earliest posted
      const allVersions = [jobWithSources, ...duplicates.map(j => ({ ...j, sources: j.sources || [] }))];
      const canonicalJob = allVersions.sort((a, b) => {
        const aHasCompany = a.sources.some(s => s.site === "Company");
        const bHasCompany = b.sources.some(s => s.site === "Company");
        
        if (aHasCompany && !bHasCompany) return -1;
        if (!aHasCompany && bHasCompany) return 1;
        
        const aHasLinkedIn = a.sources.some(s => s.site === "LinkedIn");
        const bHasLinkedIn = b.sources.some(s => s.site === "LinkedIn");
        
        if (aHasLinkedIn && !bHasLinkedIn) return -1;
        if (!aHasLinkedIn && bHasLinkedIn) return 1;
        
        const dateA = new Date(a.postedAt);
        const dateB = new Date(b.postedAt);
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
          return 0; // If dates are invalid, don't sort by date
        }
        return dateA.getTime() - dateB.getTime();
      })[0];

      // Mark all as processed
      allVersions.forEach(j => processedJobs.add(j.id));

      bundles.push({
        bundleId: `bundle-${canonicalJob.id}`,
        canonicalJob: canonicalJob,
        duplicates: duplicates.map(j => ({ 
          ...j, 
          sources: j.sources || [],
          postedAt: j.posted_at,
          workMode: j.work_mode,
          salaryMin: j.salary_min,
          salaryMax: j.salary_max,
          descriptionSnippet: j.description_snippet,
          descriptionFull: j.description_full,
          logoUrl: j.logo_url
        }))
      });
    });

    return bundles;
  }
}

export const jobApiService = new JobApiService();
