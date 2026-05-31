# SmartHire AI — Project Explanation

This document explains what SmartHire AI does, how it works, its features, tech stack, APIs, authentication, resume analysis and job matching flows, environment variables, limitations, and 15 technical interview Q&A based on the actual code.

--

**1) What does this project do?**
- Purpose: SmartHire AI is a resume parsing, analysis, and job-matching web app that helps recruiters and candidates evaluate fit. It accepts resume files, extracts structured data, scores resumes, and compares resumes to job descriptions to produce match scores and recommendations.
- Who uses it: recruiters and candidates (roles: `recruiter`, `candidate`). Frontend UI is in `frontend/` and backend API in `backend/`.
- Main workflow (start-to-finish):
  1. User signs up / logs in via the auth API. See [backend/controllers/authController.js](backend/controllers/authController.js).
  2. User uploads a resume (PDF/DOCX/TXT/MD) via the frontend form which calls the API route `/api/resume/analyze` or backend `/api/analyze/resume` depending on deployment. See `frontend/app/api/resume/analyze/route.js` and [backend/routes/analyze.js](backend/routes/analyze.js).
  3. The server extracts text (`backend/services/resumeParser.js`), optionally converts to markdown, and sends the text to an LLM (Groq/GROQ API) via `frontend/src/lib/groqClient.js` or `backend/services/groqService.js` (Groq SDK wrapper) for structured parsing.
  4. Parsed resume data is normalized and saved to Supabase (or an in-memory fallback) using [`backend/services/db.js`](backend/services/db.js) and [`backend/services/supabaseClient.js`](backend/services/supabaseClient.js).
  5. User can run a job match by submitting a job description. The system calls the Groq model to compute a match (see `frontend/app/api/analyze/match/route.js` and `backend/services/groqService.js`).
  6. Match results and analyses are returned to the UI, and optionally saved to Supabase.

**2) What are all the features?** (file references and short technical explanation)
- Signup / Login: `backend/controllers/authController.js` — creates users in Supabase (or in-memory) and issues JWTs using `jsonwebtoken`, password hashing using `bcryptjs`.
- Profile fetch/update: `backend/controllers/authController.js` + `backend/middleware/auth.js` — JWT-protected endpoints to read/update profile and stats from Supabase.
- Resume upload & parsing: `backend/middleware/upload.js` and `backend/services/resumeParser.js` — Multer-based upload and `pdf-parse` / `mammoth` fallback to extract text.
- Resume analysis (AI): `frontend/app/api/resume/analyze/route.js` and `backend/services/groqService.js` — Calls Groq (via `groq-sdk`) to parse resume into structured JSON; fallback heuristics apply if API key missing.
- Resume markdown conversion: `frontend/app/api/resume/analyze/route.js` uses `analyzeWithGroq` to convert text to Markdown for display.
- Job matching: `frontend/app/api/analyze/match/route.js` and `backend/services/groqService.js` — Sends resume snapshot + job description to Groq to produce a match score and matched/missing skills.
- Learning plan generation: `backend/services/groqService.js` & `backend/routes/analyze.js` — Creates personalized learning plan JSON from missing skills via the Groq model or a deterministic fallback.
- Batch resume upload & bulk matching: `frontend/app/batch/page.jsx`, `frontend/app/api/batch/route.js`, and backend batch routes — multiple resumes processed in sequence and results aggregated and saved with `backend/services/db.js`.
- Save analyses & matches: `frontend/app/api/resume/analyze/route.js` & `backend/services/db.js` — save results into `analyses` and `job_matches` tables in Supabase.
- Proxy to backend for non-local routes: `frontend/app/api/[...path]/route.js` — proxies requests to a separate backend service when necessary, allowing the Next.js app to call the external `backend/` server.
- Rate limiting: `frontend/src/lib/rate-limit.js` (used in API route) — prevents abuse of resume analysis.
- File exports / CSV and reports: `frontend/src/lib/batch-history.js` and batch UI — build CSV export of batch results.
- Demo seeding: `backend/services/db.js -> seedDemoDataIfEmpty` — seeds demo data into Supabase when `SMART_HIRE_SEED_DEMO` enabled.

