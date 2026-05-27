'use client';

import { useEffect, useState } from 'react';
import { readStoredAuth } from '@/lib/auth-session';
import { getSupabaseClient } from '@/lib/supabaseClient';

function formatDate(dateStr) {
  if (!dateStr) {
    return '--';
  }

  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getScoreColor(score) {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}

function getRecommendationBadge(rec) {
  const colors = {
    'Strong Hire': '#22c55e',
    Hire: '#3b82f6',
    Maybe: '#eab308',
    Pass: '#ef4444',
    'Review manually': '#6b7280',
    'Strong Match': '#22c55e',
    'Good Match': '#3b82f6',
    'Weak Match': '#eab308',
    'No Match': '#ef4444',
  };

  return colors[rec] || '#6b7280';
}

function normalizeText(value) {
  return String(value || '').trim();
}

function uniqueStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function collectSkills(resumeData) {
  return uniqueStrings([
    ...(resumeData?.technicalSkills || []),
    ...(resumeData?.skills || []),
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

function analysisToCard(analysis) {
  const resumeData = analysis?.resume_data || {};

  return {
    ...analysis,
    type: 'analyses',
    title: resumeData?.candidateName || resumeData?.name || 'Unknown',
    subtitle: resumeData?.email || 'No email',
    score: Number(resumeData?.overallScore) || Number(analysis?.overallScore) || 0,
    recommendation: resumeData?.hiringRecommendation || 'Review manually',
    raw: analysis,
  };
}

function buildBatchSummary(rows) {
  return (rows || [])
    .map((row, index) => {
      const rawCandidates = Array.isArray(row?.candidates) ? row.candidates : [];
      const results = rawCandidates.map((candidate) => ({
        candidateName: normalizeText(candidate?.candidateName || candidate?.name || 'Candidate'),
        matchScore: Number(candidate?.matchScore ?? candidate?.score) || 0,
        recommendation: normalizeText(candidate?.recommendation || 'Review manually'),
        matchedSkills: Array.isArray(candidate?.matchedSkills) ? candidate.matchedSkills : [],
        missingSkills: Array.isArray(candidate?.missingSkills) ? candidate.missingSkills : [],
        summary: normalizeText(candidate?.summary),
        email: normalizeText(candidate?.email || candidate?.profile?.email),
        phone: normalizeText(candidate?.phone || candidate?.profile?.phone),
        profile: candidate?.profile && typeof candidate.profile === 'object' ? candidate.profile : null,
      }));

      const scores = results.map((item) => Number(item.matchScore) || 0);
      const averageScore = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
      const topCandidate = [...results].sort((left, right) => Number(right.matchScore) - Number(left.matchScore))[0]?.candidateName || '--';
      const jobDescription = normalizeText(row?.job_description || row?.jobDescription);
      const firstLine = jobDescription.split('\n').map((line) => line.trim()).find(Boolean) || '';

      return {
        id: normalizeText(row?.id) || `batch-${index}-${normalizeText(row?.created_at || row?.createdAt)}`,
        type: 'batches',
        jobTitle: firstLine.slice(0, 80) || 'Batch Review',
        companyName: 'Recruiter Batch',
        created_at: row?.created_at || row?.createdAt || new Date().toISOString(),
        results,
        averageScore,
        totalResumes: Number(row?.total_candidates ?? row?.totalCandidates) || results.length,
        topCandidate,
        recommendation: averageScore >= 80 ? 'Strong Hire' : averageScore >= 60 ? 'Hire' : averageScore >= 40 ? 'Maybe' : 'Pass',
      };
    })
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
}

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analyses');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHistory() {
    try {
      setLoading(true);

      const stored = readStoredAuth();
      const userId = stored?.user?.id || stored?.user?.user_id || stored?.user?.email || '';
      const supabase = getSupabaseClient();

      if (!userId) {
        setAnalyses([]);
        setBatches([]);
        setSelected(null);
        return;
      }

      const [analysisResponse, batchResponse] = await Promise.all([
        supabase
          .from('analyses')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('batch_runs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      const nextAnalyses = !analysisResponse.error && Array.isArray(analysisResponse.data) ? analysisResponse.data : [];
      const nextBatches = !batchResponse.error && Array.isArray(batchResponse.data) ? buildBatchSummary(batchResponse.data) : [];

      setAnalyses(nextAnalyses);
      setBatches(nextBatches);

      setSelected((current) => {
        if (current && current.type === activeTab) {
          return current;
        }

        if (activeTab === 'analyses') {
          return nextAnalyses.length ? analysisToCard(nextAnalyses[0]) : null;
        }

        return nextBatches.length ? nextBatches[0] : null;
      });
    } catch (err) {
      console.error('History load error:', err);
      setAnalyses([]);
      setBatches([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  const currentItems = activeTab === 'analyses' ? analyses.map(analysisToCard) : batches;
  const filtered = currentItems.filter((item) => {
    const haystack = activeTab === 'analyses'
      ? [item.title, item.subtitle, item.recommendation].join(' ').toLowerCase()
      : [item.jobTitle, item.companyName, item.topCandidate].join(' ').toLowerCase();

    return haystack.includes(searchQuery.toLowerCase());
  });

  const selectedItem = selected && selected.type === activeTab
    ? selected
    : filtered[0] || null;

  function renderAnalysisDetail(item) {
    const resumeData = item?.raw?.resume_data || {};
    const overallScore = Number(resumeData?.overallScore) || Number(item?.score) || 0;
    const hiringRecommendation = resumeData?.hiringRecommendation || item?.recommendation || 'Review manually';
    const profileSummary = String(resumeData?.profileSummary || resumeData?.summary || '').trim();
    const selectedTechnicalSkills = collectSkills(resumeData);
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

    return (
      <div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Selected analysis</p>
        <h2 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 4px' }}>{resumeData?.candidateName || resumeData?.name || 'Resume analysis'}</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 12px' }}>
          {resumeData?.email || '--'} • {formatDate(item?.raw?.created_at || item?.created_at)}
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ padding: '8px 16px', borderRadius: '8px', background: `${getScoreColor(overallScore)}20`, border: `1px solid ${getScoreColor(overallScore)}40`, color: getScoreColor(overallScore), fontWeight: '700', fontSize: '18px' }}>
            {overallScore}% Score
          </div>
          <div style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
            {hiringRecommendation}
          </div>
        </div>

        {profileSummary ? (
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Profile Summary</h3>
            <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgba(255,255,255,0.8)' }}>{profileSummary}</p>
          </div>
        ) : null}

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Technical Skills</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {selectedTechnicalSkills.length ? selectedTechnicalSkills.map((skill) => (
              <span key={skill} style={{ padding: '4px 10px', background: 'rgba(20, 184, 166, 0.1)', border: '1px solid rgba(20, 184, 166, 0.3)', borderRadius: '20px', fontSize: '12px', color: '#14b8a6' }}>{skill}</span>
            )) : <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>No technical skills were saved in this analysis.</span>}
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Work Experience</h3>
          {selectedExperience.length ? selectedExperience.map((job, index) => (
            <div key={`${job.title}-${index}`} style={{ marginBottom: '12px', paddingLeft: '12px', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontWeight: '600', fontSize: '14px' }}>{job.title}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>{job.company} • {job.duration}</div>
              {job.highlights?.slice(0, 2).map((highlight, highlightIndex) => (
                <div key={`${job.title}-${highlightIndex}`} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '2px' }}>• {highlight}</div>
              ))}
            </div>
          )) : <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>No work experience was saved in this analysis.</p>}
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Education</h3>
          {selectedEducation.length ? selectedEducation.map((edu, index) => (
            <div key={`${edu.degree}-${index}`} style={{ marginBottom: '8px' }}>
              <div style={{ fontWeight: '600', fontSize: '14px' }}>{edu.degree}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{edu.institution} • {edu.year}{edu.gpa ? ` • GPA: ${edu.gpa}` : ''}</div>
            </div>
          )) : <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>No education details were saved in this analysis.</p>}
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Projects</h3>
          {selectedProjects.length ? selectedProjects.map((project, index) => (
            <div key={`${project.name}-${index}`} style={{ marginBottom: '8px' }}>
              <div style={{ fontWeight: '600', fontSize: '14px' }}>{project.name}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{project.description || 'No description saved.'}</div>
            </div>
          )) : <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>No projects were saved in this analysis.</p>}
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Strengths</h3>
          {selectedStrengths.length ? selectedStrengths.map((strength, index) => (
            <div key={`${strength}-${index}`} style={{ fontSize: '13px', color: '#22c55e', marginBottom: '4px' }}>✓ {strength}</div>
          )) : <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>No strengths were saved in this analysis.</p>}
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Areas to improve</h3>
          {selectedAreasToImprove.length ? selectedAreasToImprove.map((area, index) => (
            <div key={`${area}-${index}`} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>→ {area}</div>
          )) : <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>No improvement areas were saved in this analysis.</p>}
        </div>

        <button
          type="button"
          onClick={() => import('@/lib/generateReport').then(({ generateAnalysisReport }) => generateAnalysisReport(resumeData))}
          style={{
            width: '100%',
            padding: '12px',
            background: 'white',
            color: 'black',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            marginTop: '20px',
          }}
        >
          ⬇️ Download PDF Report
        </button>
      </div>
    );
  }

  function renderBatchDetail(item) {
    return (
      <div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Selected batch run</p>
        <h2 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 4px' }}>{item?.jobTitle || 'Batch Review'}</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 12px' }}>
          {item?.companyName || 'Recruiter Batch'} • {formatDate(item?.created_at)}
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ padding: '8px 16px', borderRadius: '8px', background: `${getScoreColor(item?.averageScore || 0)}20`, border: `1px solid ${getScoreColor(item?.averageScore || 0)}40`, color: getScoreColor(item?.averageScore || 0), fontWeight: '700', fontSize: '18px' }}>
            {Math.round(item?.averageScore || 0)}% Avg
          </div>
          <div style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
            {item?.totalResumes || 0} candidates
          </div>
          <div style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
            {item?.recommendation || 'Review manually'}
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Top candidate</h3>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>{item?.topCandidate || '--'}</p>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Candidate matches</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {(item?.results || []).map((candidate, index) => (
              <div key={`${candidate.candidateName}-${index}`} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ fontWeight: '600' }}>{candidate.candidateName}</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{candidate.recommendation}</div>
                  </div>
                  <div style={{ color: getScoreColor(candidate.matchScore), fontWeight: '700' }}>{Math.round(candidate.matchScore)}%</div>
                </div>
                {candidate.summary ? <p style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>{candidate.summary}</p> : null}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => import('@/lib/generateReport').then(({ generateAnalysisReport }) => generateAnalysisReport({
            candidateName: item?.jobTitle || 'Batch Review',
            overallScore: item?.averageScore || 0,
            hiringRecommendation: item?.recommendation || 'Review manually',
            profileSummary: `${item?.companyName || 'Recruiter Batch'} • ${item?.totalResumes || 0} candidates`,
            technicalSkills: [],
            strengths: [],
            areasToImprove: [],
          }, {
            matchScore: item?.averageScore || 0,
            recommendation: item?.recommendation || 'Review manually',
            matchedSkills: [],
            missingSkills: [],
            summary: `${item?.totalResumes || 0} candidate batch loaded from Supabase job_matches.`,
          }))}
          style={{
            width: '100%',
            padding: '12px',
            background: 'white',
            color: 'black',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            marginTop: '20px',
          }}
        >
          ⬇️ Download PDF Report
        </button>
      </div>
    );
  }

  const listEmptyMessage = activeTab === 'analyses'
    ? 'No candidate analyses have been saved in Supabase yet.'
    : 'No batch runs were found in Supabase yet.';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a1a', color: 'white', padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>SESSION HISTORY</p>
        <h1 style={{ fontSize: '32px', fontWeight: '700', margin: '0 0 8px' }}>Your analyses and batch runs</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
          Loaded directly from Supabase — {analyses.length} analyses and {batches.length} batch runs found
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveTab('analyses')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'analyses' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          My Analyses
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('batches')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'batches' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          Batch Runs
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder={activeTab === 'analyses' ? 'Search by candidate name...' : 'Search by job title or company...'}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '10px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={loadHistory}
          style={{
            padding: '10px 20px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          🔄 Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px', alignItems: 'start' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>Loading history from Supabase...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>{searchQuery ? 'No results found.' : listEmptyMessage}</div>
          ) : (
            filtered.map((item) => {
              const isSelected = selectedItem?.id === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelected(item)}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                    transition: 'background 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '12px' }}>
                    <span style={{ fontWeight: '600', fontSize: '15px' }}>{item.title || item.jobTitle || 'Unknown'}</span>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: getScoreColor(item.score || item.averageScore || 0) }}>
                      {Math.round(item.score || item.averageScore || 0)}%
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>{item.subtitle || item.companyName || 'No email'}</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '20px',
                        background: `${getRecommendationBadge(item.recommendation)}20`,
                        color: getRecommendationBadge(item.recommendation),
                        border: `1px solid ${getRecommendationBadge(item.recommendation)}40`,
                      }}
                    >
                      {item.recommendation || 'Review manually'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{formatDate(item.created_at || item.raw?.created_at)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px', minHeight: '400px' }}>
          {!selectedItem ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>
              Select an analysis to view details
            </div>
          ) : activeTab === 'analyses' ? (
            renderAnalysisDetail(selectedItem)
          ) : (
            renderBatchDetail(selectedItem)
          )}
        </div>
      </div>
    </div>
  );
}