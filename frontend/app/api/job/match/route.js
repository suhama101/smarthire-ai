// REQUIRED ENV VAR: ANTHROPIC_API_KEY
// Add this in Vercel Dashboard -> Project -> Settings -> Environment Variables
// Value: your Anthropic API key from https://console.anthropic.com

import { NextResponse } from 'next/server';
import { checkRateLimit } from '../../../../src/lib/rate-limit';
import { sanitizeText } from '../../../../src/lib/input-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

function normalizeArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function clampScore(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function parseJsonResponse(text) {
  const cleanText = String(text || '').replace(/```json|```/gi, '').trim();

  try {
    return JSON.parse(cleanText);
  } catch {
    const match = cleanText.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error('Claude response did not contain valid JSON.');
    }

    return JSON.parse(match[0]);
  }
}

function normalizeMatchData(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};

  return {
    matchScore: clampScore(data.matchScore ?? data.overallScore),
    matchedSkills: normalizeArray(data.matchedSkills),
    missingSkills: normalizeArray(data.missingSkills),
    niceToHaveSkills: normalizeArray(data.niceToHaveSkills),
    experienceFit: String(data.experienceFit || '').trim(),
    recommendation: ['Highly Recommended', 'Consider with Reservations', 'Not Recommended'].includes(data.recommendation)
      ? data.recommendation
      : 'Consider with Reservations',
    recommendationReason: String(data.recommendationReason || '').trim(),
  };
}

async function analyzeMatch(candidateProfile, jobTitle, jobDescription) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();

  if (!apiKey) {
    const error = new Error('ANTHROPIC_API_KEY is not configured.');
    error.status = 503;
    throw error;
  }

  const prompt = `You are an expert recruiter. Compare this candidate profile against the job description and return a JSON object with:
- matchScore (0-100 integer)
- matchedSkills (array of strings)
- missingSkills (array of strings)
- niceToHaveSkills (array of strings)
- experienceFit (string, 2-3 sentences)
- recommendation (one of: Highly Recommended, Consider with Reservations, Not Recommended)
- recommendationReason (string, 1-2 sentences)
Candidate Profile: ${JSON.stringify(candidateProfile)}
Job Title: ${String(jobTitle || '').trim()}
Job Description: ${String(jobDescription || '').trim()}`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1400,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude request failed with status ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  const text = (Array.isArray(payload?.content) ? payload.content : [])
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('Claude returned an empty response.');
  }

  return normalizeMatchData(parseJsonResponse(text));
}

export async function POST(request) {
  try {
    const rateLimit = checkRateLimit(request, 'job-match');

    if (rateLimit.limited) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 1) } });
    }

    const body = await request.json();
    const candidateProfile = body?.candidateProfile;
    const jobTitle = sanitizeText(body?.jobTitle);
    const jobDescription = sanitizeText(body?.jobDescription);

    if (!candidateProfile || typeof candidateProfile !== 'object') {
      return NextResponse.json({ error: 'candidateProfile is required.' }, { status: 400 });
    }

    if (!jobDescription) {
      return NextResponse.json({ error: 'jobDescription is required.' }, { status: 400 });
    }

    const matchData = await analyzeMatch(candidateProfile, jobTitle, jobDescription);

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        ...matchData,
      },
      { status: 200 }
    );
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message = error?.message || 'Job matching failed.';
    const isAuthIssue = message.includes('ANTHROPIC_API_KEY');
    const isTemporary = /Claude request failed|empty response|invalid JSON/i.test(message);

    return NextResponse.json(
      {
        error: isAuthIssue
          ? message
          : isTemporary
            ? 'AI analysis temporarily unavailable. Please try again in a moment.'
            : 'Job matching failed. Please try again.',
      },
      { status: status >= 400 ? status : 500 }
    );
  }
}