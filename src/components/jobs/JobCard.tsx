import { useState, useEffect } from "react";
import { MapPin, Clock, Building2, ExternalLink, Bookmark, Share2, Eye, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { JobBundle } from "@/types/jobs";
import { formatDistanceToNow } from "date-fns";
import { useResume } from "@/contexts/ResumeContext";
import { resumeService, ResumeMatchDetails } from "@/services/resumeService";
import { Progress } from "@/components/ui/progress";

interface JobCardProps {
  bundle: JobBundle;
  onSave?: (jobId: string) => void;
  onView?: (bundle: JobBundle) => void;
  saved?: boolean;
  resumeMatch?: ResumeMatchDetails; // Optional pre-computed match
}

export const JobCard = ({ bundle, onSave, onView, saved = false, resumeMatch: propResumeMatch }: JobCardProps) => {
  const { canonicalJob, duplicates } = bundle;
  const [imageError, setImageError] = useState(false);
  const { parsedResume, getMatchForJob, setJobMatches } = useResume();
  const [resumeMatch, setResumeMatch] = useState<ResumeMatchDetails | null>(propResumeMatch || null);
  const [isMatching, setIsMatching] = useState(false);
  
  // Check if we already have a match from context
  useEffect(() => {
    if (!propResumeMatch && parsedResume) {
      const cachedMatch = getMatchForJob(canonicalJob.id);
      if (cachedMatch) {
        setResumeMatch(cachedMatch);
      } else if (!isMatching) {
        // Fetch match for this job
        setIsMatching(true);
        resumeService.matchSingleJob(parsedResume, {
          id: canonicalJob.id,
          title: canonicalJob.title,
          company: canonicalJob.company,
          experience: canonicalJob.experience,
          description_snippet: canonicalJob.descriptionSnippet,
          description_full: canonicalJob.descriptionFull
        }).then(result => {
          setResumeMatch(result.matchDetails);
          // Cache in context
          const matches = new Map();
          matches.set(canonicalJob.id, result.matchDetails);
          setJobMatches(matches);
          setIsMatching(false);
        }).catch(() => {
          setIsMatching(false);
        });
      }
    }
  }, [parsedResume, canonicalJob.id, propResumeMatch, getMatchForJob, setJobMatches, isMatching]);
  
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

  const getMatchColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (percentage >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const timeAgo = formatTimeAgo(canonicalJob.postedAt);
  const showResumeMatch = parsedResume && resumeMatch;

  return (
    <Card className={`hover:shadow-lg transition-all duration-200 border group ${
      showResumeMatch && resumeMatch.matchPercentage >= 70 ? 'border-primary/30' : 'border-border'
    }`}>
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
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {canonicalJob.title}
                  </h3>
                  <p className="text-muted-foreground font-medium">{canonicalJob.company}</p>
                </div>
                {showResumeMatch && (
                  <div className={`ml-2 px-3 py-1 rounded-full border text-xs font-semibold flex items-center space-x-1 ${getMatchColor(resumeMatch.matchPercentage)}`}>
                    {isMatching ? (
                      <>
                        <Sparkles className="h-3 w-3 animate-pulse" />
                        <span>Matching...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" />
                        <span>{resumeMatch.matchPercentage}% Match</span>
                      </>
                    )}
                  </div>
                )}
              </div>
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
        {/* Resume Match Details */}
        {showResumeMatch && !isMatching && (
          <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Match Score</span>
                <span className="font-semibold">{resumeMatch.matchPercentage}%</span>
              </div>
              <Progress value={resumeMatch.matchPercentage} className="h-2" />
            </div>

            {/* Skills Matched */}
            {resumeMatch.skillsMatched.length > 0 && (
              <div>
                <div className="flex items-center space-x-1 mb-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span className="text-xs font-medium text-green-700">Skills Matched ({resumeMatch.skillsMatched.length})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {resumeMatch.skillsMatched.slice(0, 5).map((skill, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      {skill}
                    </Badge>
                  ))}
                  {resumeMatch.skillsMatched.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{resumeMatch.skillsMatched.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Technologies Matched */}
            {resumeMatch.technologiesMatched.length > 0 && (
              <div>
                <div className="flex items-center space-x-1 mb-1">
                  <CheckCircle2 className="h-3 w-3 text-blue-600" />
                  <span className="text-xs font-medium text-blue-700">Technologies Matched ({resumeMatch.technologiesMatched.length})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {resumeMatch.technologiesMatched.slice(0, 5).map((tech, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      {tech}
                    </Badge>
                  ))}
                  {resumeMatch.technologiesMatched.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{resumeMatch.technologiesMatched.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Experience Level Match */}
            <div className="flex items-center justify-between text-xs pt-1 border-t">
              <span className="text-muted-foreground">Experience Level</span>
              <div className="flex items-center space-x-2">
                <span className="text-xs">{resumeMatch.experienceLevel}</span>
                {resumeMatch.experienceLevelMatch ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                ) : (
                  <XCircle className="h-3 w-3 text-gray-400" />
                )}
                <span className="text-xs text-muted-foreground">→ {resumeMatch.jobExperienceLevel}</span>
              </div>
            </div>

            {/* Match Reasons */}
            {resumeMatch.matchReasons.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">Why this matches:</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {resumeMatch.matchReasons.slice(0, 2).map((reason, idx) => (
                    <li key={idx} className="flex items-start space-x-1">
                      <span className="text-primary">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

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
