# SmartHire AI

SmartHire AI is an AI-driven recruitment platform for resume screening, job matching, batch candidate ranking, and personalized learning plans. The repository is split into a Next.js frontend and an Express backend so the product can be deployed as two independent services.

The current codebase also includes a local session history layer, role-based access for recruiters, resume parsing for PDF/DOCX/TXT/MD files, and AI fallback logic so the app can still return useful results when one provider is missing.

## What It Does

- Analyzes a single resume and extracts structured profile data.
- Compares a resume against a job description and returns a match score.
- Generates a learning plan from the missing skills in a match result.
- Ranks multiple resumes against one role for recruiter batch review.
- Stores analysis and match history in Supabase or in local session storage.
- Supports login, signup, profile updates, and role-based access.

## Tech Stack

| Layer | Tools | Role |
| --- | --- | --- |
| Frontend | Next.js 14.2.3, React 18.3.1, Tailwind CSS, Recharts, Lucide React | UI, routing, dashboard pages, local auth session, frontend API routes |
| Backend | Express 5.2.1, Multer, bcryptjs, jsonwebtoken, Zod | Authentication, file handling, resume analysis, batch ranking, persistence |
| Database | Supabase PostgreSQL | Stores users, analyses, and job matches |
| AI | Groq SDK (`groq-sdk`) | Resume extraction, job matching, learning plans, batch ranking |
| Parsing | pdf-parse, mammoth, Busboy | Reads PDF and DOCX files and handles multipart uploads |
| Testing | Jest, Supertest, Testing Library | Backend route tests and frontend page/component tests |

Important note: the active AI provider is Groq, and the codebase uses `llama-3.3-70b-versatile` as the shared default model.

## Architecture

The app uses two server layers:

1. The Next.js app in `frontend/` renders the UI and also exposes API routes under `frontend/app/api/`.
2. The Express app in `backend/` handles auth, persistence, health checks, and the backend analysis routes.

There are two different API patterns in the frontend:

- Some pages call the local Next.js API routes such as `/api/resume/analyze`, `/api/job/match`, `/api/learning/plan`, and `/api/batch/analyze`.
- Other pages call `/api/analyze/*`, which is forwarded by `frontend/app/api/[...path]/route.js` to the Express backend using `NEXT_PUBLIC_API_URL`, `VITE_API_URL`, or `BACKEND_API_URL`.

That split is intentional. It lets the UI use local API handlers where needed while still keeping the main backend as the source of truth for auth and stored analysis data.

## Main Workflows

### Candidate workflow

1. Upload a resume from the homepage or candidate workbench.
2. Extract structured data such as name, email, skills, experience, and summary.
3. Compare the resume against a job description.
4. Generate a learning plan from the skill gaps.
5. Save the result to local history for later review.

### Recruiter workflow

1. Sign in as a recruiter.
2. Open the batch page.
3. Upload multiple resumes in one multipart request.
4. Rank candidates against a single job description.
5. Review the ranked list and export the session history if needed.

### Auth and session workflow

1. Login or signup returns a JWT and user object from the backend.
2. The frontend stores the session in `localStorage` and also writes a cookie named `smarthire.auth`.
3. `frontend/middleware.js` protects `/dashboard`, `/batch`, and `/history`.
4. Logging out clears both the local storage session and the cookie.

## Project Structure

```text
smarthire-ai/
	backend/
		server.js
		supabase-schema.sql
		controllers/authController.js
		middleware/auth.js
		middleware/upload.js
		routes/auth.js
		routes/analyze.js
		routes/batch.js
		routes/debug.js
		services/groqService.js
		services/db.js
		services/resumeParser.js
		services/supabaseClient.js
		scripts/auth-api-test.js
		__tests__/
	frontend/
		app/
			page.jsx
			login/page.jsx
			signup/page.jsx
			dashboard/page.jsx
			batch/page.jsx
			history/page.jsx
			api/
				[...path]/route.js
				batch/analyze/route.js
				health/route.js
				job/match/route.js
				learning/plan/route.js
				resume/analyze/route.js
		src/
			app/
			components/ui/
			lib/
		middleware.js
		next.config.mjs
		jest.config.js
		jest.setup.js
		__tests__/
	README.md
	TESTING.md
```