**3) Complete tech stack** (frontend, backend, DB, AI, infra):
- Frontend: Next.js (app directory, React) — UI, server-side API routes and proxying. Chosen for fast React + server route integration. Files under `frontend/app` and `frontend/src`.
- Backend: Node.js + Express (`backend/server.js`, `backend/routes/*`) — API endpoints for analysis, auth, batch operations; separation offers run-anywhere server.
- Database: Supabase (Postgres) via `@supabase/supabase-js` (`backend/services/supabaseClient.js`) — primary persistent store for users, analyses, matches.
- AI: Groq SDK (`groq-sdk`) used in `frontend/src/lib/groqClient.js` and `backend/services/groqService.js` — interacts with GROQ/Gemini-style or Anthropic-like APIs to parse resumes, match jobs, and create learning plans. A single env var `GROQ_API_KEY` controls configuration.
- Authentication: JWT tokens (`jsonwebtoken`) and password hashing (`bcryptjs`) in `backend/controllers/authController.js` with middleware in `backend/middleware/auth.js`.
- File parsing: `pdf-parse` (backend), `pdf2json` (frontend analyze route), `mammoth` for DOCX — used for extracting text from uploaded files.
- Uploads: `multer` (backend `upload.js`) and `busboy` (frontend API route that handles multipart in Edge/Node runtime).
- Utilities: `zod` for schema validation (auth), `groq-sdk` for LLM calls, `node:stream` and `busboy` for multipart handling.
- Deployment: Vercel for frontend (Next.js) and any Node host or Vercel serverless for backend (backend is standard Express). `vercel.json` present for deployment. `Procfile` for Heroku-like deployments.

**4) APIs and external services used**
- Groq / GROQ_API_KEY (`groq-sdk`): used for resume parsing, conversion to Markdown, job matching, and learning plan generation. Called in:
  - `frontend/src/lib/groqClient.js` (function `analyzeWithGroq`) — messages sent: prompt text; receives unstructured or JSON text.
  - `frontend/app/api/analyze/match/route.js` and `frontend/app/api/resume/analyze/route.js` — send prompts and receive parsed JSON or text.
  - `backend/services/groqService.js` — uses `Groq` client: `getClient().chat.completions.create` and expects structured JSON response.
- Supabase (`@supabase/supabase-js`): used as database and optional auth verification in `frontend/app/api/resume/analyze/route.js` saving analysis; server-side calls in `backend/services/supabaseClient.js` and `backend/services/db.js`. Data sent/received: insert/select rows for `users`, `analyses`, `job_matches`, `batch_runs`.
- pdf parsers: `pdf-parse` (backend/services/resumeParser.js) and `pdf2json` (frontend route) — file bytes uploaded are converted to plain text.
- Mammoth (`mammoth`): DOCX -> text in both backend and frontend routes.
- Busboy / Multer: used to handle multipart/form-data upload streams in Next.js runtime (`busboy`) and Express (`multer`).

**5) How does authentication work? (step-by-step)**
1. Signup (`POST /api/auth/signup`) — `backend/controllers/authController.js` validates input with `zod`, hashes password with `bcryptjs`, inserts into Supabase `users` table (or memory fallback). On success, it generates a JWT using `jsonwebtoken` and `JWT_SECRET` env var and returns `{ token, user }`.
2. Login (`POST /api/auth/login`) — verifies credentials against Supabase `users.password_hash` or in-memory store, compares with `bcrypt.compare`, returns JWT token and user object on success.
3. Frontend stores session in localStorage and cookie via `frontend/src/lib/auth-session.js` (function `persistAuthSession`) which also sets `smarthire.auth` cookie; JWT payload is decoded client-side to derive user id/email/role.
4. Protected backend routes require `Authorization: Bearer <token>` header; `backend/middleware/auth.js` verifies the JWT using `JWT_SECRET` and sets `req.user = decoded` for route handlers.

**6) How does resume analysis work? (step-by-step)**
1. User uploads resume file via UI; frontend posts multipart/form-data to `/api/resume/analyze` (Next.js route) or `/api/analyze/resume` (backend Express route).
2. Request handling: Next.js route uses `busboy` to parse the multipart stream (`frontend/app/api/resume/analyze/route.js`); Express route uses `multer` middleware (`backend/middleware/upload.js`).
3. Text extraction: `pdf2json` or `pdf-parse` or `mammoth` extracts plain text (`extractTextFromUpload` / `backend/services/resumeParser.js`).
4. Optionally convert to Markdown using `analyzeWithGroq` (`frontend/src/lib/groqClient.js`) for nicer display.
5. LLM analysis: the text is sent to Groq (via `analyzeWithGroq` or `backend/services/groqService.extractResumeData`) with a prompt that requests structured JSON. The model returns JSON which is parsed (code has robust parsing `parseModelJsonOrFallback` / `parseJsonResponse`).
6. Normalization & validation: the raw parsed JSON is normalized (`normalizeResumeData` in Groq client and `groqService.normalizeResumeData`) and validated; if missing or malformed, fallback heuristics extract skills and basic fields.
7. Save & respond: normalized `resumeData` is saved to Supabase `analyses` table by `backend/services/db.saveAnalysis`, and the API returns the analysis plus `analysisId` to the client for later job matching.

