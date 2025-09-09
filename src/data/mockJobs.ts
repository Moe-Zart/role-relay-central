import { Job, JobBundle } from "@/types/jobs";

const mockJobs: Job[] = [
  {
    id: "atlassian-swe-001",
    title: "Junior Software Engineer",
    company: "Atlassian",
    location: "Sydney, NSW, Australia",
    latitude: -33.8688,
    longitude: 151.2093,
    workMode: "Hybrid",
    category: "Software Engineering",
    experience: "Junior",
    salaryMin: 90000,
    salaryMax: 110000,
    descriptionSnippet: "Join Atlassian's Growth Engineering team to build features used by millions. Collaborate, ship fast, and learn from senior mentors.",
    descriptionFull: "Join Atlassian's Growth Engineering team to build features used by millions. Collaborate, ship fast, and learn from senior mentors.\n\nWe're looking for a passionate Junior Software Engineer to help us build the next generation of collaboration tools. You'll work alongside experienced engineers to deliver high-quality software that impacts millions of users worldwide.\n\nResponsibilities:\n• Develop and maintain web applications using modern technologies\n• Collaborate with cross-functional teams to deliver features\n• Write clean, testable, and maintainable code\n• Participate in code reviews and technical discussions\n• Learn from senior engineers and contribute to team knowledge sharing\n\nQualifications:\n• Bachelor's degree in Computer Science or related field\n• 1-2 years of experience with JavaScript, React, or similar technologies\n• Understanding of software development best practices\n• Strong problem-solving skills and attention to detail\n• Excellent communication and teamwork abilities",
    postedAt: "2025-09-01T09:00:00+10:00",
    logoUrl: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=100&h=100&fit=crop&crop=center",
    sources: [
      {
        site: "LinkedIn",
        url: "https://www.linkedin.com/jobs/view/123456",
        postedAt: "2025-09-01T09:00:00+10:00",
        externalId: "123456"
      },
      {
        site: "Seek",
        url: "https://www.seek.com.au/job/789012",
        postedAt: "2025-09-01T10:30:00+10:00",
        externalId: "789012"
      },
      {
        site: "Indeed",
        url: "https://au.indeed.com/viewjob?jk=ABCDEF",
        postedAt: "2025-09-01T11:15:00+10:00",
        externalId: "ABCDEF"
      },
      {
        site: "Glassdoor",
        url: "https://www.glassdoor.com.au/job-listing/123",
        postedAt: "2025-09-01T12:00:00+10:00",
        externalId: "123"
      }
    ]
  },
  {
    id: "google-swe-001",
    title: "Software Engineer - Frontend",
    company: "Google",
    location: "Sydney, NSW, Australia",
    latitude: -33.8688,
    longitude: 151.2093,
    workMode: "On-site",
    category: "Software Engineering",
    experience: "Mid",
    salaryMin: 130000,
    salaryMax: 160000,
    descriptionSnippet: "Build the next generation of Google products that billions of users love and depend on.",
    descriptionFull: "Build the next generation of Google products that billions of users love and depend on. As a Software Engineer at Google, you'll work on cutting-edge technologies and have the opportunity to switch teams and projects as you grow.",
    postedAt: "2025-09-02T14:00:00+10:00",
    logoUrl: "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=100&h=100&fit=crop&crop=center",
    sources: [
      {
        site: "Company",
        url: "https://careers.google.com/jobs/123",
        postedAt: "2025-09-02T14:00:00+10:00",
        externalId: "google-123"
      },
      {
        site: "LinkedIn",
        url: "https://www.linkedin.com/jobs/view/456789",
        postedAt: "2025-09-02T15:30:00+10:00",
        externalId: "456789"
      }
    ]
  },
  {
    id: "canva-design-001",
    title: "Product Designer",
    company: "Canva",
    location: "Sydney, NSW, Australia",
    latitude: -33.8688,
    longitude: 151.2093,
    workMode: "Remote",
    category: "Design",
    experience: "Mid",
    salaryMin: 100000,
    salaryMax: 130000,
    descriptionSnippet: "Design intuitive experiences that empower everyone to create beautiful content.",
    descriptionFull: "Design intuitive experiences that empower everyone to create beautiful content. Join Canva's design team to shape the future of visual communication.",
    postedAt: "2025-09-03T10:00:00+10:00",
    logoUrl: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=100&h=100&fit=crop&crop=center",
    sources: [
      {
        site: "Company",
        url: "https://www.canva.com/careers/designer-123",
        postedAt: "2025-09-03T10:00:00+10:00",
        externalId: "canva-123"
      }
    ]
  },
  {
    id: "uber-data-001",
    title: "Data Scientist",
    company: "Uber",
    location: "Melbourne, VIC, Australia",
    latitude: -37.8136,
    longitude: 144.9631,
    workMode: "Hybrid",
    category: "Data",
    experience: "Senior",
    salaryMin: 140000,
    salaryMax: 180000,
    descriptionSnippet: "Drive insights that shape the future of transportation and delivery.",
    descriptionFull: "Drive insights that shape the future of transportation and delivery. Use data to solve complex problems and improve user experiences across Uber's platforms.",
    postedAt: "2025-09-04T11:00:00+10:00",
    logoUrl: "https://images.unsplash.com/photo-1551808525-51a94da548ce?w=100&h=100&fit=crop&crop=center",
    sources: [
      {
        site: "LinkedIn",
        url: "https://www.linkedin.com/jobs/view/789123",
        postedAt: "2025-09-04T11:00:00+10:00",
        externalId: "789123"
      },
      {
        site: "Indeed",
        url: "https://au.indeed.com/viewjob?jk=GHIJKL",
        postedAt: "2025-09-04T12:30:00+10:00",
        externalId: "GHIJKL"
      }
    ]
  },
  {
    id: "shopify-product-001",
    title: "Product Manager",
    company: "Shopify",
    location: "Brisbane, QLD, Australia",
    latitude: -27.4698,
    longitude: 153.0251,
    workMode: "Remote",
    category: "Product",
    experience: "Senior",
    salaryMin: 150000,
    salaryMax: 190000,
    descriptionSnippet: "Lead product strategy for commerce solutions used by millions of entrepreneurs.",
    descriptionFull: "Lead product strategy for commerce solutions used by millions of entrepreneurs. Drive the vision and execution of features that help businesses thrive.",
    postedAt: "2025-09-05T09:00:00+10:00",
    logoUrl: "https://images.unsplash.com/photo-1556745757-8d76bdb6984b?w=100&h=100&fit=crop&crop=center",
    sources: [
      {
        site: "Company",
        url: "https://www.shopify.com/careers/pm-123",
        postedAt: "2025-09-05T09:00:00+10:00",
        externalId: "shopify-123"
      }
    ]
  },
  {
    id: "salesforce-marketing-001",
    title: "Marketing Manager",
    company: "Salesforce",
    location: "Sydney, NSW, Australia",
    latitude: -33.8688,
    longitude: 151.2093,
    workMode: "On-site",
    category: "Marketing",
    experience: "Mid",
    salaryMin: 90000,
    salaryMax: 120000,
    descriptionSnippet: "Drive growth marketing initiatives for enterprise customers.",
    descriptionFull: "Drive growth marketing initiatives for enterprise customers. Develop and execute marketing campaigns that showcase the power of Salesforce solutions.",
    postedAt: "2025-09-06T13:00:00+10:00",
    logoUrl: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop&crop=center",
    sources: [
      {
        site: "Seek",
        url: "https://www.seek.com.au/job/456789",
        postedAt: "2025-09-06T13:00:00+10:00",
        externalId: "456789"
      }
    ]
  }
];

