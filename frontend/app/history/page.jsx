'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadHistoryFromSupabase } from '@/lib/history-store';
import { getSupabaseClient } from '@/services/supabaseClient.js';

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

function uniqueStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function collectSkills(resumeData) {
  return uniqueStrings([
    ...(resumeData?.technicalSkills || []),
    ...(resumeData?.skills || []),
    ...(resumeData?.softSkills || []),
    ...(resumeData?.languages || []),
    ...(resumeData?.frameworks || []),
    ...(resumeData?.databases || []),
    ...(resumeData?.tools || []),
  ]);
}

function normalizeExperience(item) {
  const textHighlights = String(item?.description || '')
    .split(/\n|[.;]\s*/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    title: item?.title || item?.role || item?.position || 'Role',
    company: item?.company || item?.organization || item?.employer || '',
    duration: item?.duration || item?.period || item?.range || '',
    highlights: Array.isArray(item?.highlights) ? item.highlights : textHighlights,
  };
}

function normalizeEducation(item) {
  return {
    degree: item?.degree || item?.qualification || item?.program || 'Education',
    institution: item?.institution || item?.school || item?.university || '',
    year: item?.year || item?.graduationYear || item?.completed || '',
    gpa: item?.gpa || '',
  };
}

function normalizeProject(item) {
  return {
    name: item?.name || item?.title || item?.projectName || 'Project',
    description: item?.description || item?.summary || item?.details || '',
    technologies: Array.isArray(item?.technologies)
      ? item.technologies
      : Array.isArray(item?.techStack)
        ? item.techStack
        : [],
  };
}

