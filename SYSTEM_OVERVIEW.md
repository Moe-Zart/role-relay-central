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

**2. Resume Parsing**
- Extracts skills and technologies from uploaded PDFs
- Identifies experience level
- **Category Detection** - Determines resume type:
  - Frontend, Backend, Fullstack
  - Data roles, Mobile, DevOps
  - Cloud, Cybersecurity, General

**3. Intelligent Job Matching**
- Combines multiple signals:
  - **Category Match (40% weight)** - Does resume category match job category?
  - **Skills Match (20% weight)** - How many required skills do you have?
  - **Technologies Match (15% weight)** - Do you know the tech stack?
  - **Semantic Similarity (25% weight)** - Does the job meaning match your background?
- Calculates match percentage (30-100%)
- Only shows jobs with 30%+ match (stricter for better results)

**Bonus Scoring:**
- Perfect category match: +20% bonus
- High skill overlap: +6% bonus
- Strong tech stack match: +6% bonus
- Very high semantic similarity: +8% bonus

---

### How It All Works Together

**User Journey:**

1. **User uploads resume** → Backend receives PDF
2. **AI parses resume** → Extracts skills, tech, category (takes ~10 seconds)
3. **User searches jobs** → Backend triggers scraping if needed
4. **Jobs get scraped** → Jora provides fresh listings (takes ~30 seconds per page)
5. **AI matches resume to ALL jobs** → Processes in batches (takes ~2-5 minutes)
6. **Jobs sorted by match score** → Highest matches first
7. **Frontend displays results** → User sees personalized job recommendations

**Key Features:**
- **Smart Filtering** - Only shows relevant jobs, hides unrelated ones
- **Real-time Matching** - AI processes jobs as they're scraped
- **Progress Tracking** - Shows loading states during AI processing
- **Match Reasons** - Explains why each job matches (skills, tech, category)

---

### Database Storage

**What's stored:**
- All scraped jobs (with deduplication)
- Resume parsing results (in browser localStorage)
- Job match scores and reasons
- Scraping logs and timestamps

**Data Flow:**
```
Scraper → Database → AI Matcher → Frontend
```

---

### API Endpoints

**Main endpoints:**
- `GET /api/v1/jobs` - Get filtered job listings
- `POST /api/v1/resume/parse` - Parse uploaded resume PDF
- `POST /api/v1/resume/match-all-jobs` - Match resume against all jobs
- `GET /api/v1/scraping/trigger` - Start on-demand scraping
- `GET /api/v1/companies` - Get list of companies
- `GET /api/v1/categories` - Get job categories

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
2. Reads your resume and understands it (AI parsing)
3. Matches jobs to your background (AI matching)
4. Only shows you jobs that actually make sense (smart filtering)
5. Tells you why each job matches (transparency)

All of this happens automatically when you search or upload your resume!

