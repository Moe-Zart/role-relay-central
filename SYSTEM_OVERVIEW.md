# 🎬 System Overview Script

## Backend System Explanation

### Introduction
Our job matching platform has a smart backend that scrapes jobs, understands them with AI, and matches them to your resume. Let me break down how it all works.

---

### The Backend Server
**What it is:**
- A Node.js server running on Express
- Handles all the heavy lifting: scraping, matching, and serving data
- Uses SQLite database to store all job listings

**📍 Code Location:**
- **Server Setup**: `server/src/index.js` (lines 1-166)
  - Express app initialization (line 16)
  - Middleware configuration (lines 19-58)
  - Database initialization (line 126)
  - Route setup (line 129)
  - Server startup (lines 135-138)
- **Database**: `server/src/database/init.js` (lines 1-107)
  - SQLite connection and table creation
  - Job storage schema

**What it does:**
- Receives requests from the frontend
- Processes resumes and matches them to jobs
- Scrapes fresh job listings on-demand
- Serves job data through REST API endpoints

---

### Web Scraping

**How scraping works:**
1. **Jora Job Board** - We scrape from Jora.com, a major Australian job aggregator
2. **Puppeteer Browser** - Uses automated browser (headless Chrome) to load pages
3. **Smart Pagination** - Scrapes multiple pages (up to 5 pages per search)
4. **On-Demand** - Only scrapes when you search, keeping data fresh
5. **Data Extraction** - Pulls out:
   - Job title, company, location
   - Salary range, work mode (remote/hybrid/onsite)
   - Job description, posted date
   - Required skills and experience level

**📍 Code Location:**
- **Jora Scraper**: `server/src/scrapers/jora.js` (lines 1-893)
  - Puppeteer browser setup (lines 281-292)
  - Page loading and navigation (lines 307-310)
  - Job card extraction (lines 314-372)
  - Data parsing: title, company, location, salary (lines 376-600)
  - Posted date extraction (lines 500-600)
  - Pagination logic (lines 13-274)
- **Scraper Orchestration**: `server/src/scrapers/scrapeAll.js` (lines 1-40)
  - Calls Jora scraper (lines 20-23)
  - Saves jobs to database (line 23)
- **On-Demand Trigger**: `server/src/routes/on-demand-scraping.js` (lines 1-166)
  - API endpoint: `GET /api/v1/scraping/trigger` (triggered by frontend search)

**🎨 Frontend Location:**
- **Search Trigger**: `src/components/search/SearchForm.tsx`
  - When user searches, triggers scraping via `onDemandScrapingService`
- **Results Page**: `src/pages/Results.tsx`
  - Displays scraped jobs in job cards

**Why Jora?**
- Aggregates jobs from multiple sources
- Easier to scrape than individual company sites
- Good job coverage across Australia

---

### AI Involvement

**AI does three main things:**

**1. Semantic Job Matching**
- Uses `@xenova/transformers` with `all-MiniLM-L6-v2` model
- Converts job descriptions and resumes into numerical vectors
- Calculates similarity scores (0-1 scale)
- Finds jobs that mean the same thing, even with different words
  - Example: "software engineer" matches "developer", "programmer"

**📍 Code Location:**
- **Semantic Matcher**: `server/src/services/semanticMatcher.js` (lines 1-211)
  - Model initialization with `all-MiniLM-L6-v2` (lines 26-30)
  - Embedding generation (lines 46-65)
  - Similarity calculation (lines 67-120)

**2. Resume Parsing**
- Extracts skills and technologies from uploaded PDFs
- Identifies experience level
- **Category Detection** - Determines resume type:
  - Frontend, Backend, Fullstack
  - Data roles, Mobile, DevOps
  - Cloud, Cybersecurity, General

**📍 Code Location:**
- **Resume Parser**: `server/src/services/resumeParser.js` (lines 1-412)
  - PDF text extraction (via `pdf-parse` in `server/src/routes/resume.js` line 37)
  - Skills extraction (lines 81-136)
  - Technologies extraction (lines 138-200)
  - Experience level detection (lines 202-250)
  - **Category Detection**: `determineCategory()` method (lines 299-409)
    - Weighted scoring system for category classification
    - Handles frontend, backend, fullstack, data, mobile, devops, cloud, etc.

**🎨 Frontend Location:**
- **Resume Upload**: `src/components/upload/ResumeUpload.tsx` (lines 74-120)
  - Uploads PDF to backend API endpoint
  - Displays parsed skills and technologies (lines 200-350)
  - Shows primary category badge

**3. Intelligent Job Matching**
- Combines multiple signals:
  - **Category Match (40% weight)** - Does resume category match job category?
  - **Skills Match (20% weight)** - How many required skills do you have?
  - **Technologies Match (15% weight)** - Do you know the tech stack?
  - **Semantic Similarity (25% weight)** - Does the job meaning match your background?
- Calculates match percentage (30-100%)
- Only shows jobs with 30%+ match (stricter for better results)

