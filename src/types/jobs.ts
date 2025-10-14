export type JobSource = {
  site: "LinkedIn" | "Indeed" | "Seek" | "Glassdoor" | "Jora" | "Company" | "Other";
  url: string;
  postedAt: string;
  externalId: string;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  latitude?: number;
  longitude?: number;
  workMode: "Remote" | "On-site" | "Hybrid";
  category: "Software Engineering" | "Data" | "Design" | "Product" | "Marketing" | "Sales" | "Customer Support" | "Operations" | "Finance" | "HR";
  experience: "Internship" | "Junior" | "Mid" | "Senior" | "Lead";
  salaryMin?: number;
  salaryMax?: number;
  descriptionSnippet: string;
  descriptionFull: string;
  postedAt: string;
  logoUrl?: string;
  sources: JobSource[];
};

export type JobBundle = {
  bundleId: string;
  canonicalJob: Job;
  duplicates: Job[];
};

export type SearchFilters = {
  query: string;
  location: string;
  radius: string;
  workMode: string[];
  category: string;
  distance: number;
  sources: string[];
  experience: string[];
  salaryMin?: number;
  salaryMax?: number;
  postedWithin: string;
  company: string;
};