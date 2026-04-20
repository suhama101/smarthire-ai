import { NextResponse } from 'next/server';
import { checkRateLimit } from '../../../../src/lib/rate-limit';
import { sanitizeText } from '../../../../src/lib/input-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

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

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeProfile(profile) {
  const safeProfile = profile && typeof profile === 'object' ? profile : {};

  return {
    name: String(safeProfile.name || safeProfile.fullName || safeProfile.candidateName || '').trim(),
    email: String(safeProfile.email || '').trim(),
    title: String(safeProfile.title || safeProfile.headline || '').trim(),
    summary: String(safeProfile.summary || '').trim(),
    skills: normalizeStringArray(safeProfile.skills),
    matchedSkills: normalizeStringArray(safeProfile.matchedSkills),
    missingSkills: normalizeStringArray(safeProfile.missingSkills),
    experience: Array.isArray(safeProfile.experience) ? safeProfile.experience : [],
    education: Array.isArray(safeProfile.education) ? safeProfile.education : [],
    yearsExperience: Number.isFinite(Number(safeProfile.yearsExperience)) ? Number(safeProfile.yearsExperience) : null,
  };
}

function normalizeBatchResult(raw, fallbackContext) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const profile = normalizeProfile(data.profile || fallbackContext.profile);

  const matchedSkills = normalizeStringArray(data.matchedSkills);
  const missingSkills = normalizeStringArray(data.missingSkills);

  return {
    candidateName: String(data.candidateName || profile.name || `Candidate ${fallbackContext.candidateIndex || 1}`).trim(),
    matchScore: Number.isFinite(Number(data.matchScore)) ? Math.max(0, Math.min(100, Math.round(Number(data.matchScore)))) : 0,
    matchedSkills,
    missingSkills,
    experienceFit: ['Strong', 'Moderate', 'Weak'].includes(String(data.experienceFit || '').trim())
      ? String(data.experienceFit).trim()
      : 'Moderate',
    recommendation: String(data.recommendation || 'Review manually').trim(),
    profile,
  };
}

async function callClaude(jobTitle, companyName, jobDescription, resumeText, candidateIndex) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();

  if (!apiKey) {
    const error = new Error('ANTHROPIC_API_KEY is not configured.');
    error.status = 503;
    throw error;
  }

  const prompt = `You are a recruiter assistant. Extract the candidate profile from the resume text, then match it against the job description and return a single JSON object with this exact structure:
{
  "candidateName": string,
  "matchScore": number,
  "matchedSkills": string[],
  "missingSkills": string[],
  "experienceFit": "Strong" | "Moderate" | "Weak",
  "recommendation": string,
  "profile": {
    "name": string,
    "email": string,
    "title": string,
    "summary": string,
    "skills": string[],
    "matchedSkills": string[],
    "missingSkills": string[],
    "experience": [{"title": string, "company": string, "duration": string, "description": string}],
    "education": [{"degree": string, "institution": string, "year": string}],
    "yearsExperience": number
  }
}

Rules:
- Return valid JSON only.
- Match score must be between 0 and 100.
- Keep matchedSkills and missingSkills concise and deduplicated.
- Use the profile object to preserve candidate details.
- Company: ${String(companyName || '').trim() || 'Unknown Company'}
- Job title: ${String(jobTitle || '').trim() || 'Unknown Role'}
- Candidate index: ${Number(candidateIndex || 1)}

Resume text:
${String(resumeText || '').trim()}

Job description:
${String(jobDescription || '').trim()}`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2200,
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

  return normalizeBatchResult(parseJsonResponse(text), { candidateIndex });
}

export async function POST(request) {
  try {
    const rateLimit = checkRateLimit(request, 'batch-analyze');

    if (rateLimit.limited) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 1) } });
    }

    const body = await request.json();
    const jobTitle = sanitizeText(body?.jobTitle);
    const companyName = sanitizeText(body?.companyName);
    const jobDescription = sanitizeText(body?.jobDescription);
    const resumeText = sanitizeText(body?.resumeText);
    const candidateIndex = Number(body?.candidateIndex || 1);

    if (!jobTitle || !companyName || !jobDescription || !resumeText) {
      return NextResponse.json({ error: 'jobTitle, companyName, jobDescription, and resumeText are required.' }, { status: 400 });
    }

    const result = await callClaude(jobTitle, companyName, jobDescription, resumeText, candidateIndex);

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        ...result,
      },
      { status: 200 }
    );
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message = error?.message || 'Batch analysis failed.';
    const isAuthIssue = message.includes('ANTHROPIC_API_KEY');
    const isTemporary = /Claude request failed|empty response|invalid JSON/i.test(message);

    return NextResponse.json(
      {
        error: isAuthIssue
          ? message
          : isTemporary
            ? 'AI analysis temporarily unavailable. Please try again in a moment.'
            : 'Batch analysis failed. Please try again.',
      },
      { status: status >= 400 ? status : 500 }
    );
  }
}