# 🚀 Quick Deployment Guide - FREE TIER (Render)

## Deploy Backend on Render (FREE - No Credit Card Needed)

### Step 1: Deploy Backend on Render (~5 minutes)

1. **Go to Render**: https://render.com
2. **Sign up** with GitHub (FREE, no credit card required)
3. **Click "New"** → **"Web Service"**
4. **Connect GitHub Repository**:
   - Select your `role-relay-central` repository
   - Click "Connect"
5. **Configure Web Service**:
   - **Name**: `role-relay-backend`
   - **Region**: Choose closest to you (Oregon, Frankfurt, etc.)
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free` (512 MB RAM)
6. **Add Environment Variables** (Environment tab):
   ```
   NODE_ENV=production
   PORT=10000
   FRONTEND_URL=https://your-frontend-url.vercel.app
   ```
   (Add FRONTEND_URL after you deploy frontend)
7. **Create Persistent Disk** (Disks tab):
   - Click "Create Disk"
   - **Name**: `server-data`
   - **Mount Path**: `/opt/render/project/src/server/data`
   - **Size**: 1 GB
   - **Note**: This persists your SQLite database
8. **Click "Create Web Service"**
9. **Wait for Deployment** (~5-10 minutes)
   - Render will build and deploy your backend
   - Copy your Render URL: `https://role-relay-backend.onrender.com`

### Step 2: Deploy Frontend on Vercel (~5 minutes)

1. **Go to Vercel**: https://vercel.com
2. **Sign up** with GitHub
3. **Add New Project** → Import your GitHub repository
4. **Configure**:
   - Framework Preset: **Vite**
   - Root Directory: `.` (root)
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. **Environment Variables**:
   - Click "Environment Variables"
   - Add:
     ```
     VITE_API_URL=https://role-relay-backend.onrender.com/api/v1
     ```
   - Replace with YOUR actual Render URL from Step 1
6. **Click "Deploy"**
7. **Wait for Build** (~2 minutes)
8. **Copy your Vercel URL**: `https://role-relay-central.vercel.app`

### Step 3: Update Backend CORS

1. **Go back to Render dashboard**
2. **Open your backend service**
3. **Go to Environment tab**
4. **Update `FRONTEND_URL`**:
   ```
   FRONTEND_URL=https://your-vercel-url.vercel.app
   ```
   (Use your actual Vercel URL from Step 2)
5. **Render will automatically redeploy**

## ✅ You're Done!

Your live URLs:
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://role-relay-backend.onrender.com`
- **Health Check**: `https://role-relay-backend.onrender.com/health`

## Important Notes

### Render Free Tier Limitations:
- **Spins down after 15 minutes of inactivity** (free tier)
- First request after spin-down takes ~30 seconds to wake up
- Perfect for development/demos
- For production, consider Render's paid tier ($7/month) for always-on

### To Keep Backend Always On (Optional):
- Upgrade Render to "Starter" plan ($7/month)
- Or use Railway's paid tier ($5/month with free credits)

### Test Your Deployment:
1. Visit your Vercel frontend URL
2. Check backend health: `https://your-backend.onrender.com/health`
3. Try uploading a resume and matching jobs

## Troubleshooting

**Backend spins down?**
- First request takes ~30 seconds (normal for free tier)
- Subsequent requests are fast

**CORS errors?**
- Make sure `FRONTEND_URL` in Render matches Vercel URL exactly
- Include `https://` in the URL

**Database not persisting?**
- Verify disk is mounted at `/opt/render/project/src/server/data`
- Check Render logs for mount errors

**Build fails?**
- Check Render build logs
- Ensure Node.js 18+ is used
- Verify all dependencies are in `package.json`