Key files worth reading first:

- `backend/server.js` for the Express app, CORS handling, and mounted routes.
- `backend/controllers/authController.js` for signup, login, profile fetch, and profile update.
- `backend/routes/analyze.js` for resume analysis, job matching, learning plans, and deletes.
- `backend/routes/batch.js` for recruiter batch ranking with multipart uploads.
- `frontend/app/page.jsx` for the homepage and quick resume upload.
- `frontend/src/app/dashboard/components/CandidateWorkbench.jsx` for the candidate analysis workbench.
- `frontend/app/batch/page.jsx` for recruiter batch upload and ranking.
- `frontend/app/api/batch/analyze/route.js` for the multipart batch API contract.
- `frontend/src/lib/auth-session.js` for client session persistence.
- `backend/supabase-schema.sql` for the database schema.

## Frontend API Routes

| Method | Path | Purpose | Notes |
| --- | --- | --- | --- |
| GET | `/api/health` | Checks the deployed runtime | Used by the homepage status card |
| POST | `/api/resume/analyze` | Extracts structured data from one resume | Accepts multipart form-data with `resume` |
| POST | `/api/job/match` | Compares a candidate profile against a job description | Uses Groq and falls back to deterministic scoring when unavailable |
| POST | `/api/learning/plan` | Builds a skill-gap learning plan | Uses the match result and candidate profile |
| POST | `/api/batch/analyze` | Ranks multiple resumes against one job description | Accepts multipart form-data with multiple `resumes` files |
| ANY | `/api/[...path]` | Proxies unmatched frontend API calls to the backend | Uses `NEXT_PUBLIC_API_URL`, `VITE_API_URL`, or `BACKEND_API_URL` |

Batch note: the batch route supports one real multipart request with multiple `resumes` files, and it also keeps a JSON fallback path for compatibility.

## Backend API Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` | Creates a new user and returns a JWT |
| POST | `/api/auth/login` | Authenticates a user and returns a JWT |
| GET | `/api/auth/profile` | Returns the current user profile and stats |
| PATCH | `/api/auth/profile` | Updates the current user full name |
| GET | `/api/analyze` | Simple status endpoint for the analyze router |
| POST | `/api/analyze/resume` | Uploads a single resume and stores the analysis |
| POST | `/api/analyze/match` | Matches a stored analysis against a job description |
| POST | `/api/analyze/learning-plan` | Generates a personalized learning plan |
| DELETE | `/api/analyze/analysis/:analysisId` | Deletes one stored analysis |
| DELETE | `/api/analyze/match/:matchId` | Deletes one stored match |
| POST | `/api/batch/analyze` | Ranks multiple resumes on the backend side |
| GET | `/api/health` | Returns service health and timestamp |

The backend batch endpoint accepts multipart uploads with the `resumes` field, and it also supports a single-file JSON fallback for older clients.

## Authentication

Backend auth uses JWTs and Supabase-backed user records.

- Signup and login are handled in `backend/controllers/authController.js`.
- Passwords are hashed with `bcryptjs`.
- JWTs are signed with `JWT_SECRET` and use the configured `JWT_EXPIRES_IN` value.
- `backend/middleware/auth.js` verifies the bearer token and exposes `req.user`.
- `requireRole('recruiter')` is available for recruiter-only flows.

If Supabase is not configured in a non-production environment, the backend falls back to an in-memory user store so local development can still work.

## File Upload and Parsing

Uploads are handled in two places:

- `backend/middleware/upload.js` uses Multer for backend resume uploads.
- `frontend/app/api/batch/analyze/route.js` uses Busboy and in-memory buffers for frontend batch uploads.

