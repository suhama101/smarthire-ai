'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { clearAuthSession, readStoredAuth } from '../src/lib/auth-session';

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

function getInitials(name) {
  const text = String(name || '').trim();
  if (!text) {
    return 'SH';
  }

  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export default function HomePage() {
  const apiUrl = '/api';
  const [health, setHealth] = useState('Checking API...');
  const [workspaceMode, setWorkspaceMode] = useState('candidate');
  const [authToken, setAuthToken] = useState('');
  const [authUser, setAuthUser] = useState(null);
  const [authProfile, setAuthProfile] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authStatus, setAuthStatus] = useState('');
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
  const [recruiterDecision, setRecruiterDecision] = useState('review');

  useEffect(() => {
    const stored = readStoredAuth();

    if (stored?.token) {
      setAuthToken(stored.token);
      setAuthUser(stored.user || null);
      setAuthStatus('Session restored from local storage.');
    }
  }, []);

  useEffect(() => {
    const detectedRole = authProfile?.role || authUser?.role;

    if (detectedRole === 'recruiter') {
      setWorkspaceMode('recruiter');
      return;
    }

    if (detectedRole === 'candidate') {
      setWorkspaceMode('candidate');
    }
  }, [authProfile?.role, authUser?.role]);

  useEffect(() => {
    let mounted = true;

    axios
      .get(`${apiUrl}/health`)
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
        setHealth('API is not reachable. Verify the backend proxy target on the server.');
      });

    return () => {
      mounted = false;
    };
  }, [apiUrl]);

  useEffect(() => {
    if (!authToken) {
      return;
    }

    let mounted = true;

    axios
      .get(`${apiUrl}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      })
      .then((response) => {
        if (!mounted) {
          return;
        }

        setAuthProfile(response.data);
        setAuthUser(response.data);
        setAuthError('');
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }

        const message = error?.response?.data?.error || error?.message || 'Unable to load profile.';
        setAuthError(message);
        setAuthStatus('Authentication token could not be verified.');
      });

    return () => {
      mounted = false;
    };
  }, [apiUrl, authToken]);

  async function refreshAuthProfile() {
    if (!authToken) {
      setAuthStatus('Sign in first to refresh the profile.');
      return;
    }

    setAuthBusy(true);
    setAuthStatus('Refreshing profile...');

    try {
      const response = await axios.get(`${apiUrl}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      setAuthProfile(response.data);
      setAuthUser(response.data);
      setAuthStatus('Profile refreshed.');
      setAuthError('');
    } catch (error) {
      const message = error?.response?.data?.error || error?.message || 'Unable to refresh profile.';
      setAuthError(message);
      setAuthStatus('Profile refresh failed.');
    } finally {
      setAuthBusy(false);
    }
  }

  function resetWorkspace() {
    setFile(null);
    setAnalysisError('');
    setAnalysisResult(null);
    setJobTitle('');
    setCompanyName('');
    setJobDescription('');
    setMatchError('');
    setMatchResult(null);
    setTargetRole('');
    setShowLearningForm(false);
    setLearningPlanError('');
    setLearningPlanResult(null);
    setAuthStatus('Workspace reset.');
    setRecruiterDecision('review');
  }

  async function handleUpload(event) {
    event.preventDefault();

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

      const response = await axios.post(`${apiUrl}/analyze/resume`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
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
      const response = await axios.post(`${apiUrl}/analyze/match`, {
        analysisId,
        jobTitle,
        companyName,
        jobDescription,
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
      const response = await axios.post(`${apiUrl}/analyze/learning-plan`, {
        missingSkills: matchResult.missingSkills,
        targetRole: targetRole.trim(),
        yearsExperience: analysisResult?.resumeData?.yearsExperience || 1,
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
  const topSkills = skills.slice(0, 6);
  const matchedSkills = (matchResult?.matchedSkills || []).slice(0, 6);
  const missingSkills = (matchResult?.missingSkills || []).slice(0, 6);
  const recruiterDecisionLabel =
    recruiterDecision === 'shortlist' ? 'Shortlisted' : recruiterDecision === 'reject' ? 'Rejected' : 'In review';
  const displayName = authProfile?.full_name || authUser?.full_name || 'Guest';
  const displayEmail = authProfile?.email || authUser?.email || '';
  const displayRole = authProfile?.role || authUser?.role || 'candidate';
  const profileInitials = getInitials(displayName);
  const workspaceTitle = workspaceMode === 'recruiter' ? 'Recruiter Console' : 'Candidate Workspace';
  const workspaceTagline = workspaceMode === 'recruiter'
    ? 'Talent sourcing, screening, and role calibration in a single control surface.'
    : 'Personalized resume analysis, fit scoring, and skill growth planning.';
  const resumePanelTitle = workspaceMode === 'recruiter' ? 'Talent Intake' : 'Resume Upload';
  const resumePanelDescription = workspaceMode === 'recruiter'
    ? 'Ingest candidate profiles and analyze them against the target role.'
    : 'Upload a PDF, DOCX, TXT, or MD file to extract structured profile data.';
  const matchPanelTitle = workspaceMode === 'recruiter' ? 'Role Calibration' : 'Job Matching';
  const matchPanelDescription = workspaceMode === 'recruiter'
    ? 'Compare candidate capability against the role requirements.'
    : 'Compare candidate profile against the target role requirements.';
  const learningPanelTitle = workspaceMode === 'recruiter' ? 'Upskilling Roadmap' : 'Learning Plan';
  const learningPanelDescription = workspaceMode === 'recruiter'
    ? 'Generate a development roadmap for identified skill gaps.'
    : 'Build a practical roadmap based on identified missing skills.';
  const headlineMetrics = [
    {
      label: 'Session',
      value: authToken ? 'Live' : 'Idle',
      detail: authToken ? 'Authenticated workspace' : 'Awaiting sign in',
    },
    {
      label: 'Analysis',
      value: analysisResult ? 'Ready' : 'Pending',
      detail: analysisResult ? `${skills.length} skills extracted` : 'Upload a resume to begin',
    },
    {
      label: 'Match Score',
      value: matchResult ? `${overallScore}%` : '--',
      detail: matchResult ? `${matchedCount} matched · ${missingCount} missing` : 'Job comparison pending',
    },
    {
      label: 'Learning Plan',
      value: learningPlanResult ? 'Ready' : 'Pending',
      detail: learningPlanResult ? `Timeline ${learningPlanResult.timelineWeeks} weeks` : 'Generated after gap review',
    },
  ];

  return (
    <main className="space-y-4">
        <header className="rounded-3xl border border-slate-200 bg-white/90 px-5 py-5 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur md:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">SmartHire AI</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">Talent Operations Console</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">{workspaceTitle}</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-4xl">AI-Powered Hiring Intelligence</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-base">{workspaceTagline}</p>
            </div>
            <div className="flex flex-col gap-3 lg:min-w-[420px]">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-medium text-slate-700">API URL</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{apiUrl}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="font-medium text-slate-700">System Health</p>
                  <p className="mt-1 text-xs text-slate-500">{health}</p>
                </div>
              </div>
              {authToken ? (
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-white shadow-sm">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Signed in</p>
                    <p className="mt-1 text-sm font-medium">{displayName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearAuthSession}
                    className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
                  >
                    Log out
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Session</p>
                  <p className="mt-1 text-sm text-slate-600">Use the authentication panel below to unlock the profile view and persist your session.</p>
                </div>
              )}
            </div>
          </div>
        </header>

        <section id="access-layer" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Command Center</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">Executive Actions</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  Refresh the profile, clear the workspace, or continue moving through the hiring pipeline without leaving the dashboard.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('candidate')}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${workspaceMode === 'candidate' ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  Candidate view
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('recruiter')}
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${workspaceMode === 'recruiter' ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  Recruiter view
                </button>
                <button
                  type="button"
                  onClick={refreshAuthProfile}
                  disabled={authBusy}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authBusy ? 'Refreshing...' : 'Refresh profile'}
                </button>
                <button
                  type="button"
                  onClick={resetWorkspace}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Reset workspace
                </button>
                {authToken ? (
                  <button
                    type="button"
                    onClick={clearAuthSession}
                    className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
                  >
                    Log out
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Session</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{authToken ? 'Authenticated' : 'Not signed in'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Pipeline</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {workspaceMode === 'recruiter'
                    ? analysisResult
                      ? 'Candidate intake complete'
                      : 'Waiting for candidate intake'
                    : analysisResult
                      ? 'Resume analyzed'
                      : 'Waiting for upload'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Workspace</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {workspaceMode === 'recruiter'
                    ? matchResult
                      ? 'Role calibration ready'
                      : 'No active role match'
                    : matchResult
                      ? 'Match available'
                      : 'No active match'}
                </p>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status Board</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Profile</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{displayName}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Role</p>
                <p className="mt-1 text-sm font-semibold capitalize text-slate-900">{displayRole}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Health</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Backend ready</p>
              </div>
            </div>
          </aside>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(79,70,229,0.16),rgba(15,15,19,0.92))] p-6 shadow-[0_30px_100px_-50px_rgba(79,70,229,0.5)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8B8B9E]">Account Access</p>
              <h2 className="text-2xl font-semibold tracking-tight text-[#F1F1F3]">Login and signup now live on dedicated pages</h2>
              <p className="max-w-2xl text-sm leading-6 text-[#8B8B9E]">
                Use the new routes for authentication, then return here with your session restored from the shared browser state.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-[10px] bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-medium text-white transition duration-200 ease-in-out hover:from-indigo-500 hover:to-violet-500"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="rounded-[10px] border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-[#F1F1F3] transition duration-200 ease-in-out hover:border-indigo-500/40 hover:bg-white/10"
              >
                Signup
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {headlineMetrics.map((metric) => (
            <article
              key={metric.label}
              className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{metric.value}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{metric.detail}</p>
            </article>
          ))}
        </section>

        {workspaceMode === 'recruiter' ? (
          <section id="job-matching" className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recruiter Shortlist</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">Candidate evaluation snapshot</h2>
                  <p className="mt-1 max-w-2xl text-sm text-slate-500">
                    Use this view to quickly assess fit, surfaced strengths, and the clearest gaps before moving a profile forward.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Overall fit</p>
                  <p className={`mt-1 text-3xl font-semibold ${matchResult ? scoreStyles.text : 'text-slate-900'}`}>{matchResult ? `${overallScore}%` : '--'}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Match quality</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{matchResult ? scoreStyles.label : 'Awaiting match'}</p>
                  <p className="mt-1 text-xs text-slate-500">{matchedCount} aligned skills identified</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Risk watch</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{missingCount ? `${missingCount} visible gaps` : 'Low immediate risk'}</p>
                  <p className="mt-1 text-xs text-slate-500">Gaps are surfaced from the current job description</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Next action</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{matchResult ? 'Review shortlist decision' : 'Upload candidate and compare'}</p>
                  <p className="mt-1 text-xs text-slate-500">Move to interview only when signals align</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">Top skills</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(topSkills.length ? topSkills : ['No skills extracted yet']).map((skill) => (
                      <span key={skill} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">Key gaps</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(missingSkills.length ? missingSkills : ['No major gaps detected']).map((skill) => (
                      <span key={skill} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Shortlist queue</p>
                    <p className="text-xs text-slate-500">A single current candidate row with recruiter-ready status.</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${scoreStyles.badge}`}>{scoreStyles.label}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Candidate</th>
                        <th className="px-4 py-3 font-semibold">Fit</th>
                        <th className="px-4 py-3 font-semibold">Strengths</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      <tr>
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-900">{displayName}</div>
                          <div className="mt-1 text-xs text-slate-500">{displayEmail || 'Candidate profile pending'}</div>
                        </td>
                        <td className={`px-4 py-4 text-base font-semibold ${matchResult ? scoreStyles.text : 'text-slate-900'}`}>
                          {matchResult ? `${overallScore}%` : '--'}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {matchedSkills.length ? matchedSkills.slice(0, 3).join(' · ') : 'Awaiting analysis'}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${recruiterDecision === 'shortlist' ? 'bg-emerald-50 text-emerald-700' : recruiterDecision === 'reject' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                            {recruiterDecisionLabel}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setRecruiterDecision('shortlist')}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
                            >
                              Shortlist
                            </button>
                            <button
                              type="button"
                              onClick={() => setRecruiterDecision('review')}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Review
                            </button>
                            <button
                              type="button"
                              onClick={() => setRecruiterDecision('reject')}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">Decision note</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {matchResult?.recommendation || 'Run a job match to see an evidence-based recommendation for progression.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRecruiterDecision('shortlist')}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${recruiterDecision === 'shortlist' ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    Shortlist
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecruiterDecision('review')}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${recruiterDecision === 'review' ? 'bg-amber-500 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    Review
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecruiterDecision('reject')}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${recruiterDecision === 'reject' ? 'bg-rose-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    Reject
                  </button>
                </div>
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Current decision: <span className="text-slate-900">{recruiterDecision}</span>
                </p>
              </div>
            </article>

            <aside className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Screening Priorities</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">1. Alignment</p>
                  <p className="mt-1 text-sm text-slate-700">Assess the overlap between extracted skills and job requirements.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">2. Readiness</p>
                  <p className="mt-1 text-sm text-slate-700">Check whether the candidate is ready for the role or needs development.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">3. Action</p>
                  <p className="mt-1 text-sm text-slate-700">Move strong matches to interview or generate a targeted upskilling plan.</p>
                </div>
              </div>
            </aside>
          </section>
        ) : (
          <section id="job-matching" className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Career Roadmap</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Your next three steps</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                This view is designed to help candidates move from resume upload to a practical growth plan with minimal friction.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Step 1</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">Upload resume</p>
                  <p className="mt-1 text-xs text-slate-500">Extract structured profile data and surface your strongest signals.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Step 2</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">Compare target role</p>
                  <p className="mt-1 text-xs text-slate-500">Score fit against a specific job description and reveal the gap set.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Step 3</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">Generate learning plan</p>
                  <p className="mt-1 text-xs text-slate-500">Turn gaps into a practical roadmap with resources and project ideas.</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-800">What you already have</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(topSkills.length ? topSkills : ['Upload a resume to reveal your skills']).map((skill) => (
                    <span key={skill} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </article>

            <aside className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Focus Areas</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Strengths</p>
                  <p className="mt-1 text-sm text-slate-700">{analysisResult ? 'Your extracted skills and summary are ready.' : 'Upload a resume to surface your strengths.'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Gaps</p>
                  <p className="mt-1 text-sm text-slate-700">{matchResult ? `${missingCount} focus areas identified from the target role.` : 'Run a job match to see what to improve.'}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Action</p>
                  <p className="mt-1 text-sm text-slate-700">{learningPlanResult ? 'Follow the generated roadmap and update your resume.' : 'Generate a learning plan after the match step.'}</p>
                </div>
              </div>
            </aside>
          </section>
        )}

        <section id="learning-plan" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                <h2 className="text-base font-semibold text-slate-900">{resumePanelTitle}</h2>
                <p className="text-sm text-slate-500">{resumePanelDescription}</p>
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
                <h2 className="text-base font-semibold text-slate-900">{matchPanelTitle}</h2>
                <p className="text-sm text-slate-500">{matchPanelDescription}</p>
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
                <h2 className="text-base font-semibold text-slate-900">{learningPanelTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">{learningPanelDescription}</p>
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
    </main>
  );
}