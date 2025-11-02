import { useState } from "react";
import { Search, MapPin, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SearchFilters } from "@/types/jobs";

interface SearchFormProps {
  onSearch: (filters: SearchFilters) => void;
  initialFilters?: Partial<SearchFilters>;
  compact?: boolean;
  disabled?: boolean;
}

export const SearchForm = ({ onSearch, initialFilters, compact = false, disabled = false }: SearchFormProps) => {
  const [query, setQuery] = useState(initialFilters?.query || "");
  const [location, setLocation] = useState(initialFilters?.location || "");
  const [workMode, setWorkMode] = useState<string[]>(initialFilters?.workMode || []);

  const handleWorkModeToggle = (mode: string) => {
    setWorkMode(prev => 
      prev.includes(mode) 
        ? prev.filter(m => m !== mode)
        : [...prev, mode]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      query,
      location,
      radius: "25 km", // Default radius
      workMode,
      category: "all", // Default category
      distance: 50,
      sources: [],
      experience: [],
      postedWithin: "",
      company: ""
    });
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex gap-2 w-full">
        <div className="flex-1 relative">
          <label htmlFor="search-query-compact" className="sr-only">Job title or keywords</label>
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            id="search-query-compact"
            name="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Job title or keywords"
            className="pl-10"
            disabled={disabled}
          />
        </div>
        <div className="flex-1 relative">
          <label htmlFor="search-location-compact" className="sr-only">Location</label>
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            id="search-location-compact"
            name="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="pl-10"
            disabled={disabled}
          />
        </div>
        <Button type="submit" className="px-6" disabled={disabled}>
          Search
        </Button>
      </form>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <label htmlFor="search-query" className="sr-only">Job title or keywords</label>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              id="search-query"
              name="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Frontend Developer"
              className="pl-10 h-12"
              disabled={disabled}
            />
          </div>
          
          <div className="relative">
            <label htmlFor="search-location" className="sr-only">Location</label>
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              id="search-location"
              name="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Sydney, NSW"
              className="pl-10 h-12"
              disabled={disabled}
            />
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground flex items-center">
                <Briefcase className="mr-1 h-3 w-3" />
                Work Mode:
              </span>
              {["Remote", "On-site", "Hybrid"].map((mode) => (
                <Badge
                  key={mode}
                  variant={workMode.includes(mode) ? "default" : "outline"}
                  className={`cursor-pointer hover:bg-primary/90 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !disabled && handleWorkModeToggle(mode)}
                >
                  {mode}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        
        <Button type="submit" size="lg" className="w-full md:w-auto px-8" disabled={disabled}>
          Search Jobs
        </Button>
      </form>
    </div>
  );
};