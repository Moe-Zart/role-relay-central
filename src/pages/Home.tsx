import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SearchForm } from "@/components/search/SearchForm";
import { ResumeUpload } from "@/components/upload/ResumeUpload";
import { Header } from "@/components/layout/Header";
import { SearchFilters } from "@/types/jobs";
import { onDemandScrapingService } from "@/services/onDemandScraping";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Zap, Clock, CheckCircle, AlertCircle } from "lucide-react";

const Home = () => {
  const navigate = useNavigate();
  const [isScraping, setIsScraping] = useState(false);
  const [scrapingStatus, setScrapingStatus] = useState<string>("");
  const [scrapingError, setScrapingError] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [scrapingProgress, setScrapingProgress] = useState<{
    jobsFound: number;
    estimatedTime: string;
    currentStep: string;
  } | null>(null);

  // Check server status on component mount
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const isOnline = await onDemandScrapingService.checkServerStatus();
        setServerStatus(isOnline ? 'online' : 'offline');
      } catch (error) {
        setServerStatus('offline');
      }
    };

    checkServerStatus();
    
    // Check every 30 seconds
    const interval = setInterval(checkServerStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleSearch = async (filters: SearchFilters) => {
    // Always navigate to results page - AI search will use existing scraped data
    // The Results page will use intelligentJobMatcher to expand the query and find relevant jobs
    const params = new URLSearchParams();
    if (filters.query?.trim()) {
      params.set('q', filters.query.trim());
    }
    if (filters.location) params.set('location', filters.location);
    if (filters.radius) params.set('radius', filters.radius);
    if (filters.workMode.length) params.set('workMode', filters.workMode.join(','));
    if (filters.category && filters.category !== 'all') params.set('category', filters.category);
    
    navigate(`/results?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
                Welcome to JobNavigator
              </h1>
              <h2 className="text-xl md:text-2xl text-muted-foreground">
                Search once. Scrape everything. See all available jobs instantly.
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                JobNavigator uses AI-powered intelligent scraping to find jobs across multiple sites in real-time. 
                Just search for a role and we'll scrape the latest job listings specifically for you with smart matching.
              </p>
            </div>
            
            {/* Search Form */}
            <div className="bg-card rounded-2xl p-6 md:p-8 shadow-lg border border-border">
              <SearchForm onSearch={handleSearch} disabled={isScraping || serverStatus === 'offline'} />
              
              {/* Server Status Indicator */}
              <div className="mt-4 flex items-center justify-center space-x-2">
                {serverStatus === 'checking' && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Checking server status...</span>
                  </>
                )}
                {serverStatus === 'online' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">Backend server is running</span>
                  </>
                )}
                {serverStatus === 'offline' && (
                  <>
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600">Backend server is offline</span>
                  </>
                )}
              </div>
            </div>

            {/* Scraping Status */}
            {(isScraping || scrapingError) && (
              <Card className="max-w-2xl mx-auto">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {scrapingError ? (
                        <AlertCircle className="h-8 w-8 text-destructive" />
                      ) : (
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center space-x-2">
                        {scrapingError ? (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        ) : (
                          <Zap className="h-5 w-5 text-primary" />
                        )}
                        <h3 className={`font-semibold ${scrapingError ? 'text-destructive' : 'text-foreground'}`}>
                          {scrapingError ? 'Scraping Error' : 'AI-Powered Job Scraping'}
                        </h3>
                      </div>
                      <p className={`${scrapingError ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {scrapingStatus}
                      </p>
                      
                      {scrapingProgress && !scrapingError && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Current Step:</span>
                            <Badge variant="secondary">{scrapingProgress.currentStep}</Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Jobs Found:</span>
                            <Badge variant="outline">{scrapingProgress.jobsFound}</Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Estimated Time:</span>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">{scrapingProgress.estimatedTime}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {scrapingError && (
                        <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
                          <p className="text-sm text-destructive">
                            <strong>Solution:</strong> To start the backend server, open a terminal and run:
                          </p>
                          <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                            cd "C:\Users\moham\Role relay central\role-relay-central\server"<br/>
                            npm run dev
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            The server will start on http://localhost:3001 and enable job scraping.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl font-bold text-foreground">How It Works</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Our intelligent scraping system understands job roles and finds related positions automatically
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Search className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">1. Smart Search</h3>
                <p className="text-muted-foreground">
                  Search for any role and our AI expands it to include synonyms and related positions
                </p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">2. Real-time Scraping</h3>
                <p className="text-muted-foreground">
                  We scrape job sites in real-time to find the latest opportunities matching your search
                </p>
              </div>
              
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">3. Instant Results</h3>
                <p className="text-muted-foreground">
                  See all matching jobs with relevance scoring and intelligent categorization
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Resume Upload Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <ResumeUpload />
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 border-t bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-foreground">JobNavigator</span>
              <span className="text-muted-foreground">© 2025</span>
            </div>
            <nav className="flex items-center space-x-6">
              <a href="/about" className="text-muted-foreground hover:text-foreground transition-colors">
                About
              </a>
              <a href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </a>
              <a href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;