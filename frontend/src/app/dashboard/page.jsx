'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart3, CalendarDays, Download, FolderPlus, History, Layers3, Trophy } from 'lucide-react';
import { readStoredAuth } from '../../lib/auth-session';
import {
  buildBatchFilename,
  buildRunResultsCsv,
  buildBatchName,
  computeBatchStats,
  formatBatchDate,
  getAverageScore,
  getTopCandidate,
  getTopSkillGap,
  readBatchRuns,
} from '../../lib/batch-history';
import CandidateWorkbench from './components/CandidateWorkbench';

function resolveRole(session) {
  const role = String(session?.user?.role || session?.user?.user_role || session?.user?.account_type || session?.role || '').toLowerCase();

  if (role === 'recruiter') {
    return 'recruiter';
  }

  if (role === 'candidate') {
    return 'candidate';
  }

  return 'guest';
}

function formatPercent(value) {
  return `${Math.round(Number(value) || 0)}%`;
}

function scoreTone(score) {
  if (score >= 80) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (score >= 60) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-rose-200 bg-rose-50 text-rose-700';
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState('guest');
  const [runs, setRuns] = useState([]);

  useEffect(() => {
    const stored = readStoredAuth();

    if (!stored?.token) {
      router.replace('/login');
      return;
    }

    setIsAuthenticated(true);
    setRole(resolveRole(stored));
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    function syncRuns() {
      setRuns(readBatchRuns());
    }

    syncRuns();
    window.addEventListener('smarthire-batch-history-changed', syncRuns);
    window.addEventListener('storage', syncRuns);

    return () => {
      window.removeEventListener('smarthire-batch-history-changed', syncRuns);
      window.removeEventListener('storage', syncRuns);
    };
  }, [isAuthenticated]);

  const stats = useMemo(() => computeBatchStats(runs), [runs]);
  const recentRuns = useMemo(() => runs.slice(0, 5), [runs]);
  const lastRun = runs[0] || null;
  const todayLabel = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());

  function handleDownloadLastReport() {
    if (!lastRun) {
      return;
    }

    downloadCsv(buildBatchFilename(lastRun), buildRunResultsCsv(lastRun));
  }

  if (!isAuthenticated) {
    return (
      <div className="px-4 py-8 md:px-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm">
          <p className="text-sm font-medium text-[#8B8B9E]">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  if (role === 'candidate') {
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <section className="rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B8B9E]">Candidate Workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#F1F1F3] sm:text-4xl">Your resume analysis and learning plan hub</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8B8B9E]">
              Analyze a resume, match it to a target role, and generate an improvement plan without the recruiter-only batch controls.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/history" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F0F13] px-4 py-2.5 text-sm font-semibold text-[#F1F1F3] transition hover:bg-white/5">
                <History className="h-4 w-4" />
                Review My History
              </Link>
              <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90">
                Back to Home
              </Link>
            </div>
          </section>

          <CandidateWorkbench />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B8B9E]">Recruiter Dashboard</p>
              <h1 className="text-3xl font-semibold tracking-tight text-[#F1F1F3] sm:text-4xl">Batch hiring command center</h1>
              <p className="max-w-3xl text-sm leading-6 text-[#8B8B9E]">
                Monitor recruiter batch runs, review candidate throughput, and move straight back into processing.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8B8B9E]">Today</p>
              <p className="mt-1 text-sm font-medium text-[#F1F1F3]">{todayLabel}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-4">
          <article className="rounded-3xl border border-white/10 bg-[#1A1A24] p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                <Layers3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-3xl font-semibold tracking-tight text-[#F1F1F3]">{stats.totalResumes}</p>
                <p className="mt-2 text-sm font-medium text-[#F1F1F3]">Total Resumes Processed</p>
                <p className="mt-1 text-sm text-[#8B8B9E]">Across all saved recruiter batches</p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-[#1A1A24] p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <p className="text-3xl font-semibold tracking-tight text-[#F1F1F3]">{formatPercent(stats.averageScore)}</p>
                <p className="mt-2 text-sm font-medium text-[#F1F1F3]">Average Match Score</p>
                <p className="mt-1 text-sm text-[#8B8B9E]">Weighted across all processed resumes</p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-[#1A1A24] p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-3xl font-semibold tracking-tight text-[#F1F1F3]">{stats.topSkillGap || '--'}</p>
                <p className="mt-2 text-sm font-medium text-[#F1F1F3]">Top Skill Gap Across All Candidates</p>
                <p className="mt-1 text-sm text-[#8B8B9E]">Most common missing skill in the current history</p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-white/10 bg-[#1A1A24] p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-3xl font-semibold tracking-tight text-[#F1F1F3]">{stats.resumesToday}</p>
                <p className="mt-2 text-sm font-medium text-[#F1F1F3]">Resumes Processed Today</p>
                <p className="mt-1 text-sm text-[#8B8B9E]">Based on saved batch runs in the current session</p>
              </div>
            </div>
          </article>
        </section>

        <section className="flex flex-wrap gap-3 rounded-3xl border border-white/10 bg-[#1A1A24] p-4 shadow-sm">
          <Link href="/batch" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90">
            <FolderPlus className="h-4 w-4" />
            New Batch Upload
          </Link>
          <Link href="/history" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F0F13] px-4 py-2.5 text-sm font-semibold text-[#F1F1F3] transition hover:bg-white/5">
            <History className="h-4 w-4" />
            View Full History
          </Link>
          <button
            type="button"
            onClick={handleDownloadLastReport}
            disabled={!lastRun}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0F0F13] px-4 py-2.5 text-sm font-semibold text-[#F1F1F3] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download Last Report
          </button>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8B9E]">Recent Batches</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#F1F1F3]">Recent batch runs</h2>
            </div>
            <p className="text-sm text-[#8B8B9E]">Showing the latest 5 recruiter batch runs</p>
          </div>

          {recentRuns.length ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead className="bg-[#0F0F13] text-xs uppercase tracking-[0.16em] text-[#8B8B9E]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Batch Name</th>
                      <th className="px-4 py-3 font-semibold">Job Title</th>
                      <th className="px-4 py-3 font-semibold">Total Resumes</th>
                      <th className="px-4 py-3 font-semibold">Average Score</th>
                      <th className="px-4 py-3 font-semibold">Top Candidate</th>
                      <th className="px-4 py-3 font-semibold">Date Run</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-[#1A1A24]">
                    {recentRuns.map((run) => (
                      <tr key={run.id} className="transition hover:bg-white/5">
                        <td className="px-4 py-4 font-medium text-[#F1F1F3]">{buildBatchName(run)}</td>
                        <td className="px-4 py-4 text-[#8B8B9E]">{run.jobTitle || '--'}</td>
                        <td className="px-4 py-4 text-[#F1F1F3]">{run.totalResumes ?? run.results?.length ?? 0}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${scoreTone(getAverageScore(run))}`}>
                            {formatPercent(getAverageScore(run))}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-[#F1F1F3]">{getTopCandidate(run)}</td>
                        <td className="px-4 py-4 text-[#8B8B9E]">{formatBatchDate(run.createdAt)}</td>
                        <td className="px-4 py-4">
                          <Link href={`/history#${run.id}`} className="inline-flex rounded-lg border border-white/10 bg-[#0F0F13] px-3 py-2 text-xs font-semibold text-[#F1F1F3] transition hover:bg-white/5">
                            View Results
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-[#0F0F13] p-8 text-center">
              <p className="text-lg font-semibold text-[#F1F1F3]">No batches run yet. Go to Batch Upload to get started.</p>
              <p className="mt-2 text-sm text-[#8B8B9E]">Your last five recruiter runs will appear here once you process resumes.</p>
              <div className="mt-5 flex justify-center">
                <Link href="/batch" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90">
                  Start your first batch
                </Link>
              </div>
            </div>
          )}
        </section>

        <CandidateWorkbench />
      </div>
    </div>
  );
}
