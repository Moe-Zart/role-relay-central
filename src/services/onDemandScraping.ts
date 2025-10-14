import { JobBundle, SearchFilters } from '@/types/jobs';

const API_BASE_URL = 'http://localhost:3001/api/v1';

export interface OnDemandScrapingResponse {
  message: string;
  searchQuery: string;
  status: 'started' | 'completed' | 'failed';
  estimatedTime?: string;
}

export interface ScrapingStatusResponse {
  status: 'idle' | 'started' | 'completed' | 'failed';
  site?: string;
  jobsFound?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface JobSearchResponse {
  jobs: JobBundle[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  searchQuery: string;
}

class OnDemandScrapingService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('On-demand scraping request failed:', error);
      
      // Provide more specific error messages
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Backend server is not running. Please start the server first.');
      }
      
      throw error;
    }
  }

  // Check if server is running
  async checkServerStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL.replace('/api/v1', '')}/health`, {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Start on-demand scraping
  async startScraping(searchQuery: string, maxJobs: number = 10): Promise<OnDemandScrapingResponse> {
    return this.request<OnDemandScrapingResponse>('/scraping/scrape-on-demand', {
      method: 'POST',
      body: JSON.stringify({ searchQuery, maxJobs }),
    });
  }

  // Get scraping status
  async getScrapingStatus(): Promise<ScrapingStatusResponse> {
    return this.request<ScrapingStatusResponse>('/scraping/scraping-status');
  }

  // Search jobs with intelligent matching
  async searchJobs(searchQuery: string, page: number = 1, limit: number = 20): Promise<JobSearchResponse> {
    const params = new URLSearchParams({
      q: searchQuery,
      page: page.toString(),
      limit: limit.toString(),
    });

    return this.request<JobSearchResponse>(`/scraping/jobs/search?${params.toString()}`);
  }

  // Poll scraping status until completion
  async waitForScrapingCompletion(
    maxWaitTime: number = 120000, // 2 minutes
    pollInterval: number = 2000   // 2 seconds
  ): Promise<ScrapingStatusResponse> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getScrapingStatus();
          
          if (status.status === 'completed' || status.status === 'failed') {
            resolve(status);
            return;
          }
          
          if (Date.now() - startTime > maxWaitTime) {
            reject(new Error('Scraping timeout - maximum wait time exceeded'));
            return;
          }
          
          // Continue polling
          setTimeout(poll, pollInterval);
        } catch (error) {
          reject(error);
        }
      };
      
      poll();
    });
  }

  // Complete workflow: start scraping, wait for completion, then search jobs
  async scrapeAndSearch(
    searchQuery: string, 
    maxJobs: number = 10,
    maxWaitTime: number = 120000
  ): Promise<{
    scrapingResult: ScrapingStatusResponse;
    jobs: JobBundle[];
    searchQuery: string;
  }> {
    // Check if server is running first
    const isServerRunning = await this.checkServerStatus();
    if (!isServerRunning) {
      throw new Error('Backend server is not running. Please start the server first.');
    }

    // Start scraping
    await this.startScraping(searchQuery, maxJobs);
    
    // Wait for completion
    const scrapingResult = await this.waitForScrapingCompletion(maxWaitTime);
    
    if (scrapingResult.status === 'failed') {
      throw new Error(scrapingResult.error || 'Scraping failed');
    }
    
    // Search for jobs
    const searchResult = await this.searchJobs(searchQuery);
    
    return {
      scrapingResult,
      jobs: searchResult.jobs,
      searchQuery
    };
  }
}

export const onDemandScrapingService = new OnDemandScrapingService();