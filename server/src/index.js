import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { initDatabase } from './database/init.js';
import routes from './routes/index.js';
// import { startScrapingScheduler } from './scheduler/index.js';
import { scrapeAllSites } from './scrapers/scrapeAll.js';
import logger from './utils/logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware - configure helmet to allow CORS
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());

// Rate limiting - exclude resume routes as they may need many requests for matching
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased limit for job matching
  message: 'Too many requests from this IP, please try again later.',
  skip: (req) => {
    // Skip rate limiting for resume endpoints
    return req.path.startsWith('/api/v1/resume');
  }
});
app.use(limiter);

// CORS configuration - handle preflight requests
const allowedOrigins = [
  'http://localhost:5173',
  'http://192.168.0.15:8080',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
  // Allow common deployment platforms
  /^https:\/\/.*\.vercel\.app$/,
  /^https:\/\/.*\.railway\.app$/,
  /^https:\/\/.*\.onrender\.com$/,
  /^https:\/\/.*\.netlify\.app$/
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check exact matches
    if (allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      }
      // Check regex patterns
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    })) {
      callback(null, true);
    } else {
      // In production, only allow configured origins
      // In development, allow all (fallback)
      if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
        callback(new Error('Not allowed by CORS'));
      } else {
        callback(null, true); // Allow all origins for development
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Additional headers to help with Chrome security warnings
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Private-Network', 'true');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Initialize database and setup routes
async function startServer() {
  try {
    await initDatabase();
    logger.info('Database initialized successfully');
    
    app.use(routes);
    logger.info('Routes setup successfully');
    
    // Start server first (don't block on scraping)
    const server = createServer(app);
    
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Health check available at http://localhost:${PORT}/health`);
    });
    
    // One-time scrape on server start (Jora, IT-only) - run in background after server starts
    setImmediate(async () => {
      try {
        logger.info('Starting one-time scrape on server boot (Jora)');
        await scrapeAllSites(['jora']);
        logger.info('One-time scrape completed');
      } catch (e) {
        logger.error('One-time scrape failed', e);
      }
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