**📍 Code Location:**
- **Resume Matcher**: `server/src/services/resumeMatcher.js` (lines 1-418)
  - Main matching function: `matchJobToResume()` (lines 16-274)
  - Category matching: `calculateCategoryMatch()` (lines 378-415)
  - Weight calculation (lines 94-95):
    - Category: 40% weight (line 94)
    - Semantic: 25% weight (line 95)
    - Skills: 20% weight (line 96)
    - Technologies: 15% weight (line 97)
  - Bonus scoring logic (lines 120-180)
    - Perfect category match: +20% (line 133)
    - High skill overlap: +6% (line 147)
    - Strong tech match: +6% (line 151)
    - High semantic similarity: +8% (line 155)
  - Job category detection: `determineJobCategory()` (lines 308-372)

**🎨 Frontend Location:**
- **Match Display**: `src/components/jobs/JobCard.tsx` (lines 141-199)
  - Shows match percentage badge (lines 141-150)
  - Displays match score progress bar (lines 196-199)
  - Match reasons display (lines 200-250)
- **Results Filtering**: `src/pages/Results.tsx` (lines 280-330)
  - Filters jobs by match percentage >= 40% (line 308)
  - Sorts by match percentage (highest first) (lines 325-330)

**Bonus Scoring:**
- Perfect category match: +20% bonus
- High skill overlap: +6% bonus
- Strong tech stack match: +6% bonus
- Very high semantic similarity: +8% bonus

---

### How It All Works Together

**User Journey:**

1. **User uploads resume** → Backend receives PDF
   - **📍 Frontend**: `src/components/upload/ResumeUpload.tsx` (lines 74-120)
   - **📍 Backend**: `server/src/routes/resume.js` (lines 19-69)
     - `POST /api/v1/resume/upload` endpoint
     - Parses PDF using `pdf-parse` (line 37)
     - Calls `resumeParser.parseResume()` (line 51)

2. **AI parses resume** → Extracts skills, tech, category (takes ~10 seconds)
   - **📍 Backend**: `server/src/services/resumeParser.js` (lines 39-76)
     - Extracts skills (line 46)
     - Extracts technologies (line 49)
     - Determines category (line 57)

3. **User searches jobs** → Backend triggers scraping if needed
   - **📍 Frontend**: `src/components/search/SearchForm.tsx`
   - **📍 Backend**: `server/src/routes/on-demand-scraping.js`
     - Triggers `GET /api/v1/scraping/trigger`

4. **Jobs get scraped** → Jora provides fresh listings (takes ~30 seconds per page)
   - **📍 Backend**: `server/src/scrapers/jora.js` (lines 276-373)
     - Puppeteer loads page (lines 281-310)
     - Extracts job data (lines 376-600)
     - Saves to database (line 23 in `scrapeAll.js`)

5. **AI matches resume to ALL jobs** → Processes in batches (takes ~2-5 minutes)
   - **📍 Backend**: `server/src/routes/resume.js` (lines 130-200)
     - `POST /api/v1/resume/match-all-jobs` endpoint
     - Processes jobs in batches of 5 (line 150)
     - Calls `resumeMatcher.matchJobToResume()` for each job

6. **Jobs sorted by match score** → Highest matches first
   - **📍 Frontend**: `src/pages/Results.tsx` (lines 325-330)
     - `useMemo` filters and sorts jobs by `matchPercentage` (descending)

7. **Frontend displays results** → User sees personalized job recommendations
   - **📍 Frontend**: `src/pages/Results.tsx` (lines 400-500)
     - Maps through `filteredJobs` and renders `JobCard` components

**Key Features:**
- **Smart Filtering** - Only shows relevant jobs, hides unrelated ones
  - **📍 Code**: `src/pages/Results.tsx` (lines 280-330)
    - Filters by `matchPercentage >= 40` when resume exists
- **Real-time Matching** - AI processes jobs as they're scraped
  - **📍 Code**: `src/pages/Results.tsx` (lines 47-130)
    - `useEffect` triggers matching when resume is present
- **Progress Tracking** - Shows loading states during AI processing
  - **📍 Code**: `src/pages/Results.tsx` (lines 42-44, 500-550)
    - Progress bar with current/total/matched counts
- **Match Reasons** - Explains why each job matches (skills, tech, category)
  - **📍 Code**: `src/components/jobs/JobCard.tsx` (lines 200-250)
    - Displays `matchReasons` array from match details

---

### Database Storage

**What's stored:**
- All scraped jobs (with deduplication)
- Resume parsing results (in browser localStorage)
- Job match scores and reasons
- Scraping logs and timestamps

**📍 Code Location:**
- **Database Schema**: `server/src/database/init.js` (lines 20-100)
  - `jobs` table: stores all job data
  - `job_sources` table: tracks where jobs came from (Jora URLs, etc.)
  - `scraping_logs` table: logs scraping attempts