// Bundle jobs that are duplicates (same title + company)
export const createJobBundles = (jobs: Job[]): JobBundle[] => {
  const bundles: JobBundle[] = [];
  const processedJobs = new Set<string>();

  jobs.forEach(job => {
    if (processedJobs.has(job.id)) return;

    const duplicates = jobs.filter(otherJob => 
      otherJob.id !== job.id &&
      otherJob.title.toLowerCase() === job.title.toLowerCase() &&
      otherJob.company.toLowerCase() === job.company.toLowerCase() &&
      !processedJobs.has(otherJob.id)
    );

    // Choose canonical job: prefer Company site, then LinkedIn, then earliest posted
    const allVersions = [job, ...duplicates];
    const canonicalJob = allVersions.sort((a, b) => {
      const aHasCompany = a.sources.some(s => s.site === "Company");
      const bHasCompany = b.sources.some(s => s.site === "Company");
      
      if (aHasCompany && !bHasCompany) return -1;
      if (!aHasCompany && bHasCompany) return 1;
      
      const aHasLinkedIn = a.sources.some(s => s.site === "LinkedIn");
      const bHasLinkedIn = b.sources.some(s => s.site === "LinkedIn");
      
      if (aHasLinkedIn && !bHasLinkedIn) return -1;
      if (!aHasLinkedIn && bHasLinkedIn) return 1;
      
      return new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime();
    })[0];

    // Mark all as processed
    allVersions.forEach(j => processedJobs.add(j.id));

    bundles.push({
      bundleId: `bundle-${canonicalJob.id}`,
      canonicalJob,
      duplicates: duplicates
    });
  });

  return bundles;
};

export const mockJobBundles = createJobBundles(mockJobs);