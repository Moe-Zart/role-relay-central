# Deployment Guide - Role Relay Central

This guide will help you deploy the Role Relay Central application to production.

## Architecture

- **Frontend**: React + Vite (deployed on Vercel)
- **Backend**: Node.js + Express (deployed on Railway or Render)
- **Database**: SQLite (file-based, persisted on backend server)

## Option 1: Deploy with Render (FREE - Recommended)

### Backend Deployment (Render)

1. **Sign up/Login to Render**
   - Go to https://render.com
   - Sign up with GitHub (FREE, no credit card needed)

2. **Create New Web Service**
   - Click "New" → "Web Service"
   - Connect your GitHub repository

3. **Configure Service**
   - **Name**: `role-relay-backend`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (512 MB RAM)

4. **Set Environment Variables**
   - Add:
     ```
     NODE_ENV=production
     PORT=10000
     FRONTEND_URL=https://your-frontend-url.vercel.app
     ```

5. **Create Persistent Disk**
   - Go to "Disks" tab
   - Create disk named `server-data`
   - Mount path: `/opt/render/project/src/server/data`
   - Size: 1GB

6. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy
   - Get your backend URL: `https://role-relay-backend.onrender.com`

**Note**: Render free tier spins down after 15 min inactivity. First request takes ~30 seconds to wake up.

### Frontend Deployment (Vercel)

1. **Sign up/Login to Vercel**
   - Go to https://vercel.com
   - Sign up with GitHub

2. **Import Project**
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Vite

3. **Configure Build Settings**
   - Framework Preset: Vite
   - Root Directory: `.` (root)
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Set Environment Variables**
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add:
     ```
     VITE_API_URL=https://your-app.railway.app
     ```
   - **Important**: Restart deployment after adding env vars

5. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your frontend
   - You'll get a URL like: `https://role-relay-central.vercel.app`

6. **Update Backend CORS**
   - Go back to Railway backend settings
   - Update `FRONTEND_URL` environment variable with your Vercel URL
   - Restart the backend service

## Option 2: Deploy with Railway (Paid - $5/month)

### Backend Deployment (Railway)

**Note**: Railway requires a paid plan ($5/month with free credits) for web services. Free tier only allows databases.

If you want to use Railway:
1. **Upgrade Railway plan** ($5/month)
2. Follow the same steps as Render but use Railway interface
3. Railway provides always-on hosting (no spin-down)

### Frontend Deployment (Vercel)

Follow the same steps as Option 1, but use your Render backend URL:
```
VITE_API_URL=https://role-relay-backend.onrender.com
```

## Post-Deployment Steps

1. **Initial Job Scraping**
   - Once backend is live, jobs will auto-scrape on first startup
   - Or trigger manually via: `POST /api/v1/scraping/trigger`

2. **Verify Deployment**
   - Frontend: Visit your Vercel URL
   - Backend health: Visit `https://your-backend-url/health`
   - Test resume upload and matching

3. **Monitor**
   - Check Railway/Render logs for errors
   - Monitor database size (SQLite files can grow)
   - Set up alerts if needed

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` in backend matches your Vercel URL exactly
- Check that backend allows the frontend origin

### Database Persistence
- Verify volume/disk is mounted correctly
- Check that `server/data/` directory exists
- Database file should persist across deployments

### Puppeteer Issues
- Railway/Render should auto-install Chrome dependencies
- If scraping fails, check logs for Puppeteer errors

### Build Failures
- Check Node.js version (should be 18+)
- Ensure all dependencies are in package.json
- Review build logs for missing dependencies

## Cost Estimate

**Free Tiers:**
- **Vercel**: Free for hobby projects
- **Railway**: $5/month free credit (usually enough for small apps)
- **Render**: Free tier available (with limitations)

**Paid Options:**
- If you exceed free tiers, expect $5-20/month total

## URLs After Deployment

- **Frontend**: `https://your-app.vercel.app`
- **Backend API**: `https://your-app.railway.app` or `https://your-app.onrender.com`
- **Health Check**: `https://your-backend-url/health`

## Next Steps

1. Test all features in production
2. Set up monitoring/alerts
3. Configure custom domains (optional)
4. Set up automated backups for database

