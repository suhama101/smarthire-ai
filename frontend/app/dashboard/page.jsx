'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PIE_COLORS = ['#0f172a', '#334155', '#64748b', '#94a3b8', '#cbd5e1'];

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeSeries(series, labelKeys, valueKeys) {
  if (Array.isArray(series)) {
    return series.map((item, index) => {
      const label = labelKeys.map((key) => item?.[key]).find(Boolean) || `Item ${index + 1}`;
      const value = valueKeys.map((key) => item?.[key]).find((entry) => entry !== undefined && entry !== null);

      return {
        label: String(label),
        value: toNumber(value),
      };
    });
  }

  if (series && typeof series === 'object') {
    return Object.entries(series).map(([label, value]) => ({
      label: String(label),
      value: toNumber(value),
    }));
  }

  return [];
}

function normalizePieSeries(series) {
  if (Array.isArray(series)) {
    return series.map((item, index) => ({
      name: String(item?.name || item?.label || item?.range || `Range ${index + 1}`),
      value: toNumber(item?.value ?? item?.count ?? item?.score ?? item?.total),
    }));
  }

  if (series && typeof series === 'object') {
    return Object.entries(series).map(([name, value]) => ({
      name: String(name),
      value: toNumber(value),
    }));
  }

  return [];
}

function renderPercentOrNumber(value) {
  if (value === '--' || value === null || value === undefined) {
    return '--';
  }

  return typeof value === 'number' ? value.toFixed(0) : value;
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const summaryCards = [
    {
      label: 'Total analyses',
      value: stats?.total_analyses ?? '--',
      detail: 'Resume and profile processing volume',
    },
    {
      label: 'Total matches',
      value: stats?.total_matches ?? '--',
      detail: 'Job matching results generated',
    },
    {
      label: 'Avg score',
      value: stats?.avg_score ?? '--',
      detail: 'Average match score across history',
    },
    {
      label: 'Highest score',
      value: stats?.highest_score ?? '--',
      detail: 'Best match score recorded',
    },
  ];
  const trendData = normalizeSeries(stats?.trend || stats?.score_trend, ['label', 'name', 'month', 'date', 'period'], ['score', 'value', 'total']);
  const distributionData = normalizeSeries(stats?.distribution || stats?.score_distribution, ['label', 'name', 'bucket', 'category'], ['value', 'count', 'total']);
  const scoreRangeData = normalizePieSeries(stats?.score_ranges || stats?.ranges || stats?.scoreRangeBreakdown);

  useEffect(() => {
    let isMounted = true;

    async function loadStats() {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

      if (!apiUrl.trim()) {
        if (isMounted) {
          setError('NEXT_PUBLIC_API_URL is not configured.');
          setLoading(false);
        }
        return;
      }

      try {
        const response = await axios.get(`${apiUrl.replace(/\/$/, '')}/api/history/stats`);

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

    loadStats();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 md:px-6">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">History Stats</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            This page loads summary data from the backend and is ready for charts or deeper analytics later.
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {loading ? (
            <p className="text-sm text-slate-600">Loading dashboard stats...</p>
          ) : error ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => (
                  <article key={card.label} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{card.label}</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{renderPercentOrNumber(card.value)}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{card.detail}</p>
                  </article>
                ))}
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Trend</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">Score trend</h2>
                    </div>
                  </div>
                  <div className="mt-5 h-72">
                    {trendData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '16px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#ffffff',
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="value"
                            name="Score"
                            stroke="#0f172a"
                            strokeWidth={3}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                        No trend data returned yet.
                      </div>
                    )}
                  </div>
                </article>

                <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Distribution</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">Score distribution</h2>
                    </div>
                  </div>
                  <div className="mt-5 h-72">
                    {distributionData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={distributionData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '16px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#ffffff',
                            }}
                          />
                          <Legend />
                          <Bar dataKey="value" name="Count" fill="#334155" radius={[12, 12, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                        No distribution data returned yet.
                      </div>
                    )}
                  </div>
                </article>
              </div>

              <article className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ranges</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">Score ranges</h2>
                  </div>
                </div>
                <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-center">
                  <div className="h-72">
                    {scoreRangeData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip
                            contentStyle={{
                              borderRadius: '16px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#ffffff',
                            }}
                          />
                          <Legend />
                          <Pie
                            data={scoreRangeData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={110}
                            innerRadius={55}
                            paddingAngle={2}
                            label
                          >
                            {scoreRangeData.map((entry, index) => (
                              <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                        No score range data returned yet.
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {scoreRangeData.length ? (
                      scoreRangeData.map((entry, index) => (
                        <div key={`${entry.name}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{entry.name}</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-950">{entry.value}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 sm:col-span-2">
                        No score range breakdown available yet.
                      </div>
                    )}
                  </div>
                </div>
              </article>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-950 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Raw response</p>
                <pre className="mt-3 overflow-x-auto text-sm text-slate-100">
                  {JSON.stringify(stats, null, 2)}
                </pre>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
