# Job Scraper Backend

This is the backend API server for the JobNavigator application that scrapes job listings from multiple job sites.

## Features

- **Multi-site scraping**: Indeed, LinkedIn, Seek, and Glassdoor
- **RESTful API**: Complete CRUD operations for job listings
- **Database storage**: SQLite database with proper indexing
- **Scheduled scraping**: Automatic job updates every 6 hours
- **Rate limiting**: Protection against abuse
- **Comprehensive logging**: Detailed logs for monitoring and debugging

## Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Start the server:
```bash
npm run dev
```

The server will start on `http://localhost:3001`

## API Endpoints

### Jobs
- `GET /api/v1/jobs` - Get all jobs with filtering and pagination
- `GET /api/v1/jobs/:id` - Get job by ID
- `GET /api/v1/jobs/stats` - Get job statistics

### Scraping
- `GET /api/v1/scraping/logs` - Get scraping logs
- `POST /api/v1/scraping/trigger` - Trigger manual scraping

### Health Check
- `GET /health` - Server health status

## Scraping Configuration

The scraper runs automatically on a schedule:
- **Full scraping**: Every 6 hours (all sites)
- **Light scraping**: Every 2 hours (Indeed and Seek only)

### Manual Scraping

You can trigger manual scraping via the API:

```bash
curl -X POST http://localhost:3001/api/v1/scraping/trigger \
  -H "Content-Type: application/json" \
  -d '{"sites": ["indeed", "seek", "glassdoor", "linkedin"]}'
```

## Database Schema

### Jobs Table
- `id` - Unique job identifier
- `title` - Job title
- `company` - Company name
- `location` - Job location
- `work_mode` - Remote/On-site/Hybrid
- `category` - Job category
- `experience` - Experience level
- `salary_min/max` - Salary range
- `description_snippet/full` - Job descriptions
- `posted_at` - When job was posted
- `created_at/updated_at` - Timestamps

### Job Sources Table
- `job_id` - Reference to jobs table
- `site` - Source site (Indeed, LinkedIn, etc.)
- `url` - Original job URL
- `external_id` - Site-specific job ID

### Scraping Logs Table
- `site` - Scraped site
- `status` - Success/Error/Partial
- `jobs_found/added/updated` - Counts
- `duration_ms` - Scraping duration
- `error_message` - Error details if any

## Environment Variables

```env
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
FRONTEND_URL=http://localhost:5173
DB_PATH=./data/jobs.db
SCRAPING_DELAY_MS=2000
MAX_PAGES_PER_SITE=3
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Logs

Logs are stored in the `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

## Development

### Running in Development Mode
```bash
npm run dev
```

### Running Scraper Only
```bash
npm run scrape
```

### Production Build
```bash
npm start
```

## Important Notes

⚠️ **Web Scraping Considerations**:
- Respect robots.txt and terms of service
- Use appropriate delays between requests
- Monitor for rate limiting
- Consider using official APIs when available

⚠️ **LinkedIn Scraping**:
- LinkedIn has strong anti-bot measures
- May require additional configuration for production
- Consider using LinkedIn's official API for better reliability

## Troubleshooting

### Common Issues

1. **Database locked**: Ensure no other processes are using the SQLite database
2. **Scraping fails**: Check internet connection and site availability
3. **Rate limiting**: Increase delays between requests
4. **Memory issues**: Reduce concurrent scrapers or pages per site

### Logs

Check the logs directory for detailed error information:
```bash
tail -f logs/combined.log
tail -f logs/error.log
```
