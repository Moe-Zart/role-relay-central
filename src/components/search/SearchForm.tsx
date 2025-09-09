import { useState } from "react";
import { Search, MapPin, Clock, Briefcase, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SearchFilters } from "@/types/jobs";

interface SearchFormProps {
  onSearch: (filters: SearchFilters) => void;
  initialFilters?: Partial<SearchFilters>;
  compact?: boolean;
}

export const SearchForm = ({ onSearch, initialFilters, compact = false }: SearchFormProps) => {
  const [query, setQuery] = useState(initialFilters?.query || "");
  const [location, setLocation] = useState(initialFilters?.location || "");
  const [radius, setRadius] = useState(initialFilters?.radius || "25 km");
  const [workMode, setWorkMode] = useState<string[]>(initialFilters?.workMode || []);
  const [category, setCategory] = useState(initialFilters?.category || "");

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
      radius,
      workMode,
      category,
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
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Job title or keywords"
            className="pl-10"
          />
        </div>
        <div className="flex-1 relative">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="pl-10"
          />
        </div>
        <Button type="submit" className="px-6">
          Search
        </Button>
      </form>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Junior Software Engineer"
              className="pl-10 h-12"
            />
          </div>
          
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Sydney, NSW"
              className="pl-10 h-12"
            />
          </div>
          
          <Select value={radius} onValueChange={setRadius}>
            <SelectTrigger className="h-12">
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Radius" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5 km">5 km</SelectItem>
              <SelectItem value="10 km">10 km</SelectItem>
              <SelectItem value="25 km">25 km</SelectItem>
              <SelectItem value="50 km">50 km</SelectItem>
              <SelectItem value="100 km">100 km</SelectItem>
              <SelectItem value="Anywhere">Anywhere</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-12">
              <div className="flex items-center">
                <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Category" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              <SelectItem value="Software Engineering">Software Engineering</SelectItem>
              <SelectItem value="Data">Data</SelectItem>
              <SelectItem value="Design">Design</SelectItem>
              <SelectItem value="Product">Product</SelectItem>
              <SelectItem value="Marketing">Marketing</SelectItem>
              <SelectItem value="Sales">Sales</SelectItem>
              <SelectItem value="Customer Support">Customer Support</SelectItem>
              <SelectItem value="Operations">Operations</SelectItem>
              <SelectItem value="Finance">Finance</SelectItem>
              <SelectItem value="HR">HR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground flex items-center">
            <Filter className="mr-1 h-3 w-3" />
            Work Mode:
          </span>
          {["Remote", "On-site", "Hybrid"].map((mode) => (
            <Badge
              key={mode}
              variant={workMode.includes(mode) ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/90"
              onClick={() => handleWorkModeToggle(mode)}
            >
              {mode}
            </Badge>
          ))}
        </div>
        
        <Button type="submit" size="lg" className="w-full md:w-auto px-8">
          Search Jobs
        </Button>
      </form>
    </div>
  );
};