**7) How does job matching work? (step-by-step)**
1. User submits a job description via UI for a selected analysis (requires `analysisId`). Frontend calls `/api/analyze/match` or `frontend/app/api/analyze/match/route.js`.
2. Server fetches stored analysis from Supabase (`backend/services/db.getAnalysisById`) to retrieve `resume_data` and `raw_text`.
3. The server builds a match prompt including a resume snapshot and the job description (`buildMatchPrompt`), sends it to Groq (`getGroqMatchResult` in `frontend/app/api/analyze/match/route.js` or `backend/services/groqService.matchJobDescription`).
4. The model returns structured JSON with `matchScore`, `matchedSkills`, `missingSkills`, `recommendation`, etc. Parsing logic (`parseJsonResponse` / `parseModelJsonOrFallback`) extracts JSON reliably.
5. The match is normalized via `normalizeMatchResult` or `normalizeMatchResult` in `groqService` and saved to `job_matches` (`backend/services/db.saveJobMatch`).
6. The client receives the match result and displays the overall score and breakdown.

**8) Complete folder structure (important files + one-line description)**
- `backend/` — Express backend server and routes
  - `server.js` — Express app entry point and configuration
  - `routes/auth.js` — auth endpoints (signup/login/profile)
  - `routes/analyze.js` — resume analyze, match, learning-plan endpoints
  - `routes/batch.js` — batch processing endpoints
  - `controllers/authController.js` — signup/login/profile logic
  - `middleware/auth.js` — JWT verification middleware
  - `middleware/upload.js` — file upload (multer) settings
  - `services/groqService.js` — Groq model integration, parsing, matching, learning plan
  - `services/supabaseClient.js` — creates Supabase client or in-memory fallback
  - `services/db.js` — DB actions (saveAnalysis, saveJobMatch, etc.)
  - `services/resumeParser.js` — PDF/DOCX/text extraction
  - `uploads/` — sample resume files used in tests
- `frontend/` — Next.js app + UI
  - `app/` — Next.js app routes and API route wrappers
    - `api/resume/analyze/route.js` — Next.js API route that analyzes uploaded resume
    - `api/analyze/match/route.js` — match API (calls Groq)
    - `api/[...path]/route.js` — proxy some requests to a separate backend server
  - `src/` — client-side libs
    - `lib/groqClient.js` — helper to call Groq
    - `lib/api.js` — API URL helpers
    - `lib/auth-session.js` — client auth persistence helpers
    - `lib/input-utils.js` — sanitize helpers and client-side validation
    - `lib/rate-limit.js` — simple rate limit helper for API routes
  - `app/batch/page.jsx` — batch upload UI and CSV export
- `package.json` and `frontend/package.json` — project dependencies
- `backend/.env.example` and `frontend/.env.example` — env variables required

