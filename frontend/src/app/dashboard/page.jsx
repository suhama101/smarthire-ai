'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, FileText, RefreshCw, Target, Users } from 'lucide-react';
import axios from 'axios';
import { readStoredAuth } from '../../lib/auth-session';
import ScoreTrendChart from './components/ScoreTrendChart';
import SkillGapChart from './components/SkillGapChart';
import SkillsPieChart from './components/SkillsPieChart';

function normalizeMetricValue(value) {
  if (value === null || value === undefined || value === '') {
    return '--';
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : value.toFixed(1);
  }

  return value;
}

function normalizeSeries(series, labelKeys, valueKeys, valueLabel = 'score') {
  if (Array.isArray(series)) {
    return series.map((item, index) => {
      const label = labelKeys.map((key) => item?.[key]).find(Boolean) || `Item ${index + 1}`;
      const value = valueKeys.map((key) => item?.[key]).find((entry) => entry !== undefined && entry !== null);

      return {
        label: String(label),
        [valueLabel]: Number(value) || 0,
      };
    });
  }

  if (series && typeof series === 'object') {
    return Object.entries(series).map(([label, value]) => ({
      label: String(label),
      [valueLabel]: Number(value) || 0,
    }));
  }

  return [];
}

function normalizePieData(series) {
  if (Array.isArray(series)) {
    return series.map((item, index) => ({
      name: String(item?.name || item?.label || item?.skill || `Skill ${index + 1}`),
      value: Number(item?.value ?? item?.count ?? item?.total ?? 0) || 0,
    }));
  }

  if (series && typeof series === 'object') {
    return Object.entries(series).map(([name, value]) => ({
      name: String(name),
      value: Number(value) || 0,
    }));
  }

  return [];
}

