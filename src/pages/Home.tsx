import { useNavigate } from "react-router-dom";
import { SearchForm } from "@/components/search/SearchForm";
import { ResumeUpload } from "@/components/upload/ResumeUpload";
import { Header } from "@/components/layout/Header";
import { SearchFilters } from "@/types/jobs";

const Home = () => {
  const navigate = useNavigate();

  const handleSearch = (filters: SearchFilters) => {
    const params = new URLSearchParams();
    if (filters.query) params.set('q', filters.query);
    if (filters.location) params.set('location', filters.location);
    if (filters.radius) params.set('radius', filters.radius);
    if (filters.workMode.length) params.set('workMode', filters.workMode.join(','));
    if (filters.category) params.set('category', filters.category);
    
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
                Search once. See everything. One place for all your job boards.
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                JobNavigator searches multiple job sites at once and bundles duplicates into a single listing. 
                Filter by distance, work type (remote/on-site/hybrid), and source platforms. Upload your resume 
                to quickly find relevant roles (AI matching coming soon).
              </p>
            </div>
            
            {/* Search Form */}
            <div className="bg-card rounded-2xl p-6 md:p-8 shadow-lg border border-border">
              <SearchForm onSearch={handleSearch} />
            </div>
          </div>
        </div>
      </section>
      
      {/* Resume Upload Section */}
      <section className="py-16 bg-muted/30">
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