# 🚀 Quick Deployment Guide

## Deploy in 10 Minutes

### Step 1: Deploy Backend (Railway - Recommended)

1. **Go to Railway**: https://railway.app
2. **Sign up** with GitHub
3. **New Project** → **Deploy from GitHub repo**
4. **Select your repository**
5. **Configure Service**:
   - Name: `role-relay-backend`
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`
6. **Add Environment Variables**:
   - `NODE_ENV=production`
   - `PORT=3001`
   - `FRONTEND_URL=https://your-frontend-url.vercel.app` (add after frontend deployment)
7. **Create Volume** (for database persistence):
   - Click "New" → "Volume"
   - Name: `database`
   - Mount Path: `/server/data`
8. **Deploy** → Copy the Railway URL (e.g., `https://role-relay-backend-production.up.railway.app`)

### Step 2: Deploy Frontend (Vercel)

1. **Go to Vercel**: https://vercel.com
2. **Sign up** with GitHub
3. **Add New Project** → Import your GitHub repository
4. **Configure**:
   - Framework Preset: **Vite**
   - Root Directory: `.` (root)
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. **Environment Variables**:
   - `VITE_API_URL=https://your-railway-url.railway.app/api/v1`
   - (Use the Railway URL from Step 1)
6. **Deploy** → Copy the Vercel URL (e.g., `https://role-relay-central.vercel.app`)

### Step 3: Update Backend CORS

1. **Go back to Railway**
2. **Update Environment Variable**:
   - `FRONTEND_URL=https://your-vercel-url.vercel.app`
3. **Redeploy** the backend service

### Step 4: Test Your Live Site

- **Frontend URL**: Your Vercel URL
- **Backend Health**: `https://your-railway-url.railway.app/health`

## Alternative: Render (Free Tier)

### Backend on Render:
1. Go to https://render.com
2. New → Web Service
3. Connect GitHub repo
4. Configure:
   - **Name**: `role-relay-backend`
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `NODE_ENV=production`
     - `PORT=10000`
     - `FRONTEND_URL=https://your-frontend-url.vercel.app`
5. Create **Disk** (for database):
   - Name: `server-data`
   - Mount: `/opt/render/project/src/server/data`
   - Size: 1GB

### Frontend on Vercel:
Same as Step 2 above, but use Render URL:
- `VITE_API_URL=https://role-relay-backend.onrender.com/api/v1`

## Troubleshooting

**CORS Errors?**
- Make sure `FRONTEND_URL` in backend matches your Vercel URL exactly
- Check backend logs for CORS rejections

**Database Not Persisting?**
- Verify volume/disk is mounted correctly
- Check that `server/data/` directory exists

**Build Fails?**
- Check Node.js version (needs 18+)
- Review build logs for missing dependencies

**Puppeteer Errors?**
- Railway/Render should auto-install Chrome
- If issues persist, check build logs

## Your Live URLs

After deployment:
- **Frontend**: `https://your-app.vercel.app`
- **Backend API**: `https://your-app.railway.app` or `https://your-app.onrender.com`
- **API Health**: `https://your-backend-url/health`

## Cost

- **Vercel**: Free for hobby projects ✅
- **Railway**: $5/month free credit (usually enough)
- **Render**: Free tier available (with limitations)

**Total**: $0-5/month depending on usage!

