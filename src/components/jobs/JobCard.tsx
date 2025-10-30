import { useState } from "react";
import { MapPin, Clock, Building2, ExternalLink, Bookmark, Share2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { JobBundle } from "@/types/jobs";
import { formatDistanceToNow } from "date-fns";

interface JobCardProps {
  bundle: JobBundle;
  onSave?: (jobId: string) => void;
  onView?: (bundle: JobBundle) => void;
  saved?: boolean;
}

export const JobCard = ({ bundle, onSave, onView, saved = false }: JobCardProps) => {
  const { canonicalJob, duplicates } = bundle;
  const [imageError, setImageError] = useState(false);
  
  const allSources = [
    ...canonicalJob.sources,
    ...duplicates.flatMap(job => job.sources)
  ];
  
  const uniqueSources = allSources
    .filter((source, index, self) => index === self.findIndex(s => s.site === source.site))
    .sort((a, b) => {
      const order = (site: string) => site === 'Jora' ? 0 : site === 'Company' ? 1 : 2;
      return order(a.site) - order(b.site);
    });

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return null;
    if (min && max) return `$${(min/1000).toFixed(0)}k - $${(max/1000).toFixed(0)}k`;
    if (min) return `$${(min/1000).toFixed(0)}k+`;
    if (max) return `Up to $${(max/1000).toFixed(0)}k`;
    return null;
  };

  const getWorkModeBadgeVariant = (mode: string) => {
    switch (mode.toLowerCase()) {
      case "remote": return "remote";
      case "on-site": return "onsite";
      case "hybrid": return "hybrid";
      default: return "secondary";
    }
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Recently posted';
      }
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      console.error('Error formatting date:', error, 'Date string:', dateString);
      return 'Recently posted';
    }
  };

  const timeAgo = formatTimeAgo(canonicalJob.postedAt);

  return (
    <Card className="hover:shadow-lg transition-all duration-200 border border-border group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
              {canonicalJob.logoUrl && !imageError ? (
                <img
                  src={canonicalJob.logoUrl}
                  alt={`${canonicalJob.company} logo`}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {canonicalJob.title}
              </h3>
              <p className="text-muted-foreground font-medium">{canonicalJob.company}</p>
              <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-1" />
                  {canonicalJob.location}
                </div>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {timeAgo}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSave?.(canonicalJob.id)}
              className={saved ? "text-primary" : "text-muted-foreground"}
            >
              <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigator.share?.({ url: window.location.href })}
              className="text-muted-foreground"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        <p className="text-muted-foreground line-clamp-2">
          {canonicalJob.descriptionSnippet}
        </p>
        
        <div className="flex flex-wrap gap-2">
          <Badge variant={getWorkModeBadgeVariant(canonicalJob.workMode)}>
            {canonicalJob.workMode}
          </Badge>
          <Badge variant="outline">
            {canonicalJob.experience}
          </Badge>
          {formatSalary(canonicalJob.salaryMin, canonicalJob.salaryMax) && (
            <Badge variant="success">
              {formatSalary(canonicalJob.salaryMin, canonicalJob.salaryMax)}
            </Badge>
          )}
          {uniqueSources.length > 1 && (
            <Badge variant="secondary">
              {uniqueSources.length} sources
            </Badge>
          )}
        </div>
        
        <div className="flex flex-wrap gap-1">
          {uniqueSources.map((source) => (
            <button
              key={source.site}
              onClick={() => window.open(source.url, '_blank')}
              className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded-full text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-1"
            >
              <span>{source.site}</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          ))}
        </div>
      </CardContent>
      
      <CardFooter className="pt-3">
        <Button 
          variant="outline" 
          className="w-full"
          onClick={() => onView?.(bundle)}
        >
          <Eye className="h-4 w-4 mr-2" />
          View details
        </Button>
      </CardFooter>
    </Card>
  );
};