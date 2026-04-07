# smarthire-ai
SmartHire AI is an intelligent recruitment platform designed to streamline the hiring process using AI-driven automation and data analytics. The system enables efficient candidate screening, skill assessment, and interview scheduling, helping organizations identify top talent faster and more accurately.

## Architecture

- `frontend/`: Next.js app (deploy to Vercel)
- `backend/`: Express API (deploy to Railway or similar)

This repository keeps frontend and backend as separate services for production.

## Environment Variables

### Frontend (`frontend` on Vercel)

Required:

- `NEXT_PUBLIC_API_URL`: Public HTTPS URL of deployed backend API (no trailing slash)

Example:

```env
NEXT_PUBLIC_API_URL=https://smarthire-backend-production.up.railway.app
```

### Backend (`backend` on Railway)

Required:

- `NODE_ENV=production`
- `PORT=5000` (Railway can override at runtime; app already uses `process.env.PORT`)
- `CORS_ORIGINS=https://your-vercel-domain.vercel.app,https://your-custom-domain.com`
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`

Optional:

- `MAX_UPLOAD_MB=8`
- `GROQ_API_KEY=...`
- `GROQ_MODEL=llama-3.3-70b-versatile`
- `SUPABASE_ANON_KEY=...`
- `SMART_HIRE_SEED_DEMO=1`

Important:

- Do not include a trailing slash in `CORS_ORIGINS` or `NEXT_PUBLIC_API_URL`.
- Multiple CORS origins must be comma-separated.

## Deploy Backend (Railway)

1. Create a new Railway project from this repository.
2. Set the service root to `backend`.
3. Set start command to `npm start`.
4. Add backend environment variables from the section above.
5. Deploy and copy the generated Railway URL.
6. Confirm health check works: `GET <RAILWAY_URL>/api/health`.

## Deploy Frontend (Vercel)

1. Create a new Vercel project from this repository.
2. Set Root Directory to `frontend`.
3. Add environment variable:
	- `NEXT_PUBLIC_API_URL=<RAILWAY_BACKEND_URL>`
4. Deploy.
5. If using preview deployments, add each preview domain (or a stable custom frontend domain) to backend `CORS_ORIGINS`.

## Post-Deploy Verification

Run these from the deployed frontend UI:

1. Resume upload:
	- Upload PDF/DOCX/TXT/MD and ensure analysis result returns.
2. Job match:
	- Submit job description and ensure score/matched skills/missing skills render.
3. Learning plan:
	- Generate plan from missing skills and ensure timeline/priorities are returned.

API checks:

- `GET /api/health`
- `POST /api/analyze/resume` (multipart form-data with `resume` file)
- `POST /api/analyze/match`
- `POST /api/analyze/learning-plan`

## Common Deployment Mistakes

- Setting Vercel root to repo root instead of `frontend`.
- Setting Railway root to repo root instead of `backend`.
- Forgetting `NEXT_PUBLIC_API_URL` in Vercel environment variables.
- Using `http://` backend URL instead of `https://` in production.
- Leaving trailing slash in `NEXT_PUBLIC_API_URL` or `CORS_ORIGINS`.
- Not adding frontend domain to backend `CORS_ORIGINS`.
- Expecting local `.env` files to apply automatically in Vercel/Railway.
