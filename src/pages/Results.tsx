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
import { Progress } from "@/components/ui/progress";
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
  const [matchingProgress, setMatchingProgress] = useState({ current: 0, total: 0, matched: 0 });
  const [matchedJobIds, setMatchedJobIds] = useState<Set<string>>(new Set());
  
  // Match ALL jobs in database when resume exists (only once on mount or resume change)
  useEffect(() => {
    if (parsedResume && !isMatchingJobs && matchedJobIds.size === 0) {
      setIsMatchingJobs(true);
      setMatchingProgress({ current: 0, total: 100, matched: 0 }); // Show indeterminate progress
      // Clear existing jobs while matching - this ensures no jobs show until matching completes
      setJobBundles([]);
      
      console.log('Starting comprehensive resume matching for ALL jobs in database...');
      
      resumeService.matchAllJobs(parsedResume)
        .then(async (result) => {
          console.log(`✅ Resume matching completed: ${result.matchedJobs} matches (>=40%) out of ${result.totalJobs} total jobs`);
          
          // Store all matches
          const matchesMap = new Map<string, any>();
          const matchedIds = new Set<string>();
          
          result.matches.forEach(({ jobId, matchDetails }) => {
            matchesMap.set(jobId, matchDetails);
            matchedIds.add(jobId);
          });
          
          setJobMatches(matchesMap);
          setMatchedJobIds(matchedIds);
          setMatchingProgress({ current: result.totalJobs, total: result.totalJobs, matched: result.matchedJobs });
          setIsMatchingJobs(false);
          
          // Fetch ONLY the matched jobs by their IDs
          const matchedIdsArray = Array.from(matchedIds);
          console.log(`Fetching ${matchedIdsArray.length} matched jobs by IDs:`, matchedIdsArray.slice(0, 5), '...');
          
          if (matchedIdsArray.length > 0) {
            try {
              const matchedJobsResponse = await jobApiService.getJobsByIds(matchedIdsArray);
              console.log(`✅ Fetched ${matchedJobsResponse.jobs.length} jobs from API`);
              
              if (matchedJobsResponse.jobs.length === 0) {
                console.warn('⚠️ API returned 0 jobs even though we requested:', matchedIdsArray);
                toast({
                  title: "No jobs found",
                  description: `Could not fetch the ${matchedIdsArray.length} matched jobs. They may have been removed from the database.`,
                  variant: "destructive"
                });
              } else {
                const matchedBundles = jobApiService.convertToJobBundles(matchedJobsResponse.jobs);
                console.log(`✅ Converted to ${matchedBundles.length} job bundles`);
                
                // Log job IDs for debugging
                const fetchedJobIds = matchedBundles.map(b => b.canonicalJob.id);
                console.log(`Fetched job IDs:`, fetchedJobIds.slice(0, 5));
                console.log(`Matched job IDs set:`, Array.from(matchedIds).slice(0, 5));
                
                // Verify all matched IDs are in fetched jobs
                const missingIds = matchedIdsArray.filter(id => !fetchedJobIds.includes(id));
                if (missingIds.length > 0) {
                  console.warn(`⚠️ Some matched job IDs not found in fetched jobs:`, missingIds);
                }
                
                setJobBundles(matchedBundles);
                
                toast({
                  title: "Resume matching complete!",
                  description: `Found ${result.matchedJobs} matching jobs (>=40% match) out of ${result.totalJobs} total. Showing only matched jobs.`,
                  variant: "default"
                });
              }
            } catch (error) {
              console.error('Error fetching matched jobs:', error);
              toast({
                title: "Resume matching complete!",
                description: `Found ${result.matchedJobs} matching jobs (>=40% match) out of ${result.totalJobs} total.`,
                variant: "default"
              });
            }
          } else {
            console.warn('No matched job IDs to fetch');
            toast({
              title: "No matches found",
              description: `No jobs matched your resume (>=40% threshold). Try uploading a different resume or adjusting your search.`,
              variant: "default"
            });
          }
        })
        .catch(error => {
          console.error('Error matching all jobs:', error);
          setIsMatchingJobs(false);
          setMatchingProgress({ current: 0, total: 0, matched: 0 });
          
          toast({
            title: "Matching failed",
            description: "Failed to match resume to jobs. Please try again.",
            variant: "destructive"
          });
        });
    }
  }, [parsedResume, setJobMatches, toast]); // Only run when resume changes

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

  // When resume matching completes, fetch ALL matched jobs from the backend
  useEffect(() => {
    if (parsedResume && matchedJobIds.size > 0 && !isMatchingJobs && jobBundles.length === 0) {
      // Matching is complete, but we need to fetch the matched jobs
      // The backend has the matches, but we need to get the job data
      // For now, we'll fetch jobs normally and filter client-side
      // But ideally, we should have an endpoint that returns matched jobs only
      fetchJobs(1);
    }
  }, [matchedJobIds.size, parsedResume, isMatchingJobs]);

  // Load next page
  const loadNextPage = () => {
    if (pagination.page < pagination.totalPages && !loadingMore) {
      fetchJobs(pagination.page + 1);
    }
  };

  // Fetch jobs when filters change (only if not matching or if matching is complete)
  // BUT: Don't fetch if resume is present - matched jobs are already loaded
  useEffect(() => {
    // Don't fetch if:
    // 1. Currently matching (wait for matching to complete)
    // 2. Resume is present (matched jobs are already loaded by the matching effect)
    if (!isMatchingJobs && !parsedResume) {
      fetchJobs(1);
    }
  }, [filters, isMatchingJobs, parsedResume]);

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

    // If resume is present and matching is complete, STRICTLY filter to only show matched jobs
    if (parsedResume && matchedJobIds.size > 0 && !isMatchingJobs) {
      console.log(`Filtering ${filtered.length} jobs. Matched job IDs set size: ${matchedJobIds.size}`);
      
      // STRICT FILTER: Only show jobs that:
      // 1. Are in the matchedJobIds set (matched by backend)
      // 2. Have a match record with percentage > 0
      // 3. Have match percentage >= 40% (stricter threshold)
      filtered = filtered.filter(bundle => {
        const jobId = bundle.canonicalJob.id;
        const match = getMatchForJob(jobId);
        const inMatchedSet = matchedJobIds.has(jobId);
        const hasMatch = match && match.matchPercentage > 0;
        const meetsThreshold = match && match.matchPercentage >= 40;
        
        // Debug logging for first few jobs
        if (bundle === filtered[0] || bundle === filtered[1]) {
          console.log(`Job ${jobId}: inMatchedSet=${inMatchedSet}, hasMatch=${hasMatch}, meetsThreshold=${meetsThreshold}, matchPercentage=${match?.matchPercentage}`);
        }
        
        // Must be in matched set AND have valid match with sufficient percentage
        return inMatchedSet && hasMatch && meetsThreshold;
      });
      
      console.log(`After filtering: ${filtered.length} jobs remain`);

      // Always sort by match percentage (highest first) when resume is present
      filtered.sort((a, b) => {
        const matchA = getMatchForJob(a.canonicalJob.id);
        const matchB = getMatchForJob(b.canonicalJob.id);
        
        if (matchA && matchB) {
          // Primary sort: match percentage (highest first)
          const scoreDiff = matchB.matchPercentage - matchA.matchPercentage;
          if (scoreDiff !== 0) {
            return scoreDiff;
          }
          // Secondary sort: posted date (newest first) for same match percentage
          return new Date(b.canonicalJob.postedAt).getTime() - new Date(a.canonicalJob.postedAt).getTime();
        }
        
        // If one has match and other doesn't, prioritize the one with match
        if (matchA && !matchB) return -1;
        if (!matchA && matchB) return 1;
        
        return new Date(b.canonicalJob.postedAt).getTime() - new Date(a.canonicalJob.postedAt).getTime();
      });
    } else if (parsedResume && isMatchingJobs) {
      // While matching is in progress, show NO jobs (empty state)
      filtered = [];
    } else {
      // Apply standard sorting when no resume
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
  }, [jobBundles, sortBy, parsedResume, getMatchForJob, matchedJobIds, isMatchingJobs]);

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
                  {parsedResume && (
                    <div className="flex flex-col space-y-2 mt-1">
                      {isMatchingJobs ? (
                        <>
                          <div className="flex items-center space-x-2">
                            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                            <span className="text-sm text-muted-foreground">
                              Matching all jobs to your resume... This may take a moment
                            </span>
                          </div>
                          {matchingProgress.total > 0 && (
                            <div className="space-y-1">
                              {matchingProgress.current === matchingProgress.total ? (
                                <Progress 
                                  value={100} 
                                  className="w-full"
                                />
                              ) : (
                                <div className="relative">
                                  <Progress 
                                    value={undefined} 
                                    className="w-full"
                                  />
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {matchingProgress.current === matchingProgress.total 
                                  ? `Completed: ${matchingProgress.matched} matches found out of ${matchingProgress.total} total jobs`
                                  : 'Processing all jobs in database... Please wait'}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-sm text-muted-foreground">
                            Showing {matchedJobIds.size} matched jobs (sorted by match %)
                          </span>
                        </div>
                      )}
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