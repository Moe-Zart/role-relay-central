import { useState, useEffect } from "react";
import { Filter, ChevronDown, ChevronUp, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SearchFilters } from "@/types/jobs";
import { jobApiService } from "@/services/jobApi";

interface JobFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  className?: string;
}

export const JobFilters = ({ filters, onFiltersChange, className }: JobFiltersProps) => {
  const [companies, setCompanies] = useState<Array<{ name: string; jobCount: number }>>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  
  const [expandedSections, setExpandedSections] = useState({
    workMode: true,
    category: true,
    experience: true,
    posted: true,
    company: true
  });

  // Load companies on mount
  useEffect(() => {
    const loadCompanies = async () => {
      setLoadingCompanies(true);
      try {
        const response = await jobApiService.getCompanies();
        setCompanies(response.companies);
      } catch (error) {
        console.error('Failed to load companies:', error);
      } finally {
        setLoadingCompanies(false);
      }
    };
    loadCompanies();
  }, []);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateFilters = (updates: Partial<SearchFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const resetFilters = () => {
    onFiltersChange({
      query: "",
      location: "",
      radius: "25 km",
      workMode: [],
      category: "all",
      distance: 50,
      experience: [],
      postedWithin: "",
      company: ""
    });
  };

  const handleWorkModeChange = (mode: string, checked: boolean) => {
    const newWorkMode = checked 
      ? [...filters.workMode, mode]
      : filters.workMode.filter(m => m !== mode);
    updateFilters({ workMode: newWorkMode });
  };

  const handleExperienceChange = (level: string, checked: boolean) => {
    const newExperience = checked 
      ? [...filters.experience, level]
      : filters.experience.filter(e => e !== level);
    updateFilters({ experience: newExperience });
  };

  const FilterSection = ({ 
    title, 
    section, 
    children 
  }: { 
    title: string; 
    section: keyof typeof expandedSections; 
    children: React.ReactNode;
  }) => (
    <Collapsible 
      open={expandedSections[section]} 
      onOpenChange={() => toggleSection(section)}
    >
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-3 h-auto">
          <span className="font-medium">{title}</span>
          {expandedSections[section] ? 
            <ChevronUp className="h-4 w-4" /> : 
            <ChevronDown className="h-4 w-4" />
          }
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 space-y-0 divide-y divide-border">
        <FilterSection title="Work Mode" section="workMode">
          <div className="space-y-2">
            {["Remote", "On-site", "Hybrid"].map((mode) => (
              <div key={mode} className="flex items-center space-x-2">
                <Checkbox 
                  id={mode}
                  checked={filters.workMode.includes(mode)}
                  onCheckedChange={(checked) => handleWorkModeChange(mode, !!checked)}
                />
                <Label htmlFor={mode}>{mode}</Label>
              </div>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Job Category" section="category">
          <Select value={filters.category} onValueChange={(value) => updateFilters({ category: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Software Engineering">Software Engineering</SelectItem>
            </SelectContent>
          </Select>
        </FilterSection>

        <FilterSection title="Experience Level" section="experience">
          <div className="space-y-2">
            {["Internship", "Junior", "Mid", "Senior", "Lead"].map((level) => (
              <div key={level} className="flex items-center space-x-2">
                <Checkbox 
                  id={level}
                  checked={filters.experience.includes(level)}
                  onCheckedChange={(checked) => handleExperienceChange(level, !!checked)}
                />
                <Label htmlFor={level}>{level}</Label>
              </div>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Posted Date" section="posted">
          <Select value={filters.postedWithin} onValueChange={(value) => updateFilters({ postedWithin: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Any time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any time</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="3d">Last 3 days</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="14d">Last 14 days</SelectItem>
            </SelectContent>
          </Select>
        </FilterSection>

        <FilterSection title="Company" section="company">
          <Select 
            value={filters.company || "all"} 
            onValueChange={(value) => updateFilters({ company: value === "all" ? "" : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All companies">
                {filters.company ? filters.company : "All companies"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All companies</SelectItem>
              {loadingCompanies ? (
                <SelectItem value="loading" disabled>
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading companies...</span>
                  </div>
                </SelectItem>
              ) : (
                companies.map((company) => (
                  <SelectItem key={company.name} value={company.name}>
                    {company.name} ({company.jobCount})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </FilterSection>
      </CardContent>
    </Card>
  );
};