**9) Environment variables needed (where used)**
- `JWT_SECRET` (backend/controllers/authController.js, backend/middleware/auth.js) — secret key to sign and verify JWTs.
- `JWT_EXPIRES_IN` (backend/controllers/authController.js) — expiry string for JWT tokens.
- `SUPABASE_URL` (backend/services/supabaseClient.js, frontend/app/api/resume/analyze/route.js) — Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` (backend/services/supabaseClient.js, frontend/app/api/resume/analyze/route.js) — Supabase service role key used server-side for writes.
- `SUPABASE_ANON_KEY` (backend/services/supabaseClient.js) — optional anon key fallback.
- `GROQ_API_KEY` (frontend/src/lib/groqClient.js, backend/services/groqService.js, frontend/API routes) — API key for Groq model. If missing, the app uses deterministic fallbacks.
- `GROQ_MODEL` (frontend/src/lib/groqClient.js, backend/services/groqService.js) — model identifier to call (e.g., `llama-3.1-8b-instant` or `llama-3.3-70b-versatile`).
- `API_URL` / `BACKEND_API_URL` / `NEXT_PUBLIC_API_URL` (frontend/app/api/[...path]/route.js, frontend/.env.example) — URL of separate backend server used by proxy routes.
- `PORT` (backend/server.js) — backend server port.
- `NODE_ENV` (many files) — production/test behavior branches.
- `CORS_ORIGINS` (backend/server.js) — CSV of allowed origins for CORS.
- `MAX_UPLOAD_MB` (backend/middleware/upload.js) — limit upload size.
- `SMART_HIRE_SEED_DEMO` (backend/server.js) — when `1`, seeds demo data into Supabase on startup.

**10) Known limitations / incomplete features**
- Dual deployment complexity: The repo contains both `frontend` Next.js app and a separate `backend` Express app. The Next.js app includes proxy routes to either use its own handler or forward to `backend/` depending on `API_URL`. This needs careful deployment configuration (see `frontend/app/api/[...path]/route.js`).
- Partial duplicate logic: Resume parsing and match logic is present in both frontend API routes (Next.js server routes) and backend services (Express + `groqService.js`) which can be confusing and duplicated maintenance.
- Tests: There are tests under `backend/__tests__` and `frontend/__tests__` but running them may require environment configuration (keys). Some tests may be flaky if Groq keys are missing.
- Robustness of parsing: The Groq model is expected to return strict JSON but the code contains many fallback and heuristics because models sometimes return non-JSON wrappers — parsing may still fail for noisy resumes. See `parseModelJsonOrFallback` in `backend/services/groqService.js` and `parseJsonResponse` in `frontend/app/api/resume/analyze/route.js`.
- Security: `frontend` route saves to Supabase using a service key; by default on Vercel this is safe but must not be exposed in browser builds. Ensure env var usage is server-side only.
- Rate limiting: Basic rate-limiting exists but may need strengthening for production, particularly batch endpoints that can send many LLM calls.
- No background job queue: Batch processing is synchronous in the frontend; large batches may time out or be slow without job queues or serverless background workers.

**11) 15 Technical interview questions and answers (based on code)**
1. Q: Where is JWT signed and what file enforces the secret? A: `backend/controllers/authController.js` generates JWTs with `jwt.sign(...)` and `backend/middleware/auth.js` calls `jwt.verify(...)`. Both use `JWT_SECRET` env var.

2. Q: How does the app handle missing Supabase credentials in development? A: `backend/services/supabaseClient.js` falls back to an in-memory client (`createMemoryClient`) that mimics `.from(table).select()` behavior so the app works without Supabase.

3. Q: Which files are responsible for extracting text from uploaded PDFs and DOCX files? A: `backend/services/resumeParser.js` uses `pdf-parse` and `mammoth`; `frontend/app/api/resume/analyze/route.js` uses `pdf2json` and `mammoth`/`extractDocxText`.

4. Q: How does the project call the LLM and which function centralizes that call? A: The Groq client wrapper `frontend/src/lib/groqClient.js` defines `analyzeWithGroq(prompt)` which uses `groq-sdk` to call `chat.completions.create`. Back-end also uses this directly in `backend/services/groqService.js` via `new Groq({ apiKey })`.

5. Q: Where is resume analysis saved to the database and which function performs it? A: `backend/services/db.saveAnalysis(userId, resumeData, rawText)` inserts rows into `analyses` table; `backend/routes/analyze.js` calls this after parsing.

6. Q: How does the app protect routes that require authentication? A: `backend/middleware/auth.js` extracts `Authorization: Bearer <token>`, verifies with `jwt.verify(token, JWT_SECRET)`, and sets `req.user` for handlers.

7. Q: Which file implements batch resume uploads and CSV export? A: `frontend/app/batch/page.jsx` presents the UI and uses `frontend/src/lib/batch-history.js` helpers to build CSV and manage runs; backend `backend/routes/batch.js` supports server-side batch endpoints.

8. Q: If Groq returns non-JSON text, how does the code recover? A: There are multiple parsing helpers: `parseModelJsonOrFallback` (backend) tries to extract JSON blocks and falls back to heuristics (`buildFallbackResumeData`) to produce structured outputs.

9. Q: What rate-limiting mechanism is used for resume analysis? A: `frontend/src/lib/rate-limit.js` is used by `frontend/app/api/resume/analyze/route.js` to block excessive calls; it returns limited status and Retry-After header.

10. Q: Where is the LLM prompt for matching defined? A: `frontend/app/api/analyze/match/route.js` builds the match prompt in `buildMatchPrompt({ resumeSnapshot, jobTitle, jobDescription })` and sends it to Groq via `getGroqMatchResult`.

11. Q: How are passwords stored and verified? A: Passwords are hashed with `bcryptjs.hash(password, 12)` on signup (`authController.signup`) and verified with `bcrypt.compare` on login.

12. Q: What tables does the backend expect in Supabase? A: The code references `users`, `analyses`, `job_matches`, and `batch_runs` (see `backend/services/db.js` and `backend/controllers/authController.js`). Schema exists in `backend/supabase-schema.sql`.

13. Q: How does the frontend decide whether to call the local Next.js route or proxy to `backend/`? A: `frontend/app/api/[...path]/route.js` checks `localRoutes` list and returns `NextResponse.next()` for local routes; otherwise it forwards to `API_URL`.

14. Q: Which env var enables seeding demo data, and where is it used? A: `SMART_HIRE_SEED_DEMO` in `backend/server.js` — when set to `'1'` it calls `seedDemoDataIfEmpty('demo-user')`.

15. Q: How are AI fallback heuristics implemented when the `GROQ_API_KEY` is missing? A: Both `frontend/app/api/resume/analyze/route.js` and `backend/services/groqService.js` implement deterministic fallback functions (`extractFallbackProfile`, `buildFallbackResumeData`, `buildFallbackMatchResult`) that use regex and token lists to extract skills and construct conservative match results.

--

If you want, I can now:
- run project tests, or
- commit and push this file to the remote repository.

File created: PROJECT_EXPLANATION.md

