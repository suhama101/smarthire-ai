'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import ScoreTrendChart from './components/ScoreTrendChart';
import SkillGapChart from './components/SkillGapChart';
import SkillsPieChart from './components/SkillsPieChart';

function readStoredAuth() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem('smarthire.auth');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

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

export default function DashboardPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = readStoredAuth();
    if (!stored?.token) {
      router.replace('/');
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
  }, [isAuthenticated]);

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

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 md:px-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-600">Redirecting to sign in...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-600">AI-powered hiring insights dashboard</p>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Analytics Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">SmartHire AI Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            View hiring analytics, score trends, skill gaps, and matched skills in one professional summary.
          </p>
        </section>

        {loading ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
              <p className="text-sm font-medium">Loading dashboard stats...</p>
            </div>
          </section>
        ) : error ? (
          <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <p className="text-sm font-medium text-rose-700">{error}</p>
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <article key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{card.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.detail}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Trend</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">Match score trend over time</h2>
                </div>
                <div className="mt-5">
                  <ScoreTrendChart data={trendData} />
                </div>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Distribution</p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">Skill gaps distribution</h2>
                </div>
                <div className="mt-5">
                  <SkillGapChart data={skillGapData} />
                </div>
              </article>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Skills</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Top skills matched</h2>
              </div>
              <div className="mt-5">
                <SkillsPieChart data={pieData} />
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
