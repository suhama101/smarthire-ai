'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { ArrowRight, BarChart3, Brain, CheckCircle2, Compass, FileUp, ShieldCheck, Sparkles, Users, Wifi, WifiOff } from 'lucide-react';
import AuthenticatedShell from './components/authenticated-shell';
import { readStoredAuth } from '../src/lib/auth-session';
import { extractPdfTextFromFile, getFriendlyApiError, validateResumeFile } from '../src/lib/input-utils';

const FEATURE_CARDS = [
  {
    icon: Sparkles,
    title: 'AI-assisted screening',
    description: 'Turn resumes into structured candidate profiles, match them against roles, and keep the decision trail visible.',
  },
  {
    icon: BarChart3,
    title: 'Recruiter-ready metrics',
    description: 'Track batch performance, average fit scores, and top candidates without exporting to spreadsheets first.',
  },
  {
    icon: Brain,
    title: 'Learning plans that explain the gap',
    description: 'Show skill gaps, generate a roadmap, and give candidates a clear path from screening to shortlisting.',
  },
  {
    icon: ShieldCheck,
    title: 'Session-based history',
    description: 'Keep analyses and batch runs together in one local archive for the current session with no backend dependency.',
  },
];

const STEPS = [
  {
    title: 'Analyze',
    text: 'Upload a resume in the dashboard workbench and extract a structured profile in seconds.',
  },
  {
    title: 'Match',
    text: 'Compare the profile against a role description to surface fit, gaps, and hiring recommendations.',
  },
  {
    title: 'Act',
    text: 'Review learning plans, export summaries, and keep a searchable session history for future reviews.',
  },
];

const TRUST_POINTS = [
  'Local history storage',
  'Recruiter batch workflows',
  'Candidate screening in one session',
  'Vercel-ready API routes',
];

