import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';

import { getSupabaseClient } from '@/lib/supabaseClient';
import { sanitizeText } from '@/lib/input-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function normalizeArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function coerceObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value;
}

function parseJsonResponse(text) {
  const cleanText = String(text || '').replace(/```json|```/gi, '').trim();

  if (!cleanText) {
    throw new Error('Groq response was empty.');
  }

  try {
    return JSON.parse(cleanText);
  } catch {
    const match = cleanText.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error('Groq response did not contain valid JSON.');
    }

    return JSON.parse(match[0]);
  }
}

function buildResumeSnapshot(resumeData, rawText) {
  const data = coerceObject(resumeData) || {};

  return {
    candidateName: String(data.name || data.candidateName || '').trim(),
    summary: String(data.summary || data.profileSummary || '').trim(),
    technicalSkills: normalizeArray(data.technicalSkills || data.skills),
    softSkills: normalizeArray(data.softSkills),
    frameworks: normalizeArray(data.frameworks),
    databases: normalizeArray(data.databases),
    tools: normalizeArray(data.tools),
    languages: normalizeArray(data.languages),
    workExperience: Array.isArray(data.workExperience) ? data.workExperience : [],
    education: Array.isArray(data.education) ? data.education : [],
    projects: Array.isArray(data.projects) ? data.projects : [],
    rawText: String(rawText || '').trim().slice(0, 5000),
  };
}

function buildMatchPrompt({ resumeSnapshot, jobTitle, jobDescription }) {
  return `You are an expert technical recruiter.
Compare the candidate resume against the job description and return ONLY raw JSON. No markdown. No backticks.

CANDIDATE RESUME:
${JSON.stringify(resumeSnapshot)}

JOB TITLE: ${String(jobTitle || 'Unknown').trim() || 'Unknown'}

JOB DESCRIPTION:
${String(jobDescription || '').trim()}

Return exactly this JSON shape:
{
  "overallScore": 75,
  "matchedSkills": ["React", "Node.js", "CSS"],
  "missingSkills": ["Docker", "AWS"],
  "recommendation": "Strong Match",
  "summary": "2-3 sentence explanation of the match"
}`;
}

function normalizeMatchResult(rawResult) {
  const data = rawResult && typeof rawResult === 'object' ? rawResult : {};
  const overallScore = Number(data.overallScore ?? data.matchScore ?? 0);
  const safeScore = Number.isFinite(overallScore) ? Math.max(0, Math.min(100, Math.round(overallScore))) : 0;

  return {
    overallScore: safeScore,
    matchScore: safeScore,
    matchedSkills: normalizeArray(data.matchedSkills),
    missingSkills: normalizeArray(data.missingSkills),
    recommendation: String(data.recommendation || '').trim() || (safeScore >= 80 ? 'Strong Match' : safeScore >= 60 ? 'Good Match' : 'Weak Match'),
    summary: String(data.summary || '').trim(),
  };
}

async function getGroqMatchResult({ resumeSnapshot, jobTitle, jobDescription }) {
  const apiKey = String(process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured.');
  }

  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama3-8b-8192',
    temperature: 0.1,
    max_tokens: 1200,
    messages: [
      {
        role: 'user',
        content: buildMatchPrompt({ resumeSnapshot, jobTitle, jobDescription }),
      },
    ],
  });

  const content = completion?.choices?.[0]?.message?.content || '';
  return normalizeMatchResult(parseJsonResponse(content));
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const analysisId = String(body?.analysisId || '').trim();
    const jobTitle = sanitizeText(body?.jobTitle);
    const jobDescription = sanitizeText(body?.jobDescription);

    if (!analysisId) {
      return NextResponse.json({ error: 'analysisId is required.' }, { status: 400 });
    }

    if (!jobDescription) {
      return NextResponse.json({ error: 'jobDescription is required.' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { data: analysis, error } = await supabase
      .from('analyses')
      .select('id, resume_data, raw_text, created_at, user_id')
      .eq('id', analysisId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error?.message || 'Failed to fetch analysis.' },
        { status: error?.status || 500 }
      );
    }

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found.' }, { status: 404 });
    }

    const resumeSnapshot = buildResumeSnapshot(analysis.resume_data, analysis.raw_text);
    const matchResult = await getGroqMatchResult({ resumeSnapshot, jobTitle, jobDescription });

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        analysisId,
        matchResult,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = String(error?.message || 'Job matching failed. Please try again.');

    return NextResponse.json(
      {
        error: message.includes('GROQ_API_KEY')
          ? 'Server configuration error. Contact admin to set GROQ_API_KEY in Vercel.'
          : 'Job matching failed. Please try again.',
      },
      { status: 500 }
    );
  }
}