- **Job Saving**: `server/src/scrapers/jora.js` (lines 650-750)
  - `saveJobsToDatabase()` method
  - Deduplication logic (checks for existing jobs by external ID)
- **Resume Storage**: `src/contexts/ResumeContext.tsx`
  - Stores parsed resume in `localStorage`
  - Stores job matches in `localStorage`
  - Persists across page refreshes

**Data Flow:**
```
Scraper → Database → AI Matcher → Frontend
```

---

### API Endpoints

**Main endpoints:**
- `GET /api/v1/jobs` - Get filtered job listings
  - **📍 Code**: `server/src/routes/jobs.js` (lines 9-250)
    - Handles filtering: search, location, category, workMode, experience, company
    - Returns paginated results
- `POST /api/v1/resume/upload` - Parse uploaded resume PDF
  - **📍 Code**: `server/src/routes/resume.js` (lines 19-69)
    - Accepts multipart/form-data with PDF file
    - Returns parsed resume data
- `POST /api/v1/resume/match-all-jobs` - Match resume against all jobs
  - **📍 Code**: `server/src/routes/resume.js` (lines 130-200)
    - Processes jobs in batches of 5
    - Returns matches with >= 40% score
- `GET /api/v1/scraping/trigger` - Start on-demand scraping
  - **📍 Code**: `server/src/routes/on-demand-scraping.js` (lines 1-166)
    - Triggers Jora scraper
    - Returns scraping status
- `GET /api/v1/companies` - Get list of companies
  - **📍 Code**: `server/src/routes/jobs.js` (lines 500-530)
    - Returns unique companies from database
- `GET /api/v1/categories` - Get job categories
  - **📍 Code**: `server/src/routes/jobs.js` (lines 540-570)
    - Returns unique categories from database
- `GET /api/v1/jobs/by-ids` - Get jobs by array of IDs
  - **📍 Code**: `server/src/routes/jobs.js` (lines 580-609)
    - Used to fetch matched jobs by their IDs after matching

---

### Technology Stack

**Backend:**
- Node.js + Express.js
- Puppeteer (web scraping)
- @xenova/transformers (AI models)
- SQLite (database)
- Winston (logging)

**AI Models:**
- Sentence transformer for semantic matching
- Natural language processing for resume parsing
- Keyword extraction and category detection

---

### Performance & Limitations

**Render Free Tier:**
- Spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds to wake up
- Perfect for demos and development
- Can upgrade to always-on for $7/month

**Processing Times:**
- Resume parsing: ~10 seconds
- Job scraping (1 page): ~5-10 seconds
- Matching 100 jobs: ~2-3 minutes
- Total matching (all pages): ~5-10 minutes for 500+ jobs

---

## Summary

**In Simple Terms:**
Our backend is like a smart assistant that:
1. Goes out and finds jobs for you (scraping)
   - **📍**: `server/src/scrapers/jora.js` scrapes Jora.com with Puppeteer
2. Reads your resume and understands it (AI parsing)
   - **📍**: `server/src/services/resumeParser.js` extracts skills, tech, and category
3. Matches jobs to your background (AI matching)
   - **📍**: `server/src/services/resumeMatcher.js` calculates match scores
4. Only shows you jobs that actually make sense (smart filtering)
   - **📍**: `src/pages/Results.tsx` filters by match percentage >= 40%
5. Tells you why each job matches (transparency)
   - **📍**: `src/components/jobs/JobCard.tsx` displays match reasons and score

All of this happens automatically when you search or upload your resume!

---

## 🗺️ Code Map Reference

### Backend Files
- **Server Entry**: `server/src/index.js` - Express server setup
- **Database**: `server/src/database/init.js` - SQLite schema and initialization
- **Job Routes**: `server/src/routes/jobs.js` - Job CRUD and filtering API
- **Resume Routes**: `server/src/routes/resume.js` - Resume upload and matching API
- **Scraping Routes**: `server/src/routes/on-demand-scraping.js` - On-demand scraping API
- **Jora Scraper**: `server/src/scrapers/jora.js` - Web scraping logic
- **Semantic Matcher**: `server/src/services/semanticMatcher.js` - AI semantic similarity
- **Resume Parser**: `server/src/services/resumeParser.js` - AI resume parsing
- **Resume Matcher**: `server/src/services/resumeMatcher.js` - AI job-resume matching

### Frontend Files
- **Home Page**: `src/pages/Home.tsx` - Landing page with search
- **Results Page**: `src/pages/Results.tsx` - Job listings and filtering
- **Job Card**: `src/components/jobs/JobCard.tsx` - Individual job display with match info
- **Search Form**: `src/components/search/SearchForm.tsx` - Search input
- **Resume Upload**: `src/components/upload/ResumeUpload.tsx` - Resume upload component
- **Resume Context**: `src/contexts/ResumeContext.tsx` - Resume state management
- **API Services**: 
  - `src/services/jobApi.ts` - Job API calls
  - `src/services/resumeService.ts` - Resume API calls

