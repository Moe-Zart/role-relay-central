import { useState } from "react";
import { Filter, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SearchFilters } from "@/types/jobs";

interface JobFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  className?: string;
}

export const JobFilters = ({ filters, onFiltersChange, className }: JobFiltersProps) => {
  const [expandedSections, setExpandedSections] = useState({
    distance: true,
    workMode: true,
    sources: true,
    category: true,
    experience: true,
    salary: true,
    posted: true,
    company: true
  });

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
      sources: [],
      experience: [],
      salaryMin: undefined,
      salaryMax: undefined,
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

  const handleSourceChange = (source: string, checked: boolean) => {
    const newSources = checked 
      ? [...filters.sources, source]
      : filters.sources.filter(s => s !== source);
    updateFilters({ sources: newSources });
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
        <FilterSection title="Distance from you" section="distance">
          <div className="space-y-3">
            <div>
              <Label htmlFor="postcode">Your postcode</Label>
              <Input 
                id="postcode"
                placeholder="e.g. 2000"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Radius: {filters.distance}km</Label>
              <Slider
                value={[filters.distance]}
                onValueChange={([value]) => updateFilters({ distance: value })}
                max={100}
                step={5}
                className="mt-2"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="anywhere" />
              <Label htmlFor="anywhere">Anywhere</Label>
            </div>
          </div>
        </FilterSection>

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

        <FilterSection title="Sources" section="sources">
          <div className="space-y-2">
            {["LinkedIn", "Indeed", "Seek", "Glassdoor", "Company Sites", "Others"].map((source) => (
              <div key={source} className="flex items-center space-x-2">
                <Checkbox 
                  id={source}
                  checked={filters.sources.includes(source)}
                  onCheckedChange={(checked) => handleSourceChange(source, !!checked)}
                />
                <Label htmlFor={source}>{source}</Label>
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

        <FilterSection title="Salary Range (AUD)" section="salary">
          <div className="space-y-3">
            <div>
              <Label htmlFor="salaryMin">Minimum</Label>
              <Input 
                id="salaryMin"
                type="number"
                placeholder="50000"
                value={filters.salaryMin || ""}
                onChange={(e) => updateFilters({ 
                  salaryMin: e.target.value ? parseInt(e.target.value) : undefined 
                })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="salaryMax">Maximum</Label>
              <Input 
                id="salaryMax"
                type="number"
                placeholder="150000"
                value={filters.salaryMax || ""}
                onChange={(e) => updateFilters({ 
                  salaryMax: e.target.value ? parseInt(e.target.value) : undefined 
                })}
                className="mt-1"
              />
            </div>
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
          <Input 
            placeholder="Company name"
            value={filters.company}
            onChange={(e) => updateFilters({ company: e.target.value })}
          />
        </FilterSection>
      </CardContent>
    </Card>
  );
};