export default function LandingPage() {
  const resumeInputRef = useRef(null);
  const [session, setSession] = useState(null);
  const [healthState, setHealthState] = useState({ status: 'checking', label: 'Checking API...' });
  const [selectedResume, setSelectedResume] = useState(null);
  const [resumeAnalysis, setResumeAnalysis] = useState(null);
  const [resumeError, setResumeError] = useState('');
  const [isAnalyzingResume, setIsAnalyzingResume] = useState(false);

  useEffect(() => {
    setSession(readStoredAuth());
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    async function checkHealth() {
      try {
        const response = await fetch('/api/health', {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}`);
        }

        await response.json();
        setHealthState({ status: 'online', label: 'Online' });
      } catch {
        setHealthState({ status: 'offline', label: 'Offline' });
      } finally {
        window.clearTimeout(timeout);
      }
    }

    checkHealth();

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  function handleResumeDrop(files) {
    const file = files?.[0] || null;

    setResumeError('');
    setResumeAnalysis(null);

    if (!file) {
      setSelectedResume(null);
      return;
    }

    const validation = validateResumeFile(file);

    if (!validation.valid) {
      setSelectedResume(null);
      setResumeError(validation.message);
      return;
    }

    setSelectedResume(file);
  }

  async function analyzeHomepageResume() {
    const validation = validateResumeFile(selectedResume);

    if (!validation.valid) {
      setResumeError(validation.message);
      return;
    }

    setIsAnalyzingResume(true);
    setResumeError('');
    setResumeAnalysis(null);

    try {
      const formData = new FormData();
      formData.append('resume', selectedResume);

      if (String(selectedResume?.type || '').toLowerCase() === 'application/pdf' || String(selectedResume?.name || '').toLowerCase().endsWith('.pdf')) {
        const pdfText = await extractPdfTextFromFile(selectedResume);

        if (pdfText) {
          formData.append('resumeText', pdfText);
        }
      }

      const response = await axios.post('/api/resume/analyze', formData, { timeout: 120000 });
      setResumeAnalysis(response.data?.resumeData || null);
    } catch (error) {
      setResumeError(getFriendlyApiError(error, 'Resume analysis failed.'));
    } finally {
      setIsAnalyzingResume(false);
    }
  }

  return (
    <AuthenticatedShell>
      <div className="min-h-screen bg-[#0B0B10] text-[#F1F1F3]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          {session ? (
            <div className="mb-6 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">Welcome back, {session.user?.name || session.user?.email || 'there'}.</p>
                  <p className="mt-1 text-emerald-100/80">Your dashboard is ready. Jump back into the workbench or review the latest batch history.</p>
                </div>
                <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#0B0B10] transition hover:bg-white/90">
                  Go to dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : null}

          <section className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.14),_transparent_35%),linear-gradient(135deg,_#12121A_0%,_#0B0B10_55%,_#171725_100%)] px-6 py-14 shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:px-10 lg:px-14 lg:py-20">
            <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8B8B9E]">
                  <Compass className="h-4 w-4 text-[#B5B8FF]" /> SmartHire AI
                </div>
                <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  Enterprise hiring intelligence for screening, matching, and batch review.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-[#B7B7C6]">
                  SmartHire AI combines resume analysis, job matching, learning plans, recruiter batch workflows, and a local session history so teams can move from intake to decision without losing context.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0B0B10] transition hover:bg-white/90">
                    Open dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/history" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                    Review history <Users className="h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-10 flex flex-wrap gap-3 text-sm text-[#B7B7C6]">
                  {TRUST_POINTS.map((point) => (
                    <span key={point} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      {point}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-[#111118]/80 p-6 backdrop-blur">
                <div className="rounded-3xl border border-white/10 bg-[#0B0B10] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8B8B9E]">What teams get</p>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">Candidate profile</p>
                      <p className="mt-1 text-sm text-[#B7B7C6]">Extracts experience, skills, and summary data from uploaded resumes.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">Role alignment</p>
                      <p className="mt-1 text-sm text-[#B7B7C6]">Scores fit against job descriptions and highlights actionable gaps.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm font-semibold text-white">Session archive</p>
                      <p className="mt-1 text-sm text-[#B7B7C6]">Stores analyses and recruiter batches locally for the current session.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <article className="rounded-[2rem] border border-white/10 bg-[#111118] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8B8B9E]">System Health</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Live API status</h2>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                    healthState.status === 'online'
                      ? 'border-emerald-300/30 bg-emerald-500/10 text-emerald-200'
                      : healthState.status === 'offline'
                        ? 'border-rose-300/30 bg-rose-500/10 text-rose-200'
                        : 'border-amber-300/30 bg-amber-500/10 text-amber-100'
                  }`}
                >
                  {healthState.status === 'online' ? <Wifi className="h-3.5 w-3.5" /> : healthState.status === 'offline' ? <WifiOff className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                  {healthState.label}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#B7B7C6]">
                This checks <span className="font-medium text-white">/api/health</span> directly from the browser, so the homepage reflects the deployed Vercel runtime instead of a cached placeholder.
              </p>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-[#B7B7C6]">
                {healthState.status === 'online'
                  ? 'The API is responding normally and production routes should be reachable.'
                  : healthState.status === 'offline'
                    ? 'The API did not respond in time. Check the deployment or route logs.'
                    : 'Waiting for the initial health response...'}
              </div>
            </article>

            <article className="rounded-[2rem] border border-white/10 bg-[#111118] p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <FileUp className="h-4 w-4 text-indigo-300" /> Quick Resume Upload
              </div>
              <p className="mt-2 text-sm text-[#8B8B9E]">Drag and drop a resume or choose one from your device. Accepted formats: PDF, DOCX, TXT, and MD.</p>

              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleResumeDrop(event.dataTransfer.files);
                }}
                className="mt-5 rounded-3xl border-2 border-dashed border-white/10 bg-[#0B0B10] p-6 text-center transition hover:border-white/25"
              >
                <input
                  ref={resumeInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  onChange={(event) => {
                    handleResumeDrop(event.target.files);
                    event.target.value = '';
                  }}
                />
                <FileUp className="mx-auto h-10 w-10 text-[#8B8B9E]" />
                <p className="mt-4 text-base font-semibold text-[#F1F1F3]">Drop resumes here or browse your files</p>
                <p className="mt-2 text-sm text-[#8B8B9E]">We only accept PDF, DOCX, TXT, and MD files.</p>
                <button
                  type="button"
                  onClick={() => resumeInputRef.current?.click()}
                  className="mt-5 inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0B0B10] transition hover:bg-white/90"
                >
                  Choose File
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">Selected file</p>
                <p className="mt-1 text-sm text-[#8B8B9E]">{selectedResume ? selectedResume.name : 'No file selected yet.'}</p>
              </div>

              {resumeError ? <p className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{resumeError}</p> : null}

              <button
                type="button"
                onClick={analyzeHomepageResume}
                disabled={!selectedResume || isAnalyzingResume}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0B0B10] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {isAnalyzingResume ? 'Analyzing...' : 'Analyze Resume'}
              </button>

              {resumeAnalysis ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-[#0B0B10] p-4">
                  <p className="text-sm font-semibold text-white">Extracted summary</p>
                  <p className="mt-2 text-sm text-[#B7B7C6]">{resumeAnalysis.summary || 'Summary unavailable.'}</p>
                  <p className="mt-3 text-sm text-[#B7B7C6]">{resumeAnalysis.email || 'No email extracted'}</p>
                </div>
              ) : null}
            </article>
          </section>

          <section id="features" className="mt-16">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8B8B9E]">Capabilities</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">Designed for hiring teams, not demo decks.</h2>
              </div>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {FEATURE_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <article key={card.title} className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 transition hover:-translate-y-1 hover:bg-white/8">
                    <Icon className="h-5 w-5 text-[#B5B8FF]" />
                    <h3 className="mt-5 text-lg font-semibold text-white">{card.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-[#B7B7C6]">{card.description}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="mt-16 grid gap-6 lg:grid-cols-3">
            {STEPS.map((step, index) => (
              <article key={step.title} className="rounded-[1.75rem] border border-white/10 bg-[#111118] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8B8B9E]">Step {index + 1}</p>
                <h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#B7B7C6]">{step.text}</p>
              </article>
            ))}
          </section>

          <section className="mt-16 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8B8B9E]">Enterprise</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">A cleaner front door for enterprise stakeholders.</h2>
              <p className="mt-4 text-sm leading-7 text-[#B7B7C6]">
                The homepage is now marketing-first, while the dashboard, batch upload, and history views stay available for active users. That keeps the product presentation sharp without hiding the actual workbench.
              </p>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-[#111118] p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8B8B9E]">Navigation</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'Dashboard', href: '/dashboard', text: 'Open the recruiter overview and candidate workbench.' },
                  { label: 'Batch Upload', href: '/batch', text: 'Process multiple resumes against one role at a time.' },
                  { label: 'History', href: '/history', text: 'Review analyses and batch runs stored for this session.' },
                  { label: 'Login', href: '/login', text: 'Sign in to access protected routes.' },
                ].map((link) => (
                  <Link key={link.label} href={link.href} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
                    <p className="text-sm font-semibold text-white">{link.label}</p>
                    <p className="mt-2 text-sm leading-6 text-[#B7B7C6]">{link.text}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </AuthenticatedShell>
  );
}