function isZeroLikeMetric(value) {
  return value === '--' || Number(value) === 0;
}

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const stored = readStoredAuth();
    if (!stored?.token) {
      router.replace('/login');
      return;
    }

    setIsAuthenticated(true);
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isMounted = true;

    async function loadDashboardStats() {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const cleanedApiUrl = apiUrl.trim().replace(/\/$/, '');

      if (isMounted) {
        setLoading(true);
        setError('');
      }

      if (!cleanedApiUrl) {
        if (isMounted) {
          setError('NEXT_PUBLIC_API_URL is not configured.');
          setLoading(false);
        }
        return;
      }

      try {
        const response = await axios.get(`${cleanedApiUrl}/api/history/stats`);

        if (!isMounted) {
          return;
        }

        setStats(response.data);
        setError('');
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        const message = requestError?.response?.data?.error || requestError?.message || 'Failed to load dashboard stats.';
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardStats();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, refreshKey]);

  const summaryCards = useMemo(() => {
    if (!stats) {
      return [];
    }

    return [
      {
        label: 'Total resumes analyzed',
        value: normalizeMetricValue(stats.total_resumes_analyzed),
        detail: 'Resumes processed by SmartHire AI',
      },
      {
        label: 'Average match score',
        value: normalizeMetricValue(stats.average_match_score),
        detail: 'Average alignment across the dataset',
      },
      {
        label: 'Total job matches',
        value: normalizeMetricValue(stats.total_job_matches),
        detail: 'Candidate-to-role matches generated',
      },
      {
        label: 'Total skill gaps identified',
        value: normalizeMetricValue(stats.total_skill_gaps_identified),
        detail: 'Skill gaps surfaced in analysis',
      },
    ];
  }, [stats]);

  const trendData = useMemo(
    () => normalizeSeries(stats?.trend || stats?.match_score_trend, ['label', 'name', 'date', 'month', 'period'], ['score', 'value', 'match_score'], 'score'),
    [stats],
  );

  const skillGapData = useMemo(
    () => normalizeSeries(stats?.distribution || stats?.skill_gap_distribution, ['label', 'name', 'bucket', 'category'], ['count', 'value', 'total'], 'count'),
    [stats],
  );

  const pieData = useMemo(
    () => normalizePieData(stats?.top_skills_matched || stats?.top_skills || stats?.skills_matched),
    [stats],
  );

  const hasInsights = summaryCards.some((card) => !isZeroLikeMetric(card.value));
  const todayLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  function handleRefresh() {
    setRefreshKey((current) => current + 1);
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

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8B9E]">Analytics Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#F1F1F3] sm:text-4xl">Hiring Dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8B8B9E]">AI-powered resume intelligence</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8B8B9E]">Today</p>
                <p className="mt-1 text-sm font-medium text-[#F1F1F3]">{todayLabel}</p>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm font-semibold text-indigo-300 transition hover:border-indigo-400/50 hover:bg-indigo-500/15 hover:shadow-lg hover:shadow-indigo-500/10"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="rounded-3xl border border-white/10 bg-[#1A1A24] p-10 shadow-sm">
            <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-indigo-400" />
              <p className="text-sm font-medium text-[#F1F1F3]">Loading your hiring insights...</p>
            </div>
          </section>
        ) : error ? (
          <section className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-300" />
                <div>
                  <p className="text-sm font-semibold text-rose-200">Unable to load dashboard data</p>
                  <p className="mt-1 text-sm text-rose-200/80">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center justify-center rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20"
              >
                Retry
              </button>
            </div>
          </section>
        ) : !hasInsights ? (
          <section className="rounded-3xl border border-white/10 bg-[#1A1A24] p-8 shadow-sm">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#0F0F13] text-indigo-300 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[#F1F1F3]">No analysis data yet</h2>
                <p className="mt-2 text-sm leading-6 text-[#8B8B9E]">Upload your first resume to get started.</p>
              </div>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90"
              >
                Go to upload page
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-4 xl:grid-cols-4">
              {summaryCards.map((card, index) => {
                const cardMeta = [
                  { icon: FileText, accent: 'border-l-blue-500', iconTone: 'text-blue-300', iconBg: 'bg-blue-500/10' },
                  { icon: Target, accent: 'border-l-emerald-500', iconTone: 'text-emerald-300', iconBg: 'bg-emerald-500/10' },
                  { icon: Users, accent: 'border-l-violet-500', iconTone: 'text-violet-300', iconBg: 'bg-violet-500/10' },
                  { icon: AlertCircle, accent: 'border-l-orange-500', iconTone: 'text-orange-300', iconBg: 'bg-orange-500/10' },
                ][index];
                const Icon = cardMeta.icon;

                return (
                  <article
                    key={card.label}
                    className={`rounded-3xl border border-white/10 border-l-4 bg-[#1A1A24] p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(0,0,0,0.35)] ${cardMeta.accent}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${cardMeta.iconBg}`}>
                        <Icon className={`h-5 w-5 ${cardMeta.iconTone}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-3xl font-semibold tracking-tight text-[#F1F1F3]">{card.value}</p>
                        <p className="mt-2 text-sm font-medium text-[#F1F1F3]">{card.label}</p>
                        <p className="mt-1 text-sm leading-6 text-[#8B8B9E]">{card.detail}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-3xl border border-white/10 border-t-4 border-t-blue-500 bg-[#1A1A24] p-6 shadow-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8B8B9E]">Trend</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#F1F1F3]">Match score trend over time</h2>
                  <p className="mt-2 text-sm text-[#8B8B9E]">Track how match quality moves across recent analyses.</p>
                </div>
                <div className="mt-5">
                  <ScoreTrendChart data={trendData} />
                </div>
              </article>

              <article className="rounded-3xl border border-white/10 border-t-4 border-t-violet-500 bg-[#1A1A24] p-6 shadow-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8B8B9E]">Distribution</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#F1F1F3]">Skill gaps distribution</h2>
                  <p className="mt-2 text-sm text-[#8B8B9E]">See where candidates cluster by gap severity.</p>
                </div>
                <div className="mt-5">
                  <SkillGapChart data={skillGapData} />
                </div>
              </article>
            </section>

            <section className="rounded-3xl border border-white/10 border-t-4 border-t-indigo-500 bg-[#1A1A24] p-6 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8B8B9E]">Skills</p>
                <h2 className="mt-1 text-lg font-semibold text-[#F1F1F3]">Top Skills Matched</h2>
                <p className="mt-2 text-sm text-[#8B8B9E]">A quick view of the strongest capability signals across analyzed resumes.</p>
              </div>
              <div className="mt-5">
                <SkillsPieChart data={pieData} />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
