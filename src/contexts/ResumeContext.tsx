import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  addJobMatch: (jobId: string, match: ResumeMatchDetails) => void;
}

const ResumeContext = createContext<ResumeContextType | undefined>(undefined);

const RESUME_STORAGE_KEY = 'parsedResume';
const MATCHES_STORAGE_KEY = 'jobMatches';

export const ResumeProvider = ({ children }: { children: ReactNode }) => {
  // Load from localStorage on mount
  const [parsedResume, setParsedResumeState] = useState<ParsedResume | null>(() => {
    try {
      const stored = localStorage.getItem(RESUME_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  
  // Load matches from localStorage on mount
  const [jobMatches, setJobMatchesMap] = useState<Map<string, ResumeMatchDetails>>(() => {
    try {
      const stored = localStorage.getItem(MATCHES_STORAGE_KEY);
      if (stored) {
        const matchesObj = JSON.parse(stored);
        return new Map(Object.entries(matchesObj));
      }
    } catch {
      // Ignore
    }
    return new Map();
  });

  // Persist resume to localStorage
  const setParsedResume = (resume: ParsedResume | null) => {
    setParsedResumeState(resume);
    if (resume) {
      localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(resume));
    } else {
      localStorage.removeItem(RESUME_STORAGE_KEY);
      localStorage.removeItem(MATCHES_STORAGE_KEY);
      setJobMatchesMap(new Map());
    }
  };

  // Persist matches to localStorage
  const setJobMatches = (matches: Map<string, ResumeMatchDetails>) => {
    setJobMatchesMap(matches);
    try {
      const matchesObj = Object.fromEntries(matches);
      localStorage.setItem(MATCHES_STORAGE_KEY, JSON.stringify(matchesObj));
    } catch (error) {
      console.error('Error saving matches to localStorage:', error);
    }
  };

  // Add a single match and update storage
  const addJobMatch = (jobId: string, match: ResumeMatchDetails) => {
    const newMatches = new Map(jobMatches);
    newMatches.set(jobId, match);
    setJobMatches(newMatches);
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
        addJobMatch,
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

