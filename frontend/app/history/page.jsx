'use client';

import { useEffect, useMemo, useState } from 'react';
import AuthenticatedShell from '../components/authenticated-shell';
import {
  buildAnalysisCsv,
  buildBatchCsv,
  clearHistory,
  readHistory,
} from '../../src/lib/history-store';

const TABS = [
  { id: 'analyses', label: 'My Analyses' },
  { id: 'batches', label: 'Batch Runs' },
];

function formatDate(value) {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
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

function HistoryTable({ title, rows, emptyMessage, onSelect, selectedId, columns, getKey }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0F0F13]">
      <div className="border-b border-white/10 px-5 py-4">
        <h2 className="text-lg font-semibold text-[#F1F1F3]">{title}</h2>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-sm">
            <thead className="bg-[#14141B] text-[#8B8B9E]">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-5 py-3 text-left font-medium">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-[#F1F1F3]">
              {rows.map((row) => {
                const key = getKey(row);
                const active = key === selectedId;

                return (
                  <tr
                    key={key}
                    onClick={() => onSelect(key)}
                    className={`cursor-pointer transition ${active ? 'bg-white/5' : 'hover:bg-white/5'}`}
                  >
                    {row.cells.map((cell, index) => (
                      <td key={`${key}-${index}`} className="px-5 py-4 align-top">{cell}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-10 text-sm text-[#8B8B9E]">{emptyMessage}</div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [history, setHistory] = useState({ analyses: [], batches: [] });
  const [activeTab, setActiveTab] = useState('analyses');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');

  useEffect(() => {
    const refresh = () => {
      const nextHistory = readHistory();
      setHistory(nextHistory);
      setSelectedAnalysisId((current) => current || nextHistory.analyses[0]?.id || '');
      setSelectedBatchId((current) => current || nextHistory.batches[0]?.id || '');
    };

    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('smarthire-history-changed', refresh);

    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('smarthire-history-changed', refresh);
    };
  }, []);

  const selectedAnalysis = useMemo(
    () => history.analyses.find((entry) => entry.id === selectedAnalysisId) || history.analyses[0] || null,
    [history.analyses, selectedAnalysisId],
  );
  const selectedBatch = useMemo(
    () => history.batches.find((entry) => entry.id === selectedBatchId) || history.batches[0] || null,
    [history.batches, selectedBatchId],
  );

  const analysisRows = history.analyses.map((analysis) => ({
    id: analysis.id,
    cells: [
      <div key="date"><p className="font-medium text-[#F1F1F3]">{formatDate(analysis.date)}</p></div>,
      <div key="resume"><p className="font-medium text-[#F1F1F3]">{analysis.resumeFilename || '--'}</p></div>,
      <div key="job"><p className="font-medium text-[#F1F1F3]">{analysis.jobTitle || '--'}</p></div>,
      <div key="score"><span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">{analysis.matchScore || 0}%</span></div>,
      <div key="rec"><p className="max-w-[24rem] text-[#8B8B9E]">{analysis.recommendation || '--'}</p></div>,
    ],
  }));

  const batchRows = history.batches.map((batch) => ({
    id: batch.id,
    cells: [
      <div key="date"><p className="font-medium text-[#F1F1F3]">{formatDate(batch.date)}</p></div>,
      <div key="job"><p className="font-medium text-[#F1F1F3]">{batch.jobTitle || '--'}</p></div>,
      <div key="company"><p className="font-medium text-[#F1F1F3]">{batch.companyName || '--'}</p></div>,
      <div key="resumes"><p className="font-medium text-[#F1F1F3]">{batch.totalResumes || 0}</p></div>,
      <div key="avg"><p className="font-medium text-[#F1F1F3]">{batch.avgScore || 0}%</p></div>,
      <div key="top"><p className="max-w-[18rem] text-[#8B8B9E]">{batch.topCandidate || '--'}</p></div>,
    ],
  }));

  const handleClearHistory = () => {
    clearHistory();
    setHistory({ analyses: [], batches: [] });
    setSelectedAnalysisId('');
    setSelectedBatchId('');
  };

  const exportCurrent = () => {
    if (activeTab === 'analyses') {
      downloadCsv('SmartHire_Analyses.csv', buildAnalysisCsv(history.analyses));
      return;
    }

    downloadCsv('SmartHire_Batch_Runs.csv', buildBatchCsv(history.batches));
  };

  return (
    <AuthenticatedShell>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-white/10 bg-[#15151C] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8B8B9E]">Session history</p>
              <h1 className="mt-2 text-3xl font-semibold text-[#F1F1F3]">Your analyses and batch runs</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#8B8B9E]">Everything saved in this session lives under <span className="font-semibold text-[#F1F1F3]">smarthire_history</span>, so candidate work and recruiter batch runs stay in one place.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={exportCurrent} className="rounded-full border border-white/10 bg-white px-4 py-2 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90">
                Export current tab
              </button>
              <button type="button" onClick={handleClearHistory} className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm font-semibold text-[#F1F1F3] transition hover:bg-white/5">
                Clear all history
              </button>
            </div>
          </div>

          <div className="mt-6 inline-flex rounded-2xl border border-white/10 bg-[#0F0F13] p-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id ? 'bg-white text-[#0F0F13]' : 'text-[#8B8B9E] hover:text-[#F1F1F3]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
            <div className="space-y-6">
              {activeTab === 'analyses' ? (
                <HistoryTable
                  title="My Analyses"
                  rows={analysisRows}
                  emptyMessage="No candidate analyses have been saved in this session yet. Analyze a resume and run a match to populate this tab."
                  onSelect={setSelectedAnalysisId}
                  selectedId={selectedAnalysisId}
                  columns={[ 'Date & Time', 'Resume Filename', 'Job Title Matched Against', 'Match Score', 'Recommendation' ]}
                  getKey={(row) => row.id}
                />
              ) : (
                <HistoryTable
                  title="Batch Runs"
                  rows={batchRows}
                  emptyMessage="No batch runs have been saved yet. Upload a recruiter batch to populate this tab."
                  onSelect={setSelectedBatchId}
                  selectedId={selectedBatchId}
                  columns={[ 'Date & Time', 'Job Title', 'Company Name', 'Total Resumes Processed', 'Average Match Score', 'Top Candidate' ]}
                  getKey={(row) => row.id}
                />
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#0F0F13] p-5">
              {activeTab === 'analyses' ? (
                selectedAnalysis ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8B9E]">Selected analysis</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#F1F1F3]">{selectedAnalysis.resumeFilename || 'Resume analysis'}</h2>
                    <p className="mt-1 text-sm text-[#8B8B9E]">{selectedAnalysis.jobTitle || '--'} · {formatDate(selectedAnalysis.date)}</p>
                    <div className="mt-5 rounded-2xl border border-white/10 bg-[#15151C] p-4">
                      <p className="text-sm font-semibold text-[#F1F1F3]">Match Score</p>
                      <p className="mt-1 text-3xl font-semibold text-[#F1F1F3]">{selectedAnalysis.matchScore || 0}%</p>
                      <p className="mt-3 text-sm text-[#8B8B9E]">{selectedAnalysis.recommendation || 'No recommendation saved.'}</p>
                    </div>
                    <div className="mt-5 rounded-2xl border border-white/10 bg-[#15151C] p-4 text-sm text-[#8B8B9E]">
                      <p className="font-semibold text-[#F1F1F3]">Saved context</p>
                      <p className="mt-2">This entry preserves the matched resume, job title, and result payload for quick review.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-[#8B8B9E]">
                    Select an analysis to view details.
                  </div>
                )
              ) : selectedBatch ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8B9E]">Selected batch</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#F1F1F3]">{selectedBatch.jobTitle || 'Batch run'}</h2>
                  <p className="mt-1 text-sm text-[#8B8B9E]">{selectedBatch.companyName || '--'} · {formatDate(selectedBatch.date)}</p>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-2xl border border-white/10 bg-[#15151C] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[#8B8B9E]">Resumes</p>
                      <p className="mt-1 text-xl font-semibold text-[#F1F1F3]">{selectedBatch.totalResumes || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[#15151C] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-[#8B8B9E]">Average</p>
                      <p className="mt-1 text-xl font-semibold text-[#F1F1F3]">{selectedBatch.avgScore || 0}%</p>
                    </div>
                  </div>
                  <div className="mt-5 rounded-2xl border border-white/10 bg-[#15151C] p-4 text-sm text-[#8B8B9E]">
                    <p className="font-semibold text-[#F1F1F3]">Top candidate</p>
                    <p className="mt-2">{selectedBatch.topCandidate || '--'}</p>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-[#8B8B9E]">
                  Select a batch run to view details.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedShell>
  );
}