Supported file types across the app:

- PDF
- DOCX
- TXT
- MD

Parsing details:

- `backend/services/resumeParser.js` extracts text from uploaded files and cleans the result.
- The Next.js API routes also extract text locally when they need to call Groq.
- The code rejects scanned or image-only PDFs when text extraction is too short.

## AI and Fallback Logic

There are two AI paths in the repo.

### Backend AI path

The backend uses Groq in `backend/services/groqService.js` to:

- Extract resume data
- Match a resume to a job description
- Generate a learning plan from skill gaps

If the Groq API is not available, the backend falls back to deterministic heuristics so the app still returns a result.

### Frontend AI path

The Next.js API routes use Groq through `groq-sdk` to:

- Extract resume data
- Match a candidate profile to a job description
- Generate a learning plan
- Rank multiple resumes in batch mode

If `GROQ_API_KEY` is missing, the frontend routes also fall back to heuristic logic.

## Database Schema

The schema lives in `backend/supabase-schema.sql` and creates three tables:

### `users`

- `id` text primary key
- `email` text unique
- `password_hash` text
- `full_name` text
- `role` text, default `candidate`
- `created_at` timestamptz

### `analyses`

- `id` text primary key
- `user_id` text
- `resume_data` jsonb
- `raw_text` text
- `created_at` timestamptz

### `job_matches`

- `id` text primary key
- `analysis_id` text references `analyses(id)` with cascade delete
- `user_id` text
- `job_title` text
- `company_name` text
- `job_description` text
- `match_result` jsonb
- `created_at` timestamptz

Indexes exist for `users.email`, `analyses.user_id`, `job_matches.user_id`, and `job_matches.analysis_id`.

## Environment Variables

### Frontend

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes for proxy routes | Backend base URL used by `frontend/app/api/[...path]/route.js` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes for frontend auth/storage helpers | Supabase project URL used by the client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes for frontend auth/storage helpers | Supabase anon key used by the client |
| `GROQ_API_KEY` | Yes | Enables the Groq-powered resume, match, learning plan, and batch routes |
| `GROQ_MODEL` | Optional | Groq model name, defaults to `llama-3.3-70b-versatile` |

### Backend

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Yes in production | Runtime mode |
| `PORT` | Usually yes | Backend port, often set by the host |
| `JWT_SECRET` | Yes | Signs JWT tokens |
| `JWT_EXPIRES_IN` | Optional | JWT expiry, defaults to `7d` |
| `SUPABASE_URL` | Yes in production | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes in production | Supabase admin key for server operations |
| `SUPABASE_ANON_KEY` | Optional | Used as a fallback if the service role key is not set |
| `CORS_ORIGINS` | Yes in production | Comma-separated allowed frontend origins |
| `GROQ_API_KEY` | Yes | Enables Groq-based backend AI |
| `GROQ_MODEL` | Optional | Defaults to `llama-3.3-70b-versatile` |
| `MAX_UPLOAD_MB` | Optional | Backend file size limit, defaults to `8` |
| `SMART_HIRE_SEED_DEMO` | Optional | Seeds demo data when set to `1` |
| `SMART_HIRE_DEBUG_AI_LOGS` | Optional | Enables extra AI logging |

Rules that matter:

- Do not add a trailing slash to `NEXT_PUBLIC_API_URL` or `CORS_ORIGINS`.
- If you use multiple frontend domains or preview URLs, add all of them to `CORS_ORIGINS`.
- In production, missing backend credentials cause the backend to fail fast instead of silently falling back.

Example frontend env file:

```env
NEXT_PUBLIC_API_URL=https://your-backend.example.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-me
GROQ_API_KEY=replace-me
GROQ_MODEL=llama-3.3-70b-versatile
```

Example backend env file:

