import { createContext, useContext, useState, ReactNode } from 'react';
import { ParsedResume, ResumeMatchDetails } from '@/services/resumeService';

interface ResumeContextType {
  parsedResume: ParsedResume | null;
  setParsedResume: (resume: ParsedResume | null) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  processingMessage: string;
  setProcessingMessage: (message: string) => void;
  getMatchForJob: (jobId: string) => ResumeMatchDetails | null;
  setJobMatches: (matches: Map<string, ResumeMatchDetails>) => void;
}

const ResumeContext = createContext<ResumeContextType | undefined>(undefined);

export const ResumeProvider = ({ children }: { children: ReactNode }) => {
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [jobMatches, setJobMatchesMap] = useState<Map<string, ResumeMatchDetails>>(new Map());

  const setJobMatches = (matches: Map<string, ResumeMatchDetails>) => {
    setJobMatchesMap(matches);
  };

  const getMatchForJob = (jobId: string): ResumeMatchDetails | null => {
    return jobMatches.get(jobId) || null;
  };

  return (
    <ResumeContext.Provider
      value={{
        parsedResume,
        setParsedResume,
        isProcessing,
        setIsProcessing,
        processingMessage,
        setProcessingMessage,
        getMatchForJob,
        setJobMatches,
      }}
    >
      {children}
    </ResumeContext.Provider>
  );
};

export const useResume = () => {
  const context = useContext(ResumeContext);
  if (context === undefined) {
    throw new Error('useResume must be used within a ResumeProvider');
  }
  return context;
};

