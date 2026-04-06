'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

function scoreTheme(score) {
  if (score >= 80) {
    return {
      track: 'bg-emerald-100',
      bar: 'bg-emerald-600',
      text: 'text-emerald-700',
      ring: 'ring-emerald-200',
      badge: 'bg-emerald-50 text-emerald-700',
      label: 'Excellent fit',
    };
  }

  if (score >= 60) {
    return {
      track: 'bg-amber-100',
      bar: 'bg-amber-500',
      text: 'text-amber-700',
      ring: 'ring-amber-200',
      badge: 'bg-amber-50 text-amber-700',
      label: 'Good potential',
    };
  }

  return {
    track: 'bg-rose-100',
    bar: 'bg-rose-500',
    text: 'text-rose-700',
    ring: 'ring-rose-200',
    badge: 'bg-rose-50 text-rose-700',
    label: 'Needs improvement',
  };
}

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export default function HomePage() {
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const apiUrl = rawApiUrl
    ? rawApiUrl.replace(/\/$/, '')
    : (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');
  const [health, setHealth] = useState('Checking API...');
  const [token, setToken] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');
  const [file, setFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);

  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  const [matchError, setMatchError] = useState('');
  const [matchResult, setMatchResult] = useState(null);

  const [targetRole, setTargetRole] = useState('');
  const [showLearningForm, setShowLearningForm] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [learningPlanError, setLearningPlanError] = useState('');
  const [learningPlanResult, setLearningPlanResult] = useState(null);

  function getAuthHeaders() {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('smarthire_jwt') : '';
    const activeToken = token || stored || '';
    return activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
  }

  useEffect(() => {
    let mounted = true;

    const storedToken = typeof window !== 'undefined' ? window.localStorage.getItem('smarthire_jwt') : '';
    if (storedToken) {
      setToken(storedToken);
    }

    axios
      .get(`${apiUrl}/api/health`)
      .then((data) => {
        if (!mounted) {
          return;
        }
        setHealth(`API healthy at ${new Date(data.data.timestamp).toLocaleTimeString()}`);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setHealth('API is not reachable. Ensure backend runs on port 5000.');
      });

    return () => {
      mounted = false;
    };
  }, [apiUrl]);

  async function handleLogin(event) {
    event.preventDefault();

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setAuthError('Email and password are required.');
      return;
    }

    setAuthError('');
    setIsLoggingIn(true);

    try {
      const response = await axios.post(`${apiUrl}/api/auth/login`, {
        email: loginEmail.trim(),
        password: loginPassword,
      });

      const nextToken = response?.data?.token || '';
      if (!nextToken) {
        throw new Error('Login response did not include a token.');
      }

      window.localStorage.setItem('smarthire_jwt', nextToken);
      setToken(nextToken);
      setLoginPassword('');
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Login failed.';
      setAuthError(message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleLogout() {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('smarthire_jwt');
    }
    setToken('');
    setAnalysisResult(null);
    setMatchResult(null);
    setLearningPlanResult(null);
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!token && typeof window !== 'undefined' && !window.localStorage.getItem('smarthire_jwt')) {
      setAnalysisError('Please login first.');
      return;
    }

    if (!file) {
      setAnalysisError('Please choose a resume file first.');
      return;
    }

    setAnalysisError('');
    setAnalysisResult(null);
    setMatchResult(null);
    setMatchError('');
    setLearningPlanResult(null);
    setLearningPlanError('');
    setShowLearningForm(false);
    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append('resume', file);

      const response = await axios.post(`${apiUrl}/api/analyze/resume`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getAuthHeaders(),
        },
        timeout: 120000,
      });

      setAnalysisResult(response.data);
    } catch (uploadErr) {
      const message =
        uploadErr?.response?.data?.error || uploadErr?.message || 'Failed to analyze resume.';
      setAnalysisError(message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleMatchJob(event) {
    event.preventDefault();

    if (!token && typeof window !== 'undefined' && !window.localStorage.getItem('smarthire_jwt')) {
      setMatchError('Please login first.');
      return;
    }

    const analysisId = analysisResult?.analysisId;
    if (!analysisId) {
      setMatchError('Analyze a resume first to get analysisId.');
      return;
    }

    if (!jobDescription.trim()) {
      setMatchError('Please enter a job description.');
      return;
    }

    setMatchError('');
    setMatchResult(null);
    setLearningPlanResult(null);
    setLearningPlanError('');
    setShowLearningForm(false);
    setIsMatching(true);

    try {
      const response = await axios.post(`${apiUrl}/api/analyze/match`, {
        analysisId,
        jobTitle,
        companyName,
        jobDescription,
      }, {
        headers: {
          ...getAuthHeaders(),
        },
      });

      setMatchResult(response.data?.matchResult || null);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to match job.';
      setMatchError(message);
    } finally {
      setIsMatching(false);
    }
  }

  async function handleGenerateLearningPlan(event) {
    event.preventDefault();

    if (!token && typeof window !== 'undefined' && !window.localStorage.getItem('smarthire_jwt')) {
      setLearningPlanError('Please login first.');
      return;
    }

    if (!matchResult?.missingSkills || matchResult.missingSkills.length === 0) {
      setLearningPlanError('No missing skills to create a learning plan.');
      return;
    }

    if (!targetRole.trim()) {
      setLearningPlanError('Please enter a target role.');
      return;
    }

    setLearningPlanError('');
    setLearningPlanResult(null);
    setIsGeneratingPlan(true);

    try {
      const response = await axios.post(`${apiUrl}/api/analyze/learning-plan`, {
        missingSkills: matchResult.missingSkills,
        targetRole: targetRole.trim(),
        yearsExperience: analysisResult?.resumeData?.yearsExperience || 1,
      }, {
        headers: {
          ...getAuthHeaders(),
        },
      });

      setLearningPlanResult(response.data?.learningPlan || null);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to generate learning plan.';
      setLearningPlanError(message);
    } finally {
      setIsGeneratingPlan(false);
    }
  }

  const summary = analysisResult?.resumeData?.summary;
  const skills = analysisResult?.resumeData?.technicalSkills || [];
  const overallScore = clampScore(matchResult?.overallScore);
  const scoreStyles = scoreTheme(overallScore);
  const missingCount = (matchResult?.missingSkills || []).length;
  const matchedCount = (matchResult?.matchedSkills || []).length;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 md:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm md:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">SmartHire AI</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">Executive Hiring Dashboard</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                Resume analysis, job-fit scoring, and learning actions in one compact workspace.
              </p>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:min-w-[420px]">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-medium text-slate-700">API URL</p>
                <p className="mt-1 break-all text-xs text-slate-500">{apiUrl}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-medium text-slate-700">System Health</p>
                <p className="mt-1 text-xs text-slate-500">{health}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Authentication</h2>
              <p className="mt-1 text-sm text-slate-500">Login to get a JWT and unlock protected analysis endpoints.</p>
            </div>
            {token ? (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Logout
              </button>
            ) : null}
          </div>

          {!token ? (
            <form onSubmit={handleLogin} className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
              <button
                type="submit"
                disabled={isLoggingIn}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingIn ? 'Logging in...' : 'Login'}
              </button>
              {authError ? (
                <p className="md:col-span-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{authError}</p>
              ) : null}
            </form>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Authenticated. JWT is stored in localStorage as <span className="font-mono">smarthire_jwt</span>.</p>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Resume Status</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{analysisResult ? 'Ready' : 'Pending'}</p>
            <p className="mt-1 text-xs text-slate-500">Profile extraction {analysisResult ? 'completed' : 'not started'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Match Score</p>
            <p className={`mt-2 text-2xl font-semibold ${matchResult ? scoreStyles.text : 'text-slate-900'}`}>{matchResult ? `${overallScore}%` : '--'}</p>
            <p className="mt-1 text-xs text-slate-500">Candidate-job alignment</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Skill Gaps</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{matchResult ? missingCount : '--'}</p>
            <p className="mt-1 text-xs text-slate-500">Missing critical competencies</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Learning Plan</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{learningPlanResult ? 'Ready' : 'Pending'}</p>
            <p className="mt-1 text-xs text-slate-500">Action roadmap for upskilling</p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <form onSubmit={handleUpload} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-900">Resume Upload</h2>
                <p className="text-sm text-slate-500">Upload a PDF, DOCX, TXT, or MD file to extract structured profile data.</p>
              </div>

              <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <input
                  className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Resume'}
                </button>
              </div>

              {analysisError ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{analysisError}</p> : null}
            </form>

            {analysisResult ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-base font-semibold text-slate-900">Analysis Summary</h2>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">ID: {analysisResult.analysisId}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{summary || 'No summary returned.'}</p>

                <div className="mt-5">
                  <p className="text-sm font-medium text-slate-700">Technical Skills</p>
                  {skills.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {skills.map((skill) => (
                        <span key={skill} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No technical skills returned.</p>
                  )}
                </div>
              </section>
            ) : null}

            <form onSubmit={handleMatchJob} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-900">Job Matching</h2>
                <p className="text-sm text-slate-500">Compare candidate profile against the target role requirements.</p>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Job title"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company name"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste complete job description"
                rows={8}
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />

              <button
                type="submit"
                disabled={isMatching}
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMatching ? 'Matching...' : 'Match Job'}
              </button>

              {matchError ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{matchError}</p> : null}
            </form>
          </div>

          <aside className="space-y-4 lg:col-span-2">
            {matchResult ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900">Match Score</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${scoreStyles.badge}`}>{scoreStyles.label}</span>
                </div>

                <div className={`mt-4 rounded-2xl bg-white p-4 ring-1 ${scoreStyles.ring}`}>
                  <div className="flex items-end justify-between">
                    <p className={`text-3xl font-semibold ${scoreStyles.text}`}>{overallScore}%</p>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Overall fit</p>
                  </div>
                  <div className={`mt-3 h-2.5 w-full overflow-hidden rounded-full ${scoreStyles.track}`}>
                    <div className={`h-full rounded-full ${scoreStyles.bar}`} style={{ width: `${overallScore}%` }} />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Matched</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{matchedCount}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Missing</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{missingCount}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Matched Skills</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(matchResult.matchedSkills || []).map((item) => (
                        <span key={item} className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-700">Missing Skills</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(matchResult.missingSkills || []).map((item) => (
                        <span key={item} className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-700">Strengths</p>
                    <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                      {(matchResult.strengths || []).map((item) => (
                        <li key={item} className="rounded-md bg-slate-50 px-2.5 py-1.5">{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-700">Gaps</p>
                    <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                      {(matchResult.gaps || []).map((item) => (
                        <li key={item} className="rounded-md bg-slate-50 px-2.5 py-1.5">{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  onClick={() => setShowLearningForm(!showLearningForm)}
                  className="mt-6 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {showLearningForm ? 'Hide Learning Plan Form' : 'Generate Learning Plan'}
                </button>
              </section>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Match Insights</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Run a job match to unlock visual score analytics, skills gap tracking, and tailored plan generation.
                </p>
              </section>
            )}
          </aside>
        </section>

        {matchResult && showLearningForm ? (
          <form onSubmit={handleGenerateLearningPlan} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Learning Plan Generator</h2>
                <p className="mt-1 text-sm text-slate-500">Build a practical roadmap based on identified missing skills.</p>
              </div>
              <button
                type="submit"
                disabled={isGeneratingPlan}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingPlan ? 'Generating...' : 'Generate Learning Plan'}
              </button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <label className="text-sm font-medium text-slate-700">Target Role</label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder={`e.g., ${jobTitle || 'Senior Software Engineer'}`}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Skill Gaps Used</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(matchResult.missingSkills || []).map((skill) => (
                    <span key={skill} className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {learningPlanError ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{learningPlanError}</p> : null}
          </form>
        ) : null}

        {learningPlanResult ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-base font-semibold text-slate-900">Learning Plan{targetRole ? `: ${targetRole}` : ''}</h2>
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Timeline: {learningPlanResult.timelineWeeks} weeks</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{learningPlanResult.estimatedImpact}</p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {(learningPlanResult.priorities || []).map((item, idx) => (
                <article key={`${item.skill}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-base font-semibold text-slate-900">{item.skill}</p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                      {item.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">Target completion: {item.weekToComplete} week(s)</p>
                  <p className="mt-3 text-sm text-slate-600">{item.whyImportant}</p>

                  <p className="mt-3 text-sm font-medium text-slate-700">Resources</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {(item.resources || []).map((res, ridx) => (
                      <li key={`${res}-${ridx}`} className="rounded-md bg-white px-2.5 py-1.5 ring-1 ring-slate-200">{res}</li>
                    ))}
                  </ul>

                  <p className="mt-3 text-sm font-medium text-slate-700">Project Idea</p>
                  <p className="mt-1 text-sm text-slate-600">{item.projectIdea}</p>
                </article>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Project Suggestions</p>
                <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                  {(learningPlanResult.projectSuggestions || []).map((proj, idx) => (
                    <li key={`${proj}-${idx}`} className="rounded-md bg-white px-2.5 py-1.5 ring-1 ring-slate-200">{proj}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Resume Tips</p>
                <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                  {(learningPlanResult.resumeTips || []).map((tip, idx) => (
                    <li key={`${tip}-${idx}`} className="rounded-md bg-white px-2.5 py-1.5 ring-1 ring-slate-200">{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}