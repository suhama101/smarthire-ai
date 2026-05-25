# Vercel Deployment Configuration Guide

## Problem
SmartHire AI uses a monorepo structure with `/frontend` and `/backend` folders. Vercel was configured to build from the root directory (`./`), but the root `package.json` was empty, causing build failures.

## Solution Implemented
Three configuration files have been set up to properly handle the monorepo deployment:

### 1. Root `vercel.json` (with npm --prefix)
```json
{
  "buildCommand": "npm install --prefix frontend && npm run build --prefix frontend",
  "installCommand": "npm install --prefix frontend",
  "framework": "nextjs",
  "crons": [...]
}
```
Uses `npm --prefix` to explicitly target the frontend directory from the root.

### 2. Root `package.json` (monorepo workspace)
```json
{
  "name": "smarthire-ai",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "frontend",
    "backend"
  ]
}
```
Declares this as an npm monorepo with proper workspace structure.

### 3. Frontend `vercel.json` (backup for subdirectory deployment)
```json
{
  "framework": "nextjs",
  "crons": [...]
}
```
If Root Directory is changed to `frontend` in Vercel settings, this file will be used automatically.

## What Needs to Be Done

### Option A: Keep Root Directory as `./` (Current Setting)
No action needed. Vercel should automatically:
1. Detect the `vercel.json` in root
2. Use `npm --prefix frontend` commands
3. Build and deploy the Next.js app from `/frontend`

**Status**: Waiting for Vercel webhook to trigger build on latest commits.

### Option B: Change Root Directory to `frontend` in Vercel UI
If Option A doesn't work:
1. Go to https://vercel.com/suhamas-projects/smarthire-ai-lrq8/settings
2. Find "Root Directory" setting
3. Change from `./` to `frontend`
4. Click "Save"
5. Trigger redeploy or push a new commit

This will use the `frontend/vercel.json` configuration directly.

## Recent Commits
- e0cff4e: Configure root package.json as monorepo workspace
- e958afa: Use npm --prefix for monorepo commands in vercel build
- b4cc913: Trigger Vercel rebuild with updated timestamp

## Expected Result
Live site at https://smarthire-ai-lrq8.vercel.app/ should show:
- ✅ Footer with "SmartHire AI — Enterprise hiring intelligence"
- ✅ Navigation with only "History" and "Login" links
- ✅ NO "System Health" or "Live API status" section
- ✅ NO "Dashboard" or "Batch Upload" in navigation

## Troubleshooting
- If still seeing old code after deployment: Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check Vercel Deployments page for build status: https://vercel.com/suhamas-projects/smarthire-ai-lrq8/deployments
- Check Vercel Build Logs for any npm --prefix related errors
