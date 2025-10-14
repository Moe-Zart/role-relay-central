# JobNavigator - Dynamic Job Scraping Platform

A comprehensive job search platform that aggregates job listings from multiple sources (Indeed, LinkedIn, Seek, Glassdoor) into a single, unified interface with intelligent duplicate detection and advanced filtering.

## 🚀 Features

### Frontend (React + TypeScript)
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS
- **Advanced Search**: Multi-criteria filtering (location, salary, work mode, experience level)
- **Job Bundling**: Automatically groups duplicate job postings from different sites
- **Responsive Design**: Mobile-first approach with desktop optimization
- **Real-time Updates**: Dynamic job listings from live scraping
- **Resume Upload**: AI-powered job matching (coming soon)

### Backend (Node.js + Express)
- **Multi-site Scraping**: Indeed, LinkedIn, Seek, and Glassdoor
- **RESTful API**: Complete CRUD operations for job management
- **SQLite Database**: Efficient storage with proper indexing
- **Scheduled Scraping**: Automatic updates every 6 hours
- **Rate Limiting**: Protection against abuse
- **Comprehensive Logging**: Detailed monitoring and debugging

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Job Sites    │
│   (React)       │◄──►│   (Express)     │◄──►│   (Scraping)   │
│   Port: 5173    │    │   Port: 3001    │    │                │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   SQLite DB     │
                       │   (Jobs Data)   │
                       └─────────────────┘
```

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn

### Quick Start

1. **Clone and Install**
```bash
git clone <repository-url>
cd role-relay-central
npm install
```

2. **Install Server Dependencies**
```bash
npm run server:install
```

3. **Start Both Frontend and Backend**
```bash
npm run dev:all
```

This will start:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Individual Setup

#### Frontend Only
```bash
npm run dev
```

#### Backend Only
```bash
npm run dev:server
```

#### Manual Scraping
```bash
npm run server:scrape
```

## 📊 API Documentation

### Jobs Endpoints
- `GET /api/v1/jobs` - Get all jobs with filtering and pagination
- `GET /api/v1/jobs/:id` - Get specific job details
- `GET /api/v1/jobs/stats` - Get job statistics and analytics

### Scraping Endpoints
- `GET /api/v1/scraping/logs` - View scraping history
- `POST /api/v1/scraping/trigger` - Trigger manual scraping

### Query Parameters (Jobs API)
- `search` - Search term for job title, company, or description
- `location` - Job location filter
- `category` - Job category (Software Engineering, Data, Design, etc.)
- `workMode` - Work mode (Remote, On-site, Hybrid)
- `experience` - Experience level (Junior, Mid, Senior, etc.)
- `salaryMin/salaryMax` - Salary range filters
- `page` - Page number for pagination
- `limit` - Number of jobs per page

### Example API Calls
```bash
# Get all software engineering jobs
curl "http://localhost:3001/api/v1/jobs?category=Software Engineering&page=1&limit=20"

# Search for remote jobs
curl "http://localhost:3001/api/v1/jobs?workMode=Remote&search=developer"

# Trigger scraping
curl -X POST "http://localhost:3001/api/v1/scraping/trigger" \
  -H "Content-Type: application/json" \
  -d '{"sites": ["indeed", "seek"]}'
```

## 🗄️ Database Schema

### Jobs Table
```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  work_mode TEXT CHECK (work_mode IN ('Remote', 'On-site', 'Hybrid')),
  category TEXT NOT NULL,
  experience TEXT CHECK (experience IN ('Internship', 'Junior', 'Mid', 'Senior', 'Lead')),
  salary_min INTEGER,
  salary_max INTEGER,
  description_snippet TEXT NOT NULL,
  description_full TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Job Sources Table
```sql
CREATE TABLE job_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  site TEXT CHECK (site IN ('LinkedIn', 'Indeed', 'Seek', 'Glassdoor', 'Company', 'Other')),
  url TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  external_id TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE
);
```

## ⚙️ Configuration

### Environment Variables

Create `server/.env`:
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

### Scraping Schedule
- **Full scraping**: Every 6 hours (all sites)
- **Light scraping**: Every 2 hours (Indeed and Seek only)

## 🔧 Development

### Project Structure
```
├── src/                    # Frontend React app
│   ├── components/        # React components
│   ├── pages/             # Page components
│   ├── services/          # API services
│   ├── types/             # TypeScript types
│   └── hooks/             # Custom React hooks
├── server/                # Backend API server
│   ├── src/
│   │   ├── scrapers/     # Web scraping modules
│   │   ├── routes/       # API routes
│   │   ├── database/     # Database setup
│   │   └── scheduler/    # Job scheduling
│   ├── data/             # SQLite database
│   └── logs/             # Application logs
└── public/               # Static assets
```

### Available Scripts

#### Frontend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

#### Backend
- `npm run dev:server` - Start backend development server
- `npm run server:start` - Start production server
- `npm run server:scrape` - Run manual scraping

#### Combined
- `npm run dev:all` - Start both frontend and backend
- `npm run server:install` - Install server dependencies

## 🚨 Important Considerations

### Web Scraping Ethics
- **Respect robots.txt**: Always check site policies
- **Rate limiting**: Built-in delays to avoid overwhelming servers
- **Terms of service**: Ensure compliance with each platform's ToS
- **Official APIs**: Consider using official APIs when available

### LinkedIn Scraping Challenges
- LinkedIn has strong anti-bot measures
- May require additional configuration for production
- Consider LinkedIn's official API for better reliability
- Monitor for CAPTCHA or blocking

### Production Deployment
- Use environment variables for sensitive configuration
- Implement proper error handling and monitoring
- Consider using a more robust database (PostgreSQL) for production
- Set up proper logging and alerting
- Use a reverse proxy (nginx) for production

## 🐛 Troubleshooting

### Common Issues

1. **Database locked**
   - Ensure no other processes are using the SQLite database
   - Check for zombie processes

2. **Scraping failures**
   - Check internet connection
   - Verify site availability
   - Review scraping logs in `server/logs/`

3. **Rate limiting**
   - Increase delays between requests
   - Reduce concurrent scrapers
   - Check site-specific rate limits

4. **Memory issues**
   - Reduce pages per site
   - Lower concurrent scraper count
   - Monitor memory usage

### Debugging
```bash
# Check server logs
tail -f server/logs/combined.log
tail -f server/logs/error.log

# Test API endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api/v1/jobs/stats
```

## 📈 Future Enhancements

- [ ] LinkedIn official API integration
- [ ] AI-powered job matching
- [ ] Email notifications for new jobs
- [ ] Advanced analytics dashboard
- [ ] Company insights and reviews
- [ ] Salary trend analysis
- [ ] Job application tracking
- [ ] Resume optimization suggestions

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
- Check the troubleshooting section
- Review the logs
- Open an issue on GitHub
- Check the API documentation

---

**Note**: This project is for educational and personal use. Always respect the terms of service of the job sites being scraped and consider using official APIs when available.