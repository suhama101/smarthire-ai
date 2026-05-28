import crypto from 'node:crypto';

import { NextResponse } from 'next/server';

import { getSupabaseClient } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_USER_ID = 'public-user';

function buildResumeData(result, jobTitle, companyName) {
  const candidate = result?.data && typeof result.data === 'object' ? result.data : result;

  return {
    candidateName: String(candidate?.candidateName || candidate?.name || result?.fileName || 'Candidate').trim(),
    email: String(candidate?.email || '').trim(),
    phone: String(candidate?.phone || '').trim(),
    overallScore: Number(candidate?.matchScore ?? candidate?.overallScore ?? candidate?.score) || 0,
    hiringRecommendation: String(candidate?.recommendation || candidate?.hiringRecommendation || 'Review').trim(),
    experienceLevel: String(candidate?.experienceLevel || '').trim(),
    technicalSkills: Array.isArray(candidate?.technicalSkills) ? candidate.technicalSkills : [],
    matchedSkills: Array.isArray(candidate?.matchedSkills) ? candidate.matchedSkills : [],
    missingSkills: Array.isArray(candidate?.missingSkills) ? candidate.missingSkills : [],
    summary: String(candidate?.summary || '').trim(),
    jobTitle,
    companyName,
    isBatchResult: true,
    fileName: String(result?.fileName || candidate?.sourceFileName || candidate?.fileName || '').trim(),
  };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || body.user_id || '').trim() || DEFAULT_USER_ID;
    const jobDescription = String(body.jobDescription || body.job_description || '').trim();
    const jobTitle = String(body.jobTitle || body.job_title || '').trim();
    const companyName = String(body.companyName || body.company_name || '').trim();
    const incomingResults = Array.isArray(body.results) ? body.results : [];
    const incomingCandidates = Array.isArray(body.candidates) ? body.candidates : [];

    if (!jobDescription) {
      return NextResponse.json({ error: 'jobDescription is required.' }, { status: 400 });
    }

    const resultsToSave = incomingResults.length > 0
      ? incomingResults
      : incomingCandidates.map((candidate) => ({
          success: true,
          fileName: candidate?.sourceFileName || candidate?.fileName || candidate?.name || 'candidate',
          data: candidate,
        }));

    if (!resultsToSave.length) {
      return NextResponse.json({ error: 'candidates must be a non-empty array.' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase credentials are not configured.' }, { status: 500 });
    }

    let savedAnalyses = 0;

    for (const result of resultsToSave) {
      if (!result?.success) {
        continue;
      }

      const resumeData = buildResumeData(result, jobTitle, companyName);

      const { error } = await supabase.from('analyses').insert({
        id: crypto.randomUUID(),
        user_id: userId,
        resume_data: resumeData,
        raw_text: String(result?.data?.summary || result?.summary || '').trim(),
        created_at: new Date().toISOString(),
      });

      if (error) {
        return NextResponse.json(
          { error: error?.message || 'Failed to save batch run.' },
          { status: error?.status || 500 }
        );
      }

      savedAnalyses += 1;
    }

    return NextResponse.json(
      {
        message: 'Batch results saved successfully.',
        savedAnalyses,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: err?.message || 'Failed to save batch run.',
      },
      { status: 500 }
    );
  }
}