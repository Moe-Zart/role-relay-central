import { useState, useCallback } from "react";
import { Upload, FileText, X, CheckCircle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useResume } from "@/contexts/ResumeContext";
import { resumeService } from "@/services/resumeService";
import { useToast } from "@/hooks/use-toast";

export const ResumeUpload = ({ compact = false }: { compact?: boolean }) => {
  const { 
    parsedResume, 
    setParsedResume, 
    setJobMatches,
    isProcessing, 
    setIsProcessing,
    processingMessage,
    setProcessingMessage 
  } = useResume();
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'parsing' | 'matching' | 'complete'>('idle');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (isValidFileType(file)) {
        handleFileUpload(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF file.",
          variant: "destructive"
        });
      }
    }
  }, [toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (isValidFileType(file)) {
        handleFileUpload(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF file.",
          variant: "destructive"
        });
      }
    }
  };

  const isValidFileType = (file: File) => {
    const validTypes = ['application/pdf'];
    return validTypes.includes(file.type);
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setIsProcessing(true);
    setUploadProgress('uploading');
    setProcessingMessage('Uploading resume...');

    try {
      // Step 1: Upload and parse
      setUploadProgress('uploading');
      setProcessingMessage('Uploading resume to server...');
      
      setUploadProgress('parsing');
      setProcessingMessage('AI is reading your resume and extracting skills, experience, and technologies...');
      
      const uploadResult = await resumeService.uploadResume(file);

      if (!uploadResult.success || !uploadResult.parsedResume) {
        throw new Error('Failed to parse resume');
      }

      setParsedResume(uploadResult.parsedResume);
      setUploadProgress('matching');
      setProcessingMessage('AI is matching your resume to available jobs...');

      // Step 2: Match to jobs (this stores matches in context/localStorage)
      const matchResult = await resumeService.matchResumeToJobs(uploadResult.parsedResume);

      // Store all matches in context
      const matchesMap = new Map();
      matchResult.matchedJobs.forEach(job => {
        if (job.resumeMatch) {
          matchesMap.set(job.id, job.resumeMatch);
        }
      });
      setJobMatches(matchesMap);

      setUploadProgress('complete');
      setIsProcessing(false);
      setProcessingMessage('');

      toast({
        title: "Resume processed successfully!",
        description: `Found ${matchResult.relevantJobs} matching jobs out of ${matchResult.totalJobs} total jobs.`,
        variant: "default"
      });

      // Navigate to results page only if not in compact mode and not already on results
      if (!compact && window.location.pathname !== '/results') {
        window.location.href = '/results?resumeMatch=true';
      } else if (compact) {
        // In compact mode, refresh the page to show matched jobs
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Resume upload error:', error);
      setIsProcessing(false);
      setUploadProgress('idle');
      setProcessingMessage('');
      setUploadedFile(null);
      
      toast({
        title: "Error processing resume",
        description: error.message || "Failed to process resume. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveResume = () => {
    setUploadedFile(null);
    setParsedResume(null);
    setIsProcessing(false);
    setProcessingMessage('');
    setUploadProgress('idle');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (compact) {
    // Compact version for Results page
    return (
      <div className="space-y-4">
        {!uploadedFile && !parsedResume ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            }`}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Drag and drop your resume here
              </p>
              <p className="text-xs text-muted-foreground">or</p>
              <Button variant="outline" size="sm" className="relative" disabled={isProcessing}>
                Browse file
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isProcessing}
                />
              </Button>
              <p className="text-xs text-muted-foreground">
                PDF only (max 10MB)
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* File Info - Compact */}
            <div className="border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {isProcessing ? (
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  ) : (
                    <FileText className="h-5 w-5 text-primary" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{uploadedFile?.name || 'Resume processed'}</p>
                  </div>
                </div>
                {!isProcessing && (
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <Button variant="ghost" size="sm" onClick={handleRemoveResume}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Processing Status - Compact */}
            {isProcessing && (
              <div className="border rounded-lg p-3 bg-muted/50">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                  <div className="flex-1">
                    <p className="text-xs font-medium">AI Processing</p>
                    <p className="text-xs text-muted-foreground">{processingMessage}</p>
                  </div>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </div>
            )}

            {/* Resume Summary - Compact */}
            {parsedResume && !isProcessing && (
              <div className="border rounded-lg p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Experience:</span>
                  <Badge variant="secondary" className="text-xs">
                    {parsedResume.experienceLevel}
                    {parsedResume.yearsOfExperience > 0 && ` (${parsedResume.yearsOfExperience}y)`}
                  </Badge>
                </div>
                {parsedResume.primaryCategory && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <Badge variant="default" className="text-xs">{parsedResume.primaryCategory}</Badge>
                  </div>
                )}
                {parsedResume.skills && parsedResume.skills.length > 0 ? (
                  <div>
                    <p className="text-muted-foreground mb-1">Skills ({parsedResume.skills.length}):</p>
                    <div className="flex flex-wrap gap-1">
                      {parsedResume.skills.slice(0, 8).map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {parsedResume.skills.length > 8 && (
                        <Badge variant="outline" className="text-xs">
                          +{parsedResume.skills.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">No skills detected</p>
                )}
                {parsedResume.technologies && parsedResume.technologies.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1">Technologies ({parsedResume.technologies.length}):</p>
                    <div className="flex flex-wrap gap-1">
                      {parsedResume.technologies.slice(0, 6).map((tech, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                      {parsedResume.technologies.length > 6 && (
                        <Badge variant="outline" className="text-xs">
                          +{parsedResume.technologies.length - 6} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Upload your resume</CardTitle>
        <p className="text-center text-muted-foreground">
          Our AI will analyze your resume and find jobs that match your skills and experience
        </p>
      </CardHeader>
      <CardContent>
        {!uploadedFile && !parsedResume ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            }`}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <div className="space-y-2">
              <p className="text-lg font-medium">
                Drag and drop your resume here
              </p>
              <p className="text-muted-foreground">
                or
              </p>
              <Button variant="outline" className="relative" disabled={isProcessing}>
                Browse file
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isProcessing}
                />
              </Button>
              <p className="text-xs text-muted-foreground">
                Supports PDF only (max 10MB)
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Info */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-accent-light rounded-lg">
                    {isProcessing ? (
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    ) : (
                      <FileText className="h-6 w-6 text-accent" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{uploadedFile?.name || 'Resume processed'}</p>
                    {uploadedFile && (
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(uploadedFile.size)}
                      </p>
                    )}
                  </div>
                </div>
                {!isProcessing && (
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveResume}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Processing Status */}
            {isProcessing && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center space-x-3">
                  <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">AI Processing</p>
                    <p className="text-xs text-muted-foreground">{processingMessage}</p>
                  </div>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
                
                {/* Progress Steps */}
                <div className="mt-4 space-y-2">
                  <div className={`flex items-center space-x-2 text-sm ${
                    uploadProgress === 'uploading' ? 'text-primary' : 
                    ['parsing', 'matching', 'complete'].includes(uploadProgress) ? 'text-green-500' : 
                    'text-muted-foreground'
                  }`}>
                    {['parsing', 'matching', 'complete'].includes(uploadProgress) ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : uploadProgress === 'uploading' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-current" />
                    )}
                    <span>Uploading resume</span>
                  </div>
                  
                  <div className={`flex items-center space-x-2 text-sm ${
                    uploadProgress === 'parsing' ? 'text-primary' : 
                    ['matching', 'complete'].includes(uploadProgress) ? 'text-green-500' : 
                    'text-muted-foreground'
                  }`}>
                    {['matching', 'complete'].includes(uploadProgress) ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : uploadProgress === 'parsing' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-current" />
                    )}
                    <span>Extracting skills and experience</span>
                  </div>
                  
                  <div className={`flex items-center space-x-2 text-sm ${
                    uploadProgress === 'matching' ? 'text-primary' : 
                    uploadProgress === 'complete' ? 'text-green-500' : 
                    'text-muted-foreground'
                  }`}>
                    {uploadProgress === 'complete' ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : uploadProgress === 'matching' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-current" />
                    )}
                    <span>Matching to jobs</span>
                  </div>
                </div>
              </div>
            )}

            {/* Resume Summary */}
            {parsedResume && !isProcessing && (
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm">Your Resume Summary</h4>
                
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Experience Level</p>
                  <Badge variant="secondary">{parsedResume.experienceLevel}</Badge>
                  {parsedResume.yearsOfExperience > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({parsedResume.yearsOfExperience} years)
                    </span>
                  )}
                </div>

                {parsedResume.skills && parsedResume.skills.length > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Skills ({parsedResume.skills.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {parsedResume.skills.slice(0, 15).map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {parsedResume.skills.length > 15 && (
                        <Badge variant="outline" className="text-xs">
                          +{parsedResume.skills.length - 15} more
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Skills</p>
                    <p className="text-xs text-muted-foreground italic">No skills detected</p>
                  </div>
                )}

                {parsedResume.technologies.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Technologies</p>
                    <div className="flex flex-wrap gap-1">
                      {parsedResume.technologies.slice(0, 10).map((tech, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                      {parsedResume.technologies.length > 10 && (
                        <Badge variant="outline" className="text-xs">
                          +{parsedResume.technologies.length - 10} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Jobs will now show match indicators based on your resume
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
