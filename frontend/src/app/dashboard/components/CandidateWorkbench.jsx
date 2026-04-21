'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import { BarChart3, FileText, GraduationCap, Sparkles, Upload, Wand2 } from 'lucide-react';
import { addAnalysisEntry } from '../../../lib/history-store';
import { getFriendlyApiError, sanitizeText, validateResumeFile } from '../../../lib/input-utils';

function scoreTone(score) {
  if (score >= 80) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (score >= 60) {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-rose-200 bg-rose-50 text-rose-700';
}

function downloadPdf(filename, content) {
  const blob = new Blob([content], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildLearningPlanText(plan, candidateName, jobTitle) {
  const lines = [
    'SmartHire AI Learning Plan',
    `Candidate: ${candidateName || 'Candidate'}`,
    `Job Title: ${jobTitle || 'Target Role'}`,
    `Total Weeks: ${plan?.totalWeeks || 4}`,
    `Readiness: ${plan?.readinessLabel || 'Needs Work'}`,
    '',
    'Quick Wins',
    ...(plan?.quickWins || []).map((item) => `- ${item}`),
    '',
    'Skill Modules',
  ];

  (plan?.skillModules || []).forEach((module) => {
    lines.push(`- ${module.skillName} (${module.priority})`);
    lines.push(`  Why: ${module.whyNeeded || ''}`);
    lines.push(`  Project: ${module.miniProject || ''}`);
  });

  return lines.join('\n');
}

function buildResumeText(profile) {
  if (!profile || typeof profile !== 'object') {
    return '';
  }

  const sections = [
    profile.name ? `Name: ${profile.name}` : '',
    profile.email ? `Email: ${profile.email}` : '',
    profile.title ? `Title: ${profile.title}` : '',
    profile.summary ? `Summary: ${profile.summary}` : '',
    Array.isArray(profile.skills) && profile.skills.length ? `Skills: ${profile.skills.join(', ')}` : '',
    Array.isArray(profile.experience) && profile.experience.length
      ? `Experience:\n${profile.experience.map((item) => [item?.title, item?.company, item?.duration, item?.description].filter(Boolean).join(' | ')).join('\n')}`
      : '',
    Array.isArray(profile.education) && profile.education.length
      ? `Education:\n${profile.education.map((item) => [item?.degree, item?.institution, item?.year].filter(Boolean).join(' | ')).join('\n')}`
      : '',
  ];

  return sections.filter(Boolean).join('\n\n').trim();
}

function recommendationTone(value) {
  if (value === 'Strong Match') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (value === 'Weak Match') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export default function CandidateWorkbench() {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [resumeData, setResumeData] = useState(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [matchResult, setMatchResult] = useState(null);
  const [matchError, setMatchError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [learningPlan, setLearningPlan] = useState(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  async function handleAnalyzeResume() {
    const validation = validateResumeFile(selectedFile);

    if (!validation.valid) {
      setAnalysisError(validation.message);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError('');
    setMatchResult(null);
    setLearningPlan(null);

    try {
      const formData = new FormData();
      formData.append('resume', selectedFile);
      const response = await axios.post('/api/resume/analyze', formData, { timeout: 120000 });
      setResumeData(response.data.resumeData);
    } catch (error) {
      setAnalysisError(getFriendlyApiError(error, 'Resume analysis failed.'));
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleMatchJob() {
    if (!resumeData) {
      setMatchError('Analyze a resume first.');
      return;
    }

    const nextJobTitle = sanitizeText(jobTitle);
    const nextJobDescription = sanitizeText(jobDescription);

    if (!nextJobTitle || !nextJobDescription) {
      setMatchError('Job title and job description are required.');
      return;
    }

    setIsMatching(true);
    setMatchError('');
    setLearningPlan(null);

    try {
      const resumeText = buildResumeText(resumeData);
      const response = await axios.post('/api/job/match', {
        candidateProfile: resumeData,
        resumeText,
        jobTitle: nextJobTitle,
        jobDescription: nextJobDescription,
      }, { timeout: 120000 });

      const nextResult = response.data;
      setMatchResult(nextResult);
      addAnalysisEntry({
        date: new Date().toISOString(),
        resumeFilename: selectedFile?.name || 'Resume',
        jobTitle: nextJobTitle,
        matchScore: nextResult?.matchScore || 0,
        recommendation: nextResult?.recommendation || 'Review manually',
        fullResult: {
          resumeData,
          resumeText,
          jobTitle: jobTitle.trim(),
          jobDescription: jobDescription.trim(),
          matchResult: nextResult,
        },
      });
    } catch (error) {
      setMatchError(getFriendlyApiError(error, 'Job matching failed.'));
    } finally {
      setIsMatching(false);
    }
  }

  async function handleGeneratePlan() {
    if (!matchResult) {
      return;
    }

    setIsGeneratingPlan(true);

    try {
      const response = await axios.post('/api/learning/plan', {
        candidateProfile: resumeData,
        jobTitle: sanitizeText(jobTitle),
        jobDescription: sanitizeText(jobDescription),
        matchResult,
      }, { timeout: 120000 });

      setLearningPlan(response.data);
    } finally {
      setIsGeneratingPlan(false);
    }
  }

  function handleDownloadPlan() {
    if (!learningPlan) {
      return;
    }

    const text = buildLearningPlanText(learningPlan, resumeData?.name, jobTitle);
    downloadPdf(`SmartHire_LearningPlan_${String(resumeData?.name || 'Candidate').replace(/[^a-z0-9]+/gi, '_')}.pdf`, text);
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-[#1A1A24] p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8B9E]">Candidate Workbench</p>
          <h2 className="mt-1 text-2xl font-semibold text-[#F1F1F3]">Resume analysis, job match, and learning plans</h2>
          <p className="mt-2 text-sm text-[#8B8B9E]">The workspace moved here from the homepage so enterprise teams can keep a clean landing page and still work in-session.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-[#0F0F13] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#F1F1F3]"><Upload className="h-4 w-4 text-indigo-300" /> Resume Upload</div>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md" className="mt-4 block w-full text-sm text-[#8B8B9E] file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-[#0F0F13]" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} />
          {selectedFile ? <p className="mt-3 text-sm text-[#F1F1F3]">Selected: {selectedFile.name}</p> : <p className="mt-3 text-sm text-[#8B8B9E]">Choose a PDF, DOCX, TXT, or MD resume.</p>}
          {analysisError ? <p className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{analysisError}</p> : null}
          <button type="button" onClick={handleAnalyzeResume} disabled={!selectedFile || isAnalyzing} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            <FileText className="h-4 w-4" />
            {isAnalyzing ? 'Analyzing...' : 'Analyze Resume'}
          </button>
          {resumeData ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#1A1A24] p-4 text-sm text-[#8B8B9E]">
              <p className="font-semibold text-[#F1F1F3]">{resumeData.name || 'Candidate Profile'}</p>
              <p className="mt-1">{resumeData.email || 'No email extracted'}</p>
              <p className="mt-2">{resumeData.summary || 'Summary unavailable.'}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0F0F13] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#F1F1F3]"><BarChart3 className="h-4 w-4 text-emerald-300" /> Job Match</div>
          <label className="mt-4 block text-sm font-medium text-[#F1F1F3]">Job Title</label>
          <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A24] px-4 py-3 text-sm text-[#F1F1F3] outline-none" placeholder="Senior Frontend Engineer" />
          <label className="mt-4 block text-sm font-medium text-[#F1F1F3]">Job Description</label>
          <textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={8} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#1A1A24] px-4 py-3 text-sm text-[#F1F1F3] outline-none" placeholder="Paste the full role description here..." />
          {matchError ? <p className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{matchError}</p> : null}
          <button type="button" onClick={handleMatchJob} disabled={!resumeData || isMatching} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            <Sparkles className="h-4 w-4" />
            {isMatching ? 'Matching...' : 'Match Job'}
          </button>

          {matchResult ? (
            <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-[#1A1A24] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#F1F1F3]">Match Result</p>
                  <p className="mt-1 text-xs text-[#8B8B9E]">Resume compared against the pasted job description</p>
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${recommendationTone(matchResult.recommendation)}`}>
                  {matchResult.recommendation || 'Good Match'}
                </span>
              </div>
              <div className="flex items-end gap-3">
                <span className={`inline-flex rounded-2xl border px-4 py-2 text-3xl font-semibold ${scoreTone(matchResult.matchScore)}`}>
                  {Math.round(Number(matchResult.matchScore) || 0)}%
                </span>
                <p className="pb-1 text-sm text-[#8B8B9E]">Overall fit score</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B8B9E]">Matched Skills</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(matchResult.matchedSkills || []).length ? matchResult.matchedSkills.map((skill) => (
                    <span key={skill} className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {skill}
                    </span>
                  )) : <span className="text-sm text-[#8B8B9E]">None found</span>}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B8B9E]">Missing Skills</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(matchResult.missingSkills || []).length ? matchResult.missingSkills.map((skill) => (
                    <span key={skill} className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                      {skill}
                    </span>
                  )) : <span className="text-sm text-[#8B8B9E]">None identified</span>}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0F0F13] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8B8B9E]">Summary</p>
                <p className="mt-2 text-sm leading-6 text-[#F1F1F3]">{matchResult.summary || 'No summary was returned.'}</p>
              </div>
              <button type="button" onClick={handleGeneratePlan} disabled={isGeneratingPlan} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0F0F13] px-4 py-2.5 text-sm font-semibold text-[#F1F1F3] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
                <GraduationCap className="h-4 w-4" />
                {isGeneratingPlan ? 'Generating...' : 'Generate Learning Plan'}
              </button>
            </div>
          ) : null}

          {learningPlan ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#1A1A24] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#F1F1F3]">{learningPlan.readinessLabel || 'Needs Work'}</p>
                  <p className="text-xs text-[#8B8B9E]">{learningPlan.totalWeeks ? `~${learningPlan.totalWeeks} weeks` : '~4 weeks'}</p>
                </div>
                <button type="button" onClick={handleDownloadPlan} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0F0F13] transition hover:bg-white/90 sm:w-auto">
                  <Wand2 className="h-4 w-4" />
                  Download PDF
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