```env
NODE_ENV=production
PORT=5000
JWT_SECRET=replace-me
JWT_EXPIRES_IN=7d
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-me
CORS_ORIGINS=https://your-frontend.vercel.app
GROQ_API_KEY=replace-me
GROQ_MODEL=llama-3.3-70b-versatile
MAX_UPLOAD_MB=8
SMART_HIRE_SEED_DEMO=1
```

## Local Development

This repository does not use a single root package. Install and run the two apps separately.

### Backend

```bash
cd backend
npm install
npm start
```

Useful backend scripts:

- `npm test`
- `npm run api:test-auth`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Useful frontend scripts:

- `npm run build`
- `npm test`

### Suggested setup order

1. Create a Supabase project and run `backend/supabase-schema.sql`.
2. Configure backend environment variables.
3. Start the backend and confirm `GET /api/health` works.
4. Configure frontend environment variables.
5. Start the frontend and test the homepage, dashboard, and batch page.

## Deployment

### Backend deployment

The backend is served through the Express app and the frontend routes are deployed on Vercel.

- Set the root directory to `backend` for local or host-based Express deployments.
- Use `npm start` as the backend start command.
- Keep Node 20 available if your host lets you choose the runtime.
- Set the backend env vars from the table above.

### Frontend deployment

The frontend is designed for Vercel.

- Set the root directory to `frontend`.
- Set `NEXT_PUBLIC_API_URL` to the deployed backend URL.
- Set `GROQ_API_KEY` if you want the Next.js AI routes to use Groq.
- Add the deployed frontend domain to backend `CORS_ORIGINS`.

The repository also includes `frontend/middleware.js` so the protected routes redirect to `/login` when a user is not signed in.

### What to verify after deploy

1. The homepage loads and the health badge shows the API as online.
2. Resume analysis returns structured data.
3. Job matching returns a score and skill gaps.
4. Batch upload accepts multiple resumes in one request.
5. Login, dashboard, and history routes are protected and redirect correctly.

## Testing

Backend coverage includes auth, analyze, batch, and server tests under `backend/__tests__/`.

Frontend coverage includes page and batch behavior tests under `frontend/__tests__/`.

Recommended commands:

```bash
cd backend && npm test
cd frontend && npm test
cd frontend && npm run build
```

## Known Limitations

- Scanned or image-only PDFs will fail because the app expects extractable text.
- Extremely short or generic job descriptions are rejected because the match result would be too noisy.
- The fallback AI mode is useful, but it is less accurate than a configured model.
- Batch ranking is processed sequentially, so very large batches will take longer.
- Local history is browser-based, so clearing browser storage removes the saved session data.

## Current Deployment Status

I could not verify the live Vercel link from here, so this section is based on the code and the last validated local state.

The previously broken batch upload flow has been fixed in the codebase. The batch page now sends one multipart request containing all selected files, and the batch API route accepts multiple `resumes` files and normalizes the returned ranking data.

If anything still appears broken on the deployed link, the most likely causes are configuration issues rather than a code-path blocker:

- Missing or incorrect `NEXT_PUBLIC_API_URL`
- Missing `GROQ_API_KEY` on Vercel
- Missing backend `JWT_SECRET`, `SUPABASE_URL`, or `SUPABASE_SERVICE_ROLE_KEY`
- Backend `CORS_ORIGINS` not including the deployed frontend domain
- A stale production deployment that has not picked up the latest commit

## Interview Talking Points

- The frontend and backend are deployed separately, which keeps the product scalable and easier to debug.
- The app uses graceful degradation: Groq and deterministic fallbacks are supported where appropriate.
- `frontend/app/api/[...path]/route.js` acts as a generic proxy so the UI can still reach the Express backend without hardcoding every route.
- The batch upload fix is a good example of contract alignment: the UI, the API route, and the tests now all agree on one multipart multi-file request shape.
- The history layer is intentionally browser-local, which makes the app usable even when backend persistence is unavailable.
