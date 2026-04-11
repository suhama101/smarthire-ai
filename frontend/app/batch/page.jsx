'use client';

import { useMemo, useRef, useState } from 'react';
import axios from 'axios';

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt';

function readApiUrl() {
  const value = process.env.NEXT_PUBLIC_API_URL || '';
  return value.trim().replace(/\/$/, '');
}

function formatSkills(skills) {
  if (!Array.isArray(skills) || skills.length === 0) {
    return 'No matched skills returned';
  }

  return skills.slice(0, 5).join(', ');
}

function normalizeCandidates(payload) {
  const source = Array.isArray(payload)
    ? payload
    : payload?.rankedCandidates || payload?.candidates || payload?.results || [];

  if (!Array.isArray(source)) {
    return [];
  }

  return source.map((candidate, index) => ({
    rank: candidate?.rank ?? candidate?.position ?? index + 1,
    name: candidate?.name || candidate?.full_name || candidate?.candidateName || `Candidate ${index + 1}`,
    score: candidate?.score ?? candidate?.matchScore ?? candidate?.overallScore ?? '--',
    matchedSkills: candidate?.matchedSkills || candidate?.matched_skills || candidate?.skills || [],
  }));
}

export default function BatchResumeUploadPage() {
  const apiUrl = useMemo(readApiUrl, []);
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [jobDescription, setJobDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [rankedCandidates, setRankedCandidates] = useState([]);
  const [responseSummary, setResponseSummary] = useState('');

  function addFiles(nextFiles) {
    const validFiles = Array.from(nextFiles || []).filter((file) => /\.(pdf|docx|txt)$/i.test(file.name));
    if (!validFiles.length) {
      return;
    }

    setFiles((current) => {
      const merged = [...current];
      validFiles.forEach((file) => {
        const exists = merged.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
        if (!exists) {
          merged.push(file);
        }
      });
      return merged;
    });
  }

  function handleFileChange(event) {
    addFiles(event.target.files);
    event.target.value = '';
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function removeFile(index) {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!apiUrl) {
      setError('Missing NEXT_PUBLIC_API_URL. Set your backend base URL first.');
      return;
    }

    if (!files.length) {
      setError('Upload at least one resume file before submitting.');
      return;
    }

    if (!jobDescription.trim()) {
      setError('Add a job description to rank the resumes.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');
    setResponseSummary('');

    try {
      const formData = new FormData();
      formData.append('job_description', jobDescription.trim());
      files.forEach((file) => {
        formData.append('resumes', file);
      });

      const response = await axios.post(`${apiUrl}/api/batch/analyze`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000,
      });

      const candidates = normalizeCandidates(response.data);
      setRankedCandidates(candidates);
      setResponseSummary(response.data?.message || `Ranked ${candidates.length || files.length} candidate${(candidates.length || files.length) === 1 ? '' : 's'}.`);
      setSuccessMessage('Batch analysis completed successfully.');
    } catch (submitError) {
      const message = submitError?.response?.data?.error || submitError?.message || 'Batch analysis failed.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_35%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Batch Resume Review</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Rank multiple candidates in one pass</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Upload several resumes, paste the job description, and send everything to your analysis API for a clean ranked shortlist.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[28rem]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Files</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{files.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">API</p>
              <p className="mt-1 truncate text-lg font-semibold text-slate-900">{apiUrl || 'Not set'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Status</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{isSubmitting ? 'Uploading' : 'Ready'}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Upload workspace</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Drop resumes or pick files from your device</h2>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Choose files
              </button>
            </div>

            <div
              onDragEnter={() => setIsDragging(true)}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`mt-5 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ${
                isDragging ? 'border-slate-900 bg-slate-50' : 'border-slate-300 bg-slate-50/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_EXTENSIONS}
                onChange={handleFileChange}
                className="hidden"
              />
              <p className="text-base font-semibold text-slate-900">Drag & drop PDF, DOCX, or TXT resumes here</p>
              <p className="mt-2 text-sm text-slate-500">You can add multiple files. The analysis request will include every resume in a single FormData payload.</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Add resumes
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Selected files</p>
                  <p className="text-xs text-slate-500">Accepted formats: PDF, DOCX, TXT</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFiles([])}
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 transition hover:text-slate-900"
                >
                  Clear all
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {files.length ? (
                  files.map((file, index) => (
                    <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                    No files selected yet.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="job-description" className="mb-2 block text-sm font-semibold text-slate-900">
                Job description
              </label>
              <textarea
                id="job-description"
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                rows={10}
                placeholder="Paste the role requirements, responsibilities, and must-have qualifications here."
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            {error ? <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            {successMessage ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</p> : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Uploading and ranking...' : 'Analyze batch'}
              </button>
              <p className="text-sm text-slate-500">The request sends <span className="font-semibold text-slate-700">job_description</span> and multiple <span className="font-semibold text-slate-700">resumes</span> via FormData.</p>
            </div>
          </form>

          <aside className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Analysis results</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">Ranked candidates</h2>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Returned</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{rankedCandidates.length || '--'}</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Rank</th>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-4 py-3 font-semibold">Matched skills</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {rankedCandidates.length ? (
                      rankedCandidates.map((candidate) => (
                        <tr key={`${candidate.rank}-${candidate.name}`} className="align-top">
                          <td className="px-4 py-4 font-semibold text-slate-900">{candidate.rank}</td>
                          <td className="px-4 py-4 text-slate-900">{candidate.name}</td>
                          <td className="px-4 py-4 font-semibold text-slate-900">{candidate.score}</td>
                          <td className="px-4 py-4 text-slate-600">{formatSkills(candidate.matchedSkills)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-4 py-12 text-center text-sm text-slate-500">
                          Submit the batch analysis to display the ranked shortlist here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Loading</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{isSubmitting ? 'Active' : 'Idle'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Endpoint</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-900">/api/batch/analyze</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Mode</p>
                <p className="mt-1 text-sm font-medium text-slate-900">Dashboard</p>
              </div>
            </div>

            {responseSummary ? (
              <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {responseSummary}
              </p>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
