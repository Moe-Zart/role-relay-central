import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, ArrowUpDown, Menu, X, Loader2, Clock, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { SearchForm } from "@/components/search/SearchForm";
import { JobFilters } from "@/components/filters/JobFilters";
import { JobCard } from "@/components/jobs/JobCard";
import { ResumeUpload } from "@/components/upload/ResumeUpload";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SearchFilters, JobBundle } from "@/types/jobs";
import { jobApiService } from "@/services/jobApi";
import { resumeService } from "@/services/resumeService";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useResume } from "@/contexts/ResumeContext";

const Results = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState("newest");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobBundle | null>(null);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [jobBundles, setJobBundles] = useState<JobBundle[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const { toast } = useToast();
  const { parsedResume, getMatchForJob, setJobMatches } = useResume();
  const resumeMatchParam = searchParams.get('resumeMatch');
  const [isMatchingJobs, setIsMatchingJobs] = useState(false);
  
  // Match all jobs when resume exists and jobs are loaded
  useEffect(() => {
    if (parsedResume && jobBundles.length > 0 && !isMatchingJobs) {
      // Check if we need to match (if matches don't exist for current jobs)
      const needsMatching = jobBundles.some(bundle => !getMatchForJob(bundle.canonicalJob.id));
      
      if (needsMatching) {
        setIsMatchingJobs(true);
        console.log(`Matching ${jobBundles.length} jobs to resume...`);
        
        // Match all jobs in batches (process 10 at a time to avoid overwhelming the server)
        const batchSize = 10;
        const allMatches = new Map<string, any>();
        
        const processBatch = async (batch: typeof jobBundles) => {
          const matchPromises = batch.map(bundle => {
            const existingMatch = getMatchForJob(bundle.canonicalJob.id);
            if (existingMatch) {
              return Promise.resolve({ jobId: bundle.canonicalJob.id, match: existingMatch });
            }
            
            return resumeService.matchSingleJob(parsedResume, {
              id: bundle.canonicalJob.id,
              title: bundle.canonicalJob.title,
              company: bundle.canonicalJob.company,
              experience: bundle.canonicalJob.experience,
              description_snippet: bundle.canonicalJob.descriptionSnippet,
              description_full: bundle.canonicalJob.descriptionFull
            }).then(result => ({
              jobId: bundle.canonicalJob.id,
              match: result.matchDetails
            })).catch((error) => {
              console.error(`Error matching job ${bundle.canonicalJob.id}:`, error);
              return null;
            });
          });
          
          const results = await Promise.all(matchPromises);
          results.forEach(result => {
            if (result && result.match) {
              allMatches.set(result.jobId, result.match);
            }
          });
        };
        
        // Process in batches
        (async () => {
          for (let i = 0; i < jobBundles.length; i += batchSize) {
            const batch = jobBundles.slice(i, i + batchSize);
            await processBatch(batch);
          }
          
          // Update all matches at once
          setJobMatches(allMatches);
          setIsMatchingJobs(false);
          console.log(`Matched ${allMatches.size} jobs to resume`);
        })().catch(error => {
          console.error('Error matching jobs:', error);
          setIsMatchingJobs(false);
        });
      }
    }
  }, [parsedResume, jobBundles, getMatchForJob, setJobMatches, isMatchingJobs]);

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Recently posted';
      }
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return 'Recently posted';
    }
  };

  // Initialize filters from URL params
  const [filters, setFilters] = useState<SearchFilters>({
    query: searchParams.get('q') || "",
    location: searchParams.get('location') || "",
    radius: searchParams.get('radius') || "25 km",
    workMode: searchParams.get('workMode')?.split(',').filter(Boolean) || [],
    category: searchParams.get('category') || "all",
    distance: 50,
    sources: [],
    experience: [],
    postedWithin: "",
    company: ""
  });

  // Load saved jobs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('savedJobs');
    if (saved) {
      setSavedJobs(JSON.parse(saved));
    }
  }, []);

  // Fetch jobs from API
  const fetchJobs = async (page = 1) => {
    if (page === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    
    try {
      const response = await jobApiService.getJobs(filters, page, pagination.limit);
      const bundles = jobApiService.convertToJobBundles(response.jobs);
      
      if (page === 1) {
        setJobBundles(bundles);
      } else {
        setJobBundles(prev => [...prev, ...bundles]);
      }
      
      setPagination(response.pagination);
    } catch (err) {
      console.error('API Error:', err);
      setError('Backend server is not running. Please start the server to see live job data.');
      
      // Set empty state when API is not available
      if (page === 1) {
        setJobBundles([]);
        setPagination({
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        });
      }
      
      toast({
        title: "Server Unavailable",
        description: "The backend server is not running. Please start it to see live job data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Load next page
  const loadNextPage = () => {
    if (pagination.page < pagination.totalPages && !loadingMore) {
      fetchJobs(pagination.page + 1);
    }
  };

  // Fetch jobs when filters change
  useEffect(() => {
    fetchJobs(1);
  }, [filters]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.query) params.set('q', filters.query);
    if (filters.location) params.set('location', filters.location);
    if (filters.radius) params.set('radius', filters.radius);
    if (filters.workMode.length) params.set('workMode', filters.workMode.join(','));
    if (filters.category) params.set('category', filters.category);
    
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  // Filter and sort jobs
  const filteredJobs = useMemo(() => {
    let filtered = [...jobBundles];

    // If resume is present, prioritize by match score first
    if (parsedResume && sortBy === "newest") {
      filtered.sort((a, b) => {
        const matchA = getMatchForJob(a.canonicalJob.id);
        const matchB = getMatchForJob(b.canonicalJob.id);
        
        // Sort by match percentage (highest first) if both have matches
        if (matchA && matchB) {
          const scoreDiff = matchB.matchPercentage - matchA.matchPercentage;
          if (Math.abs(scoreDiff) > 5) { // Only reorder if significant difference
            return scoreDiff;
          }
        }
        // Fall back to date if no significant match difference
        return new Date(b.canonicalJob.postedAt).getTime() - new Date(a.canonicalJob.postedAt).getTime();
      });
    } else {
      // Apply standard sorting
      filtered.sort((a, b) => {
        switch (sortBy) {
          case "newest":
            return new Date(b.canonicalJob.postedAt).getTime() - new Date(a.canonicalJob.postedAt).getTime();
          case "company-a-z":
            return a.canonicalJob.company.localeCompare(b.canonicalJob.company);
          case "company-z-a":
            return b.canonicalJob.company.localeCompare(a.canonicalJob.company);
          default:
            return new Date(b.canonicalJob.postedAt).getTime() - new Date(a.canonicalJob.postedAt).getTime();
        }
      });
    }

    return filtered;
  }, [jobBundles, sortBy, parsedResume, getMatchForJob]);

  const handleSearch = (newFilters: SearchFilters) => {
    setFilters(newFilters);
  };

  const handleSaveJob = (jobId: string) => {
    const newSavedJobs = savedJobs.includes(jobId)
      ? savedJobs.filter(id => id !== jobId)
      : [...savedJobs, jobId];
    
    setSavedJobs(newSavedJobs);
    localStorage.setItem('savedJobs', JSON.stringify(newSavedJobs));
    
    toast({
      title: savedJobs.includes(jobId) ? "Job removed" : "Job saved",
      description: savedJobs.includes(jobId) 
        ? "Job removed from your saved list" 
        : "Job added to your saved list"
    });
  };

  const quickFilters = [
    { label: "Remote", active: filters.workMode.includes("Remote") },
    { label: "On-site", active: filters.workMode.includes("On-site") },
    { label: "Hybrid", active: filters.workMode.includes("Hybrid") },
    { label: "Posted in last 7 days", active: filters.postedWithin === "7d" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Top Search Bar */}
      <div className="sticky top-16 z-40 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="space-y-4">
            <SearchForm onSearch={handleSearch} initialFilters={filters} compact />
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center space-x-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="company-a-z">Company A→Z</SelectItem>
                      <SelectItem value="company-z-a">Company Z→A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="lg:hidden">
                      <SlidersHorizontal className="h-4 w-4 mr-2" />
                      Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80">
                    <SheetHeader>
                      <SheetTitle>Filters</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4">
                      <JobFilters filters={filters} onFiltersChange={setFilters} />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {quickFilters.map((filter, index) => (
                  <Badge
                    key={index}
                    variant={filter.active ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/90"
                  >
                    {filter.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Resume Upload Section - Compact */}
        <div className="mb-6">
          <Collapsible defaultOpen={!parsedResume}>
            <div className="space-y-4">
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-4 w-4" />
                    <span>{parsedResume ? 'Resume Uploaded ✓ - Click to View/Change' : 'Upload Resume for AI-Powered Job Matching'}</span>
                  </div>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="border rounded-lg p-4 bg-card">
                  <ResumeUpload compact={true} />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar - Desktop */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-48">
              <JobFilters filters={filters} onFiltersChange={setFilters} />
            </div>
          </div>
          
          {/* Results */}
          <div className="lg:col-span-3">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    {loading ? (
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>{filters.query ? 'AI is analyzing all jobs to find the best matches...' : 'Loading jobs...'}</span>
                        </div>
                        {filters.query && (
                          <p className="text-sm text-muted-foreground ml-7">
                            This may take a few moments while AI processes semantic similarity
                          </p>
                        )}
                      </div>
                    ) : (
                      `${pagination.total} job${pagination.total !== 1 ? 's' : ''} found`
                    )}
                  </h2>
                  {parsedResume && !loading && (
                    <div className="flex items-center space-x-2 mt-1">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">
                        {isMatchingJobs ? 'Matching jobs to your resume...' : 'Jobs are matched to your resume'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {error ? (
                <div className="text-center py-12">
                  <div className="text-muted-foreground mb-4">
                    <h3 className="text-lg font-medium mb-2 text-destructive">Server Not Available</h3>
                    <p className="mb-4">{error}</p>
                    <div className="bg-muted p-4 rounded-lg text-left max-w-md mx-auto">
                      <h4 className="font-semibold mb-2">To start the backend server:</h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        <li>Open a terminal in the project root</li>
                        <li>Run: <code className="bg-background px-1 rounded">npm run server:install</code></li>
                        <li>Run: <code className="bg-background px-1 rounded">npm run dev:server</code></li>
                        <li>Or run both frontend and backend: <code className="bg-background px-1 rounded">npm run dev:all</code></li>
                      </ol>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => fetchJobs(1)}>
                    Try Again
                  </Button>
                </div>
              ) : filteredJobs.length === 0 && !loading ? (
                <div className="text-center py-12">
                  <div className="text-muted-foreground mb-4">
                    <SlidersHorizontal className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">
                      {filters.query ? 'No jobs matched your search' : 'No matches yet'}
                    </h3>
                    <p>
                      {filters.query 
                        ? 'Try adjusting your search terms or removing filters.' 
                        : 'Try widening your radius or removing some filters.'}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setFilters({
                    query: "", location: "", radius: "25 km", workMode: [], category: "all",
                    distance: 50, sources: [], experience: [], postedWithin: "any", company: ""
                  })}>
                    Reset all filters
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid gap-6">
                    {filteredJobs.map((bundle) => (
                      <JobCard
                        key={bundle.bundleId}
                        bundle={bundle}
                        onSave={handleSaveJob}
                        onView={setSelectedJob}
                        saved={savedJobs.includes(bundle.canonicalJob.id)}
                      />
                    ))}
                  </div>
                  
                  {/* Load More Button */}
                  {pagination.page < pagination.totalPages && (
                    <div className="flex justify-center mt-8">
                      <Button
                        onClick={loadNextPage}
                        disabled={loadingMore}
                        variant="outline"
                        className="min-w-[200px]"
                      >
                        {loadingMore ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Loading more jobs...
                          </>
                        ) : (
                          <>
                            Load More ({pagination.total - jobBundles.length} remaining)
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  
                  {/* Show current page info */}
                  {pagination.totalPages > 1 && (
                    <div className="text-center mt-4 text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Job Details Modal */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedJob.canonicalJob.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Company</h4>
                    <p>{selectedJob.canonicalJob.company}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Location</h4>
                    <p>{selectedJob.canonicalJob.location}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Work Mode</h4>
                    <Badge variant={selectedJob.canonicalJob.workMode.toLowerCase() as any}>
                      {selectedJob.canonicalJob.workMode}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Experience Level</h4>
                    <Badge variant="outline">{selectedJob.canonicalJob.experience}</Badge>
                  </div>
                </div>
                
                {/* Posted date on Jora */}
                {selectedJob.canonicalJob.postedAt && (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">
                      Posted on Jora: <span className="font-medium">{formatTimeAgo(selectedJob.canonicalJob.postedAt)}</span>
                    </span>
                  </div>
                )}
                
                <div>
                  <h4 className="font-semibold mb-2">Apply on these sites</h4>
                  <div className="flex flex-wrap gap-2">
                    {[...selectedJob.canonicalJob.sources, ...selectedJob.duplicates.flatMap(j => j.sources)]
                      .filter((source, index, self) => index === self.findIndex(s => s.site === source.site))
                      .map((source) => (
                      <Button
                        key={source.site}
                        variant="outline"
                        onClick={() => window.open(source.url, '_blank')}
                        className="flex items-center space-x-2"
                      >
                        <span>Apply on {source.site}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Job Description</h4>
                  <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-line">
                    {selectedJob.canonicalJob.descriptionFull}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Results;