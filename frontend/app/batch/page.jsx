'use client';

import { useMemo, useRef, useState } from 'react';
import axios from 'axios';

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt';

function formatSkills(skills) {
  if (!Array.isArray(skills) || skills.length === 0) {
    return 'No matched skills returned';
  }

  return skills.slice(0, 5).join(', ');
}

function isMeaningfulJobDescription(value) {
  const text = String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

  if (text.length < 20) {
    return false;
  }

  const words = text.replace(/[^a-z0-9+#.\-/\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length < 4) {
    return false;
  }

  const signalTerms = [
    'experience',
    'required',
    'skills',
    'responsibilities',
    'qualifications',
    'build',
    'develop',
    'design',
    'maintain',
    'testing',
    'deploy',
    'cloud',
    'database',
    'api',
    'frontend',
    'backend',
    'git',
  ];

  if (signalTerms.some((term) => text.includes(term))) {
    return true;
  }

  return words.filter((word) => signalTerms.includes(word)).length >= 3;
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
  const apiUrl = useMemo(() => '/api', []);
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [jobDescription, setJobDescription] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [jobDescriptionError, setJobDescriptionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [rankedCandidates, setRankedCandidates] = useState([]);
  const [responseSummary, setResponseSummary] = useState('');

  const trimmedJobDescription = jobDescription.trim();
  const hasValidJobDescription = isMeaningfulJobDescription(trimmedJobDescription);

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

    if (!files.length) {
      setError('Upload at least one resume file before submitting.');
      return;
    }

    if (!hasValidJobDescription) {
      setError('Please enter a valid job description to get accurate results');
      setJobDescriptionError('Please enter a valid job description to get accurate results');
      setRankedCandidates([]);
      setResponseSummary('');
      setSuccessMessage('');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setJobDescriptionError('');
    setSuccessMessage('');
    setResponseSummary('');

    try {
      const formData = new FormData();
      formData.append('job_description', trimmedJobDescription);
      files.forEach((file) => {
        formData.append('resumes', file);
      });

      const response = await axios.post(`${apiUrl}/batch/analyze`, formData, {
        timeout: 120000,
      });

      const candidates = normalizeCandidates(response.data);
      setRankedCandidates(candidates);
      setResponseSummary(response.data?.message || `Ranked ${candidates.length || files.length} candidate${(candidates.length || files.length) === 1 ? '' : 's'}.`);
      setSuccessMessage('Batch analysis completed successfully.');
    } catch (submitError) {
      const message = submitError?.response?.data?.error || submitError?.message || 'Batch analysis failed.';
      setError(message);
      setRankedCandidates([]);
      setResponseSummary('');
      if (/job description/i.test(message)) {
        setJobDescriptionError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-8 text-[#F1F1F3]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8B8B9E]">Batch Resume Review</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#F1F1F3] sm:text-4xl">Rank multiple candidates in one pass</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8B8B9E]">
              Upload several resumes, paste the job description, and send everything to your analysis API for a clean ranked shortlist.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[28rem]">
            <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8B9E]">Files</p>
              <p className="mt-1 text-lg font-semibold text-[#F1F1F3]">{files.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8B9E]">API</p>
              <p className="mt-1 truncate text-lg font-semibold text-[#F1F1F3]">{apiUrl || 'Not set'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8B9E]">Status</p>
              <p className="mt-1 text-lg font-semibold text-[#F1F1F3]">{isSubmitting ? 'Uploading' : 'Ready'}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8B9E]">Upload workspace</p>
                <h2 className="mt-1 text-xl font-semibold text-[#F1F1F3]">Drop resumes or pick files from your device</h2>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-white/10 bg-[#0F0F13] px-4 py-2 text-sm font-medium text-[#F1F1F3] transition hover:bg-white/5"
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
                isDragging ? 'border-white/40 bg-white/5' : 'border-white/10 bg-[#0F0F13]'
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
              <p className="text-base font-semibold text-[#F1F1F3]">Drag & drop PDF, DOCX, or TXT resumes here</p>
              <p className="mt-2 text-sm text-[#8B8B9E]">You can add multiple files. The analysis request will include every resume in a single FormData payload.</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90"
              >
                Add resumes
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-[#0F0F13] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#F1F1F3]">Selected files</p>
                  <p className="text-xs text-[#8B8B9E]">Accepted formats: PDF, DOCX, TXT</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFiles([])}
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8B8B9E] transition hover:text-[#F1F1F3]"
                >
                  Clear all
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {files.length ? (
                  files.map((file, index) => (
                    <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#1A1A24] px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#F1F1F3]">{file.name}</p>
                        <p className="mt-1 text-xs text-[#8B8B9E]">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="rounded-lg border border-white/10 bg-[#0F0F13] px-3 py-1.5 text-xs font-semibold text-[#F1F1F3] transition hover:bg-white/5"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-[#1A1A24] px-4 py-6 text-sm text-[#8B8B9E]">
                    No files selected yet.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="job-description" className="mb-2 block text-sm font-semibold text-[#F1F1F3]">
                Job description
              </label>
              <textarea
                id="job-description"
                value={jobDescription}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setJobDescription(nextValue);

                  if (nextValue.trim()) {
                    setJobDescriptionError('');
                    if (error === 'Please enter a valid job description to get accurate results') {
                      setError('');
                    }
                  }
                }}
                rows={10}
                placeholder="Paste the role requirements, responsibilities, and must-have qualifications here."
                aria-invalid={Boolean(jobDescriptionError)}
                aria-describedby={jobDescriptionError ? 'job-description-error' : undefined}
                className={`w-full rounded-2xl border bg-[#0F0F13] px-4 py-3 text-sm text-[#F1F1F3] outline-none transition placeholder:text-[#8B8B9E] focus:ring-2 focus:ring-white/10 ${
                  jobDescriptionError
                    ? 'border-rose-500/70 focus:border-rose-400 focus:ring-rose-500/20'
                    : 'border-white/10 focus:border-white/20'
                }`}
              />
              {jobDescriptionError ? (
                <p id="job-description-error" className="mt-2 text-sm text-rose-300">
                  {jobDescriptionError}
                </p>
              ) : null}
            </div>

            {error ? <p className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}
            {successMessage ? <p className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{successMessage}</p> : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Uploading and ranking...' : 'Analyze batch'}
              </button>
              <p className="text-sm text-[#8B8B9E]">The request sends <span className="font-semibold text-[#F1F1F3]">job_description</span> and multiple <span className="font-semibold text-[#F1F1F3]">resumes</span> via FormData.</p>
            </div>
          </form>

          <aside className="rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8B9E]">Analysis results</p>
                <h2 className="mt-1 text-xl font-semibold text-[#F1F1F3]">Ranked candidates</h2>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8B9E]">Returned</p>
                <p className="mt-1 text-lg font-semibold text-[#F1F1F3]">{rankedCandidates.length || '--'}</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead className="bg-[#0F0F13] text-xs uppercase tracking-[0.12em] text-[#8B8B9E]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Rank</th>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-4 py-3 font-semibold">Matched skills</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-[#1A1A24]">
                    {rankedCandidates.length ? (
                      rankedCandidates.map((candidate) => (
                        <tr key={`${candidate.rank}-${candidate.name}`} className="align-top">
                          <td className="px-4 py-4 font-semibold text-[#F1F1F3]">{candidate.rank}</td>
                          <td className="px-4 py-4 text-[#F1F1F3]">{candidate.name}</td>
                          <td className="px-4 py-4 font-semibold text-[#F1F1F3]">{candidate.score}</td>
                          <td className="px-4 py-4 text-[#8B8B9E]">{formatSkills(candidate.matchedSkills)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-4 py-12 text-center text-sm text-[#8B8B9E]">
                          {hasValidJobDescription
                            ? 'Submit the batch analysis to display the ranked shortlist here.'
                            : 'Enter a job description to enable candidate ranking.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8B9E]">Loading</p>
                <p className="mt-1 text-sm font-medium text-[#F1F1F3]">{isSubmitting ? 'Active' : 'Idle'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8B9E]">Endpoint</p>
                <p className="mt-1 truncate text-sm font-medium text-[#F1F1F3]">/api/batch/analyze</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8B9E]">Mode</p>
                <p className="mt-1 text-sm font-medium text-[#F1F1F3]">Dashboard</p>
              </div>
            </div>

            {responseSummary ? (
              <p className="mt-5 rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3 text-sm text-[#8B8B9E]">
                {responseSummary}
              </p>
            ) : null}
          </aside>
        </section>
      </div>
    </div>
  );
}