function AnalysisCard({ analysis, active, onClick }) {
  const resumeData = analysis?.resume_data || {};
  const candidateName = resumeData?.candidateName || resumeData?.name || 'Unknown candidate';
  const overallScore = Number(resumeData?.overallScore) || Number(analysis?.overallScore) || 0;
  const hiringRecommendation = resumeData?.hiringRecommendation || 'No recommendation';
  const experienceLevel = resumeData?.experienceLevel || 'Not specified';
  const email = resumeData?.email || '--';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-3xl border p-5 text-left transition ${active ? 'border-[#6B4DFF]/60 bg-white/8' : 'border-white/10 bg-[#0F0F13] hover:bg-white/5'}`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div>
            <p className="text-base font-semibold text-[#F1F1F3]">{candidateName}</p>
            <p className="text-sm text-[#8B8B9E]">{email}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-[#8B8B9E]">
            <span className="rounded-full border border-white/10 px-3 py-1">{experienceLevel}</span>
            <span className="rounded-full border border-white/10 px-3 py-1">{formatDate(analysis?.created_at)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:justify-end">
          <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            {overallScore}%
          </span>
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-[#F1F1F3]">
            {hiringRecommendation}
          </span>
        </div>
      </div>
    </button>
  );
}

function SectionList({ title, items, emptyMessage, renderItem }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#15151C] p-4">
      <p className="text-sm font-semibold text-[#F1F1F3]">{title}</p>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map((item, index) => (
            <div key={`${title}-${index}`} className="rounded-2xl border border-white/5 bg-[#101015] p-4 text-sm text-[#D8D8E0]">
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-[#8B8B9E]">{emptyMessage}</p>
      )}
    </div>
  );
}

function SectionPills({ title, items, emptyMessage }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#15151C] p-4">
      <p className="text-sm font-semibold text-[#F1F1F3]">{title}</p>
      {items.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-[#D8D8E0]">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-[#8B8B9E]">{emptyMessage}</p>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const supabase = getSupabaseClient();
        const authResult = supabase.auth?.getUser ? await supabase.auth.getUser() : { data: { user: null } };
        const user = authResult?.data?.user;

        if (!user) {
          setAnalyses([]);
          return;
        }

        const history = await loadHistoryFromSupabase(user.id);
        setAnalyses(history);
        setSelectedAnalysisId((current) => current || history[0]?.id || '');
      } catch (err) {
        console.error('History error:', err);
        setAnalyses([]);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  const selectedAnalysis = useMemo(
    () => analyses.find((entry) => entry.id === selectedAnalysisId) || analyses[0] || null,
    [analyses, selectedAnalysisId],
  );

  const resumeData = selectedAnalysis?.resume_data || {};
  const selectedSkills = collectSkills(resumeData);
  const selectedExperience = Array.isArray(resumeData?.workExperience)
    ? resumeData.workExperience.map(normalizeExperience)
    : Array.isArray(resumeData?.experience)
      ? resumeData.experience.map(normalizeExperience)
      : [];
  const selectedEducation = Array.isArray(resumeData?.education)
    ? resumeData.education.map(normalizeEducation)
    : [];
  const selectedProjects = Array.isArray(resumeData?.projects)
    ? resumeData.projects.map(normalizeProject)
    : [];
  const selectedStrengths = Array.isArray(resumeData?.strengths) ? resumeData.strengths : [];
  const selectedAreasToImprove = Array.isArray(resumeData?.areasToImprove) ? resumeData.areasToImprove : [];
  const overallScore = Number(resumeData?.overallScore) || Number(selectedAnalysis?.overallScore) || 0;
  const hiringRecommendation = resumeData?.hiringRecommendation || 'No recommendation saved.';

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-white/10 bg-[#15151C] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8B8B9E]">Session history</p>
            <h1 className="mt-2 text-3xl font-semibold text-[#F1F1F3]">Your analyses</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#8B8B9E]">
              Loaded directly from Supabase so the history stays aligned with saved analysis records.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <div className="space-y-4">
            {loading ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-[#0F0F13] px-5 py-10 text-sm text-[#8B8B9E]">
                Loading history from Supabase...
              </div>
            ) : analyses.length ? (
              analyses.map((analysis) => (
                <AnalysisCard
                  key={analysis.id}
                  analysis={analysis}
                  active={analysis.id === selectedAnalysisId}
                  onClick={() => setSelectedAnalysisId(analysis.id)}
                />
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-[#0F0F13] px-5 py-10 text-sm text-[#8B8B9E]">
                No saved analyses found yet. Analyze a resume to populate this view.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0F0F13] p-5">
            {selectedAnalysis ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B8B9E]">Selected analysis</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#F1F1F3]">
                  {resumeData?.candidateName || resumeData?.name || 'Resume analysis'}
                </h2>
                <p className="mt-1 text-sm text-[#8B8B9E]">
                  {resumeData?.email || '--'} · {formatDate(selectedAnalysis?.created_at)}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-2xl border border-white/10 bg-[#15151C] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-[#8B8B9E]">Overall Score</p>
                    <p className="mt-1 text-xl font-semibold text-[#F1F1F3]">{overallScore}%</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#15151C] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-[#8B8B9E]">Experience</p>
                    <p className="mt-1 text-xl font-semibold text-[#F1F1F3]">{resumeData?.experienceLevel || '--'}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-[#15151C] p-4">
                  <p className="text-sm font-semibold text-[#F1F1F3]">Hiring recommendation</p>
                  <p className="mt-2 text-sm text-[#8B8B9E]">{hiringRecommendation}</p>
                </div>

                <div className="mt-5 space-y-4">
                  <SectionPills title="All skills" items={selectedSkills} emptyMessage="No skills were saved in this analysis." />

                  <SectionList
                    title="Work experience"
                    items={selectedExperience}
                    emptyMessage="No work experience was saved in this analysis."
                    renderItem={(item) => (
                      <div className="space-y-2">
                        <p className="font-semibold text-[#F1F1F3]">{item.title}</p>
                        <p className="text-sm text-[#8B8B9E]">
                          {item.company || '--'}{item.duration ? ` · ${item.duration}` : ''}
                        </p>
                        {item.highlights.length ? (
                          <ul className="ml-5 list-disc space-y-1 text-sm text-[#D8D8E0]">
                            {item.highlights.map((highlight, index) => (
                              <li key={`${item.title}-${index}`}>{highlight}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    )}
                  />

                  <SectionList
                    title="Education"
                    items={selectedEducation}
                    emptyMessage="No education details were saved in this analysis."
                    renderItem={(item) => (
                      <div className="space-y-1">
                        <p className="font-semibold text-[#F1F1F3]">{item.degree}</p>
                        <p className="text-sm text-[#8B8B9E]">
                          {item.institution || '--'}{item.year ? ` · ${item.year}` : ''}{item.gpa ? ` · GPA ${item.gpa}` : ''}
                        </p>
                      </div>
                    )}
                  />

                  <SectionList
                    title="Projects"
                    items={selectedProjects}
                    emptyMessage="No projects were saved in this analysis."
                    renderItem={(item) => (
                      <div className="space-y-1">
                        <p className="font-semibold text-[#F1F1F3]">{item.name}</p>
                        <p className="text-sm text-[#8B8B9E]">{item.description || 'No description saved.'}</p>
                        {item.technologies.length ? (
                          <p className="text-xs uppercase tracking-[0.14em] text-[#8B8B9E]">{item.technologies.join(' · ')}</p>
                        ) : null}
                      </div>
                    )}
                  />

                  <SectionPills title="Strengths" items={selectedStrengths} emptyMessage="No strengths were saved in this analysis." />
                  <SectionPills title="Areas to improve" items={selectedAreasToImprove} emptyMessage="No improvement areas were saved in this analysis." />
                </div>
              </div>
            ) : (
              <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-[#8B8B9E]">
                Select an analysis to view details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
