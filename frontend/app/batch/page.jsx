'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  Filter,
  FolderInput,
  Loader2,
  MoveRight,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { readStoredAuth } from '../../src/lib/auth-session';
import { addBatchRun, buildBatchName, buildBatchResultsCsv, buildReportFilename } from '../../src/lib/batch-history';
import { extractResumeTextFromFile } from '../../src/lib/resume-text';
import { getFriendlyApiError, sanitizeText, validateResumeFile } from '../../src/lib/input-utils';

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt,.md';
const MAX_FILES = 50;
const PROCESS_DELAY_MS = 250;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${size} B`;
}

function isMeaningfulJobDescription(value) {
  const text = String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

  if (text.length < 100) {
    return false;
  }

  const words = text.replace(/[^a-z0-9+#.\-/\s]/g, ' ').split(/\s+/).filter(Boolean);

  if (words.length < 12) {
    return false;
  }

  const signalTerms = ['experience', 'required', 'skills', 'responsibilities', 'qualifications', 'build', 'develop', 'design', 'maintain', 'testing', 'deploy', 'cloud', 'database', 'api', 'frontend', 'backend', 'git'];
  return signalTerms.some((term) => text.includes(term)) || words.filter((word) => signalTerms.includes(word)).length >= 3;
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeRecommendationGroup(recommendation, score) {
  const text = String(recommendation || '').toLowerCase();

  if (text.includes('strong') || score >= 80) {
    return 'Strongly Recommended';
  }

  if (text.includes('review') || score < 60) {
    return 'Needs Review';
  }

  return 'Recommended';
}

function normalizeBatchResult(payload, fallbackName) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const profile = data.profile && typeof data.profile === 'object' ? data.profile : {};
  const score = Number.isFinite(Number(data.matchScore)) ? Math.max(0, Math.min(100, Math.round(Number(data.matchScore)))) : 0;

  return {
    candidateName: String(data.candidateName || profile.name || fallbackName || 'Candidate').trim(),
    matchScore: score,
    matchedSkills: normalizeStringArray(data.matchedSkills),
    missingSkills: normalizeStringArray(data.missingSkills),
    experienceFit: ['Strong', 'Moderate', 'Weak'].includes(String(data.experienceFit || '').trim())
      ? String(data.experienceFit).trim()
      : 'Moderate',
    recommendation: String(data.recommendation || 'Review manually').trim(),
    profile: {
      name: String(profile.name || data.candidateName || fallbackName || 'Candidate').trim(),
      email: String(profile.email || '').trim(),
      title: String(profile.title || '').trim(),
      summary: String(profile.summary || '').trim(),
      skills: normalizeStringArray(profile.skills),
      experience: Array.isArray(profile.experience) ? profile.experience : [],
      education: Array.isArray(profile.education) ? profile.education : [],
      yearsExperience: Number.isFinite(Number(profile.yearsExperience)) ? Number(profile.yearsExperience) : null,
    },
  };
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

function statusTone(status) {
  if (status === 'Done') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'Processing') {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (status === 'Failed') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function experienceTone(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'strong') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  if (normalized === 'weak') {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }

  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function recommendationTone(value) {
  if (value === 'Strongly Recommended') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }

  if (value === 'Needs Review') {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }

  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeFileEntry(file) {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    file,
    name: file.name,
    size: file.size,
    status: 'Queued',
    error: '',
    result: null,
    resumeText: '',
  };
}

function isValidExtension(fileName) {
  return /\.(pdf|docx|txt|md)$/i.test(fileName);
}

function ResultRow({ row, expanded, onToggle }) {
  return (
    <>
      <tr className="transition hover:bg-white/5">
        <td className="px-4 py-4 font-medium text-[#F1F1F3]">{row.displayRank}</td>
        <td className="px-4 py-4 text-[#F1F1F3]">{row.candidateName}</td>
        <td className="px-4 py-4">
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${scoreTone(Number(row.matchScore))}`}>
            {Math.round(Number(row.matchScore))}%
          </span>
        </td>
        <td className="px-4 py-4 text-[#8B8B9E]">{(row.matchedSkills || []).length}</td>
        <td className="px-4 py-4 text-[#8B8B9E]">{(row.missingSkills || []).length}</td>
        <td className="px-4 py-4">
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${experienceTone(row.experienceFit)}`}>
            {row.experienceFit}
          </span>
        </td>
        <td className="px-4 py-4">
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${recommendationTone(normalizeRecommendationGroup(row.recommendation, Number(row.matchScore)))}`}>
            {normalizeRecommendationGroup(row.recommendation, Number(row.matchScore))}
          </span>
        </td>
        <td className="px-4 py-4">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0F0F13] px-3 py-2 text-xs font-semibold text-[#F1F1F3] transition hover:bg-white/5"
          >
            <Eye className="h-4 w-4" />
            {expanded ? 'Hide Full Profile' : 'View Full Profile'}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-[#111827]">
          <td colSpan={8} className="px-4 py-5">
            <div className="rounded-2xl border border-white/10 bg-[#0F0F13] p-4">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <p className="text-sm font-semibold text-[#F1F1F3]">{row.profile?.name || row.candidateName}</p>
                  <p className="mt-1 text-sm text-[#8B8B9E]">{row.profile?.email || 'No email extracted'}</p>
                  <p className="mt-3 text-sm leading-6 text-[#8B8B9E]">{row.profile?.summary || 'No summary was returned for this candidate.'}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-[#1A1A24] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B8B9E]">Matched Skills</p>
                    <p className="mt-2 text-sm text-[#F1F1F3]">{(row.matchedSkills || []).length ? row.matchedSkills.join(', ') : 'None'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#1A1A24] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B8B9E]">Missing Skills</p>
                    <p className="mt-2 text-sm text-[#F1F1F3]">{(row.missingSkills || []).length ? row.missingSkills.join(', ') : 'None'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#1A1A24] p-3 sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B8B9E]">Experience</p>
                    <p className="mt-2 text-sm text-[#F1F1F3]">
                      {(row.profile?.experience || []).length
                        ? row.profile.experience.map((item) => [item.title, item.company, item.duration].filter(Boolean).join(' • ')).join(' | ')
                        : 'No experience details extracted.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export default function BatchResumeUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState('guest');
  const [jobForm, setJobForm] = useState({ jobTitle: '', companyName: '', jobDescription: '' });
  const [savedJob, setSavedJob] = useState(null);
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [error, setError] = useState('');
  const [stepError, setStepError] = useState('');
  const [batchRun, setBatchRun] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [recommendationFilter, setRecommendationFilter] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: 'matchScore', direction: 'desc' });
  const [expandedRows, setExpandedRows] = useState({});
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    const stored = readStoredAuth();

    if (!stored?.token) {
      router.replace('/login');
      return;
    }

    setIsAuthenticated(true);
    setRole(String(stored?.user?.role || stored?.user?.user_role || stored?.user?.account_type || stored?.role || '').toLowerCase());
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (role === 'candidate') {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, role, router]);

  const filteredResults = useMemo(() => {
    const rows = [...(batchRun?.results || [])];
    const search = searchQuery.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      if (Number(row.matchScore) < minScore) {
        return false;
      }

      if (recommendationFilter !== 'All' && normalizeRecommendationGroup(row.recommendation, Number(row.matchScore)) !== recommendationFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      return String(row.candidateName || row.profile?.name || '').toLowerCase().includes(search);
    });

    const sorted = filtered.sort((left, right) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;

      switch (sortConfig.key) {
        case 'candidateName':
          return String(left.candidateName || '').localeCompare(String(right.candidateName || ''), undefined, { numeric: true }) * direction;
        case 'matchScore':
          return (Number(left.matchScore) - Number(right.matchScore)) * direction;
        case 'matchedSkills':
          return (((left.matchedSkills || []).length) - ((right.matchedSkills || []).length)) * direction;
        case 'missingSkills':
          return (((left.missingSkills || []).length) - ((right.missingSkills || []).length)) * direction;
        case 'experienceFit':
          return String(left.experienceFit || '').localeCompare(String(right.experienceFit || '')) * direction;
        case 'recommendation':
          return normalizeRecommendationGroup(left.recommendation, Number(left.matchScore)).localeCompare(normalizeRecommendationGroup(right.recommendation, Number(right.matchScore))) * direction;
        default:
          return 0;
      }
    });

    return sorted.map((row, index) => ({ ...row, displayRank: index + 1 }));
  }, [batchRun, minScore, recommendationFilter, searchQuery, sortConfig.direction, sortConfig.key]);

  function updateJobField(field, value) {
    setJobForm((current) => ({ ...current, [field]: value }));
  }

  function handleFiles(nextFiles) {
    const next = Array.from(nextFiles || []);
    const validationIssue = next.find((file) => {
      const validation = validateResumeFile(file);
      return !validation.valid;
    });

    if (validationIssue) {
      const validation = validateResumeFile(validationIssue);
      setError(validation.message);
      return;
    }

    const accepted = next.filter((file) => isValidExtension(file.name));

    if (!accepted.length) {
      return;
    }

    setError('');

    setFiles((current) => {
      const merged = [...current];

      accepted.forEach((file) => {
        if (merged.length >= MAX_FILES) {
          return;
        }

        const exists = merged.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
        if (!exists) {
          merged.push(normalizeFileEntry(file));
        }
      });

      return merged;
    });
  }

  function handleFileChange(event) {
    handleFiles(event.target.files);
    event.target.value = '';
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  function removeFile(id) {
    if (isProcessing) {
      return;
    }

    setFiles((current) => current.filter((item) => item.id !== id));
  }

  function handleSaveJobDetails(event) {
    event.preventDefault();

    const jobTitle = sanitizeText(jobForm.jobTitle);
    const companyName = sanitizeText(jobForm.companyName);
    const jobDescription = sanitizeText(jobForm.jobDescription);

    if (!jobTitle || !companyName) {
      setStepError('Job title and company name are required.');
      return;
    }

    if (!isMeaningfulJobDescription(jobDescription)) {
      setStepError('Please enter at least 100 meaningful characters for the job description.');
      return;
    }

    setStepError('');
    setError('');
    setSavedJob({ jobTitle, companyName, jobDescription });
  }

  function resetJobDetails() {
    setSavedJob(null);
  }

  async function handleStartBatchAnalysis() {
    if (!savedJob) {
      setError('Save the job description before starting the batch analysis.');
      return;
    }

    if (!files.length) {
      setError('Upload at least one resume before starting the batch analysis.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setStepError('');
    setBatchRun(null);
    setExpandedRows({});
    setProgress({ current: 0, total: files.length, label: '' });

    const workingFiles = files.map((file) => ({ ...file, status: 'Queued', error: '', result: null, resumeText: '' }));
    setFiles(workingFiles);

    const results = [];

    for (let index = 0; index < workingFiles.length; index += 1) {
      const fileEntry = workingFiles[index];

      setFiles((current) => current.map((item) => (item.id === fileEntry.id ? { ...item, status: 'Processing' } : item)));
      setProgress({ current: index + 1, total: workingFiles.length, label: `Analyzing ${index + 1} of ${workingFiles.length} resumes...` });

      try {
        const resumeText = await extractResumeTextFromFile(fileEntry.file);

        if (!resumeText || resumeText.trim().length < 20) {
          throw new Error('Could not extract readable text from this resume.');
        }

        const response = await axios.post(
          '/api/batch/analyze',
          {
            jobTitle: sanitizeText(savedJob.jobTitle),
            companyName: sanitizeText(savedJob.companyName),
            jobDescription: sanitizeText(savedJob.jobDescription),
            resumeText,
            candidateIndex: index + 1,
          },
          { timeout: 120000 }
        );

        const normalized = normalizeBatchResult(response.data, fileEntry.name);
        const completedResult = { ...normalized, sourceFileName: fileEntry.name, rank: index + 1 };
        results.push(completedResult);

        setFiles((current) => current.map((item) => (item.id === fileEntry.id ? { ...item, status: 'Done', error: '', result: completedResult, resumeText } : item)));
      } catch (itemError) {
        const message = getFriendlyApiError(itemError, 'Resume analysis failed.');
        setFiles((current) => current.map((item) => (item.id === fileEntry.id ? { ...item, status: 'Failed', error: message } : item)));
      }

      if (index < workingFiles.length - 1) {
        await delay(PROCESS_DELAY_MS);
      }
    }

    const rankedResults = results.sort((left, right) => Number(right.matchScore) - Number(left.matchScore)).map((result, index) => ({ ...result, rank: index + 1 }));

    const completedBatch = {
      id: `batch-${Date.now()}`,
      batchName: buildBatchName(savedJob),
      jobTitle: savedJob.jobTitle,
      companyName: savedJob.companyName,
      jobDescription: savedJob.jobDescription,
      createdAt: new Date().toISOString(),
      totalResumes: workingFiles.length,
      averageScore: rankedResults.length ? rankedResults.reduce((sum, result) => sum + (Number(result.matchScore) || 0), 0) / rankedResults.length : 0,
      topCandidate: rankedResults[0]?.candidateName || '--',
      results: rankedResults,
    };

    addBatchRun(completedBatch);
    setBatchRun(completedBatch);
    setProgress({ current: workingFiles.length, total: workingFiles.length, label: 'Batch analysis complete.' });
    setIsProcessing(false);
  }

  function toggleSort(key) {
    setSortConfig((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }

      return { key, direction: key === 'matchScore' ? 'desc' : 'asc' };
    });
  }

  function toggleExpanded(rowId) {
    setExpandedRows((current) => ({ ...current, [rowId]: !current[rowId] }));
  }

  async function handleExportPdf() {
    if (!batchRun) {
      return;
    }

    setIsExportingPdf(true);

    try {
      const jsPdfModule = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const jsPDF = jsPdfModule.default || jsPdfModule.jsPDF;
      const autoTable = autoTableModule.default || autoTableModule.autoTable;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 70, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text('SmartHire AI', 40, 38);
      doc.setFontSize(11);
      doc.text('Recruiter Batch Report', 40, 54);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(18);
      doc.text(batchRun.jobTitle, 40, 110);
      doc.setFontSize(11);
      doc.text(`Company: ${batchRun.companyName}`, 40, 132);
      doc.text(`Date: ${new Date(batchRun.createdAt).toLocaleString()}`, 40, 150);
      doc.text(`Total candidates: ${batchRun.totalResumes}`, 40, 168);
      doc.text(`Average score: ${Math.round(batchRun.averageScore)}%`, 40, 186);
      doc.text(`Top candidate: ${batchRun.topCandidate}`, 40, 204);

      doc.setFontSize(14);
      doc.text('Top 3 Candidates', 40, 248);
      batchRun.results.slice(0, 3).forEach((candidate, index) => {
        doc.setFontSize(11);
        doc.text(`${index + 1}. ${candidate.candidateName} - ${Math.round(candidate.matchScore)}%`, 52, 270 + index * 20);
      });

      doc.addPage();
      doc.setFontSize(16);
      doc.text('Ranked Results', 40, 48);

      autoTable(doc, {
        startY: 66,
        head: [[
          'Rank',
          'Candidate Name',
          'Match Score',
          'Matched Skills',
          'Missing Skills',
          'Experience Fit',
          'Recommendation',
        ]],
        body: batchRun.results.map((row) => [
          row.rank,
          row.candidateName,
          `${Math.round(row.matchScore)}%`,
          String((row.matchedSkills || []).length),
          String((row.missingSkills || []).length),
          row.experienceFit,
          row.recommendation,
        ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [15, 23, 42] },
      });

      doc.save(buildReportFilename(batchRun));
    } finally {
      setIsExportingPdf(false);
    }
  }

  if (!isAuthenticated) {
    return null;
  }

  const currentResultCount = batchRun?.results?.length || 0;

  return (
    <div className="space-y-6 px-4 py-8 text-[#F1F1F3] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8B8B9E]">Recruiter Batch Upload</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#F1F1F3] sm:text-4xl">Process hundreds of resumes against one job</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8B8B9E]">
                Save the role details, queue files, and run sequential AI analysis so each resume is processed safely within Vercel limits.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:w-[30rem]">
              <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8B9E]">Selected</p>
                <p className="mt-1 text-lg font-semibold text-[#F1F1F3]">{files.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8B9E]">Processed</p>
                <p className="mt-1 text-lg font-semibold text-[#F1F1F3]">{progress.current}/{progress.total || files.length || 0}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8B9E]">Status</p>
                <p className="mt-1 text-lg font-semibold text-[#F1F1F3]">{isProcessing ? 'Processing' : batchRun ? 'Complete' : 'Ready'}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <form onSubmit={handleSaveJobDetails} className="rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm backdrop-blur">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8B9E]">Step 1</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#F1F1F3]">Job description input</h2>
                </div>
                {savedJob ? (
                  <button type="button" onClick={resetJobDetails} className="text-sm font-semibold text-[#8B8B9E] transition hover:text-[#F1F1F3]">
                    Edit details
                  </button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#F1F1F3]" htmlFor="job-title">
                    Job Title
                  </label>
                  <input
                    id="job-title"
                    value={jobForm.jobTitle}
                    onChange={(event) => updateJobField('jobTitle', event.target.value)}
                    placeholder="Senior Full Stack Engineer"
                    className="w-full rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3 text-sm text-[#F1F1F3] outline-none placeholder:text-[#8B8B9E] focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-[#F1F1F3]" htmlFor="company-name">
                    Company Name
                  </label>
                  <input
                    id="company-name"
                    value={jobForm.companyName}
                    onChange={(event) => updateJobField('companyName', event.target.value)}
                    placeholder="Acme Global"
                    className="w-full rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3 text-sm text-[#F1F1F3] outline-none placeholder:text-[#8B8B9E] focus:border-white/20"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-semibold text-[#F1F1F3]" htmlFor="job-description">
                  Full Job Description
                </label>
                <textarea
                  id="job-description"
                  value={jobForm.jobDescription}
                  onChange={(event) => updateJobField('jobDescription', event.target.value)}
                  rows={10}
                  minLength={100}
                  placeholder="Paste the full job description, responsibilities, qualifications, and core expectations here."
                  className="w-full rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3 text-sm text-[#F1F1F3] outline-none placeholder:text-[#8B8B9E] focus:border-white/20"
                />
                <p className="mt-2 text-xs text-[#8B8B9E]">Minimum 100 characters recommended for high-quality matching.</p>
              </div>

              {stepError ? <p className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{stepError}</p> : null}
              {error ? <p className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p> : null}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90 sm:w-auto">
                  <MoveRight className="h-4 w-4" />
                  Save & Continue
                </button>
                {savedJob ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Job details saved
                  </span>
                ) : null}
              </div>
            </form>

            <section className="rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm backdrop-blur">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8B9E]">Step 2</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#F1F1F3]">Resume upload</h2>
                </div>
                <p className="text-sm text-[#8B8B9E]">Upload up to 50 resumes at once</p>
              </div>

              <div
                onDragEnter={() => setIsDragging(true)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`mt-5 rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ${isDragging ? 'border-white/40 bg-white/5' : 'border-white/10 bg-[#0F0F13]'}`}
              >
                <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_EXTENSIONS} onChange={handleFileChange} className="hidden" />
                <Upload className="mx-auto h-10 w-10 text-[#8B8B9E]" />
                <p className="mt-4 text-base font-semibold text-[#F1F1F3]">Drag and drop resumes here or choose files from your device</p>
                <p className="mt-2 text-sm text-[#8B8B9E]">Accepts PDF, DOCX, TXT, and MD files.</p>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-5 inline-flex w-full justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90 sm:w-auto">
                  Add Resumes
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-[#0F0F13] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#F1F1F3]">{files.length} resumes selected</p>
                    <p className="text-xs text-[#8B8B9E]">Accepted formats: PDF, DOCX, TXT, MD</p>
                  </div>
                  <button type="button" onClick={() => setFiles([])} disabled={isProcessing} className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8B8B9E] transition hover:text-[#F1F1F3] disabled:cursor-not-allowed disabled:opacity-50">
                    Clear all
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {files.length ? (
                    files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#1A1A24] px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#F1F1F3]">{file.name}</p>
                          <p className="mt-1 text-xs text-[#8B8B9E]">{formatFileSize(file.size)}</p>
                          {file.error ? <p className="mt-1 text-xs text-rose-300">{file.error}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(file.status)}`}>{file.status}</span>
                          <button type="button" onClick={() => removeFile(file.id)} disabled={isProcessing} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#0F0F13] text-[#F1F1F3] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Remove ${file.name}`}>
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-[#1A1A24] px-4 py-6 text-sm text-[#8B8B9E]">No resumes selected yet.</div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button type="button" onClick={handleStartBatchAnalysis} disabled={!files.length || isProcessing || !savedJob} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50">
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderInput className="h-4 w-4" />}
                  Start Batch Analysis
                </button>
                <p className="text-sm text-[#8B8B9E]">Sequential processing keeps each resume under Vercel timeout limits.</p>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm backdrop-blur">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8B9E]">Step 3</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#F1F1F3]">Processing status</h2>
                </div>
                <p className="text-sm text-[#8B8B9E]">{progress.label || 'Ready to start'}</p>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-[#0F0F13] p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-[#F1F1F3]">{progress.total ? `Analyzing ${progress.current} of ${progress.total} resumes...` : 'No batch in progress'}</span>
                  <span className="text-[#8B8B9E]">{progress.total ? `${Math.round((progress.current / progress.total) * 100)}%` : '0%'}</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-white/10">
                  <div className="h-3 rounded-full bg-white transition-all" style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }} />
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-6 rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8B9E]">Step 4</p>
                <h2 className="mt-1 text-xl font-semibold text-[#F1F1F3]">Results table</h2>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8B9E]">Returned</p>
                <p className="mt-1 text-lg font-semibold text-[#F1F1F3]">{currentResultCount || '--'}</p>
              </div>
            </div>

            {batchRun ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8B9E]">Batch</p>
                    <p className="mt-1 text-sm font-semibold text-[#F1F1F3]">{batchRun.batchName}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8B9E]">Average</p>
                    <p className="mt-1 text-sm font-semibold text-[#F1F1F3]">{Math.round(batchRun.averageScore)}%</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#0F0F13] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8B8B9E]">Top Candidate</p>
                    <p className="mt-1 text-sm font-semibold text-[#F1F1F3]">{batchRun.topCandidate}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#0F0F13] p-4">
                  <button type="button" onClick={() => downloadTextFile(`${(batchRun.batchName || 'Batch').replace(/[^a-z0-9]+/gi, '_')}_Results.csv`, buildBatchResultsCsv(batchRun.results), 'text/csv;charset=utf-8;')} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90">
                    <Download className="h-4 w-4" />
                    Export to CSV
                  </button>
                  <button type="button" onClick={handleExportPdf} disabled={isExportingPdf} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#1A1A24] px-4 py-2.5 text-sm font-semibold text-[#F1F1F3] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50">
                    {isExportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                    Export to PDF Report
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#0F0F13] p-4">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B8B9E]" />
                    <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by candidate name" className="w-full rounded-xl border border-white/10 bg-[#1A1A24] py-2.5 pl-9 pr-3 text-sm text-[#F1F1F3] outline-none placeholder:text-[#8B8B9E]" />
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#1A1A24] px-3 py-2.5">
                    <Filter className="h-4 w-4 text-[#8B8B9E]" />
                    <span className="text-sm text-[#8B8B9E]">Min score</span>
                    <input type="range" min="0" max="100" value={minScore} onChange={(event) => setMinScore(Number(event.target.value))} className="w-28 accent-white" />
                    <span className="text-sm font-semibold text-[#F1F1F3]">{minScore}</span>
                  </div>
                  <select value={recommendationFilter} onChange={(event) => setRecommendationFilter(event.target.value)} className="rounded-xl border border-white/10 bg-[#1A1A24] px-3 py-2.5 text-sm text-[#F1F1F3] outline-none">
                    <option value="All">All Recommendations</option>
                    <option value="Strongly Recommended">Strongly Recommended</option>
                    <option value="Recommended">Recommended</option>
                    <option value="Needs Review">Needs Review</option>
                  </select>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                      <thead className="bg-[#0F0F13] text-xs uppercase tracking-[0.16em] text-[#8B8B9E]">
                        <tr>
                          {[
                            ['Rank', 'rank'],
                            ['Candidate Name', 'candidateName'],
                            ['Match Score', 'matchScore'],
                            ['Matched Skills', 'matchedSkills'],
                            ['Missing Skills', 'missingSkills'],
                            ['Experience Fit', 'experienceFit'],
                            ['Recommendation', 'recommendation'],
                          ].map(([label, key]) => (
                            <th key={key} className="px-4 py-3 font-semibold">
                              <button type="button" onClick={() => setSortConfig((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: key === 'matchScore' ? 'desc' : 'asc' })} className="inline-flex items-center gap-2 font-semibold">
                                {label}
                                {sortConfig.key === key ? sortConfig.direction === 'asc' ? <ArrowUpAZ className="h-3.5 w-3.5" /> : <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowUpAZ className="h-3.5 w-3.5 opacity-30" />}
                              </button>
                            </th>
                          ))}
                          <th className="px-4 py-3 font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10 bg-[#1A1A24]">
                        {filteredResults.length ? (
                          filteredResults.map((row) => (
                            <ResultRow
                              key={`${row.rank}-${row.candidateName}`}
                              row={row}
                              expanded={Boolean(expandedRows[row.candidateName])}
                              onToggle={() => setExpandedRows((current) => ({ ...current, [row.candidateName]: !current[row.candidateName] }))}
                            />
                          ))
                        ) : (
                          <tr>
                            <td className="px-4 py-6 text-sm text-[#8B8B9E]" colSpan={8}>
                              No matching candidates found. Adjust the filters or search by name.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0F0F13] p-8 text-center">
                <p className="text-lg font-semibold text-[#F1F1F3]">Start a batch to see ranked candidates here.</p>
                <p className="mt-2 text-sm text-[#8B8B9E]">Your final table, filters, and export tools appear after the full batch finishes.</p>
              </div>
            )}
          </aside>
        </section>
      </div>
    </div>
  );
}
