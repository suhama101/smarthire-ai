// REQUIRED ENV VAR: GEMINI_API_KEY
// Add this in Vercel Dashboard -> Project -> Settings -> Environment Variables
// Value: your Gemini API key from https://aistudio.google.com/apikey

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkRateLimit } from '../../../../src/lib/rate-limit';
import { sanitizeText } from '../../../../src/lib/input-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const GEMINI_MODEL = 'gemini-2.5-flash';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
const JOB_SKILL_KEYWORDS = [
  'javascript', 'typescript', 'react', 'next.js', 'node.js', 'express', 'python', 'java', 'sql', 'postgresql',
  'mysql', 'mongodb', 'redis', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'html', 'css',
  'tailwind', 'redux', 'graphql', 'testing', 'jest', 'cypress', 'playwright', 'git', 'devops', 'accessibility',
  'api', 'frontend', 'backend', 'cloud', 'security', 'architecture', 'product', 'leadership', 'communication',
];

function parseJsonResponse(text) {
  const cleanText = String(text || '').replace(/```json|```/gi, '').trim();

  try {
    return JSON.parse(cleanText);
  } catch {
    const match = cleanText.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error('Gemini response did not contain valid JSON.');
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

function dedupeStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeKeywordLabel(value) {
  const text = String(value || '');

  if (/next\.js|nextjs/i.test(text)) return 'Next.js';
  if (/node\.js/i.test(text)) return 'Node.js';
  if (/gcp/i.test(text)) return 'GCP';
  if (/aws/i.test(text)) return 'AWS';
  if (/azure/i.test(text)) return 'Azure';
  if (/ci\/cd/i.test(text)) return 'CI/CD';
  if (/sql/i.test(text)) return 'SQL';
  if (/api/i.test(text)) return 'APIs';
  if (/ui/i.test(text)) return 'UI';
  if (/ux/i.test(text)) return 'UX';

  return text;
}

function extractSkills(text) {
  const normalized = String(text || '').toLowerCase();
  return dedupeStrings(JOB_SKILL_KEYWORDS.filter((skill) => normalized.includes(skill)).map(normalizeKeywordLabel));
}

function buildFallbackMatch(candidateProfile, jobTitle, jobDescription, candidateIndex) {
  const profile = candidateProfile && typeof candidateProfile === 'object' ? candidateProfile : {};
  const candidateSkills = extractSkills(`${JSON.stringify(profile)} ${String(profile.summary || '')}`);
  const jobSkills = extractSkills(`${jobTitle} ${jobDescription}`);
  const matchedSkills = candidateSkills.filter((skill) => jobSkills.some((jobSkill) => skill.toLowerCase() === jobSkill.toLowerCase() || skill.toLowerCase().includes(jobSkill.toLowerCase()) || jobSkill.toLowerCase().includes(skill.toLowerCase())));
  const missingSkills = jobSkills.filter((skill) => !matchedSkills.some((matched) => matched.toLowerCase() === skill.toLowerCase()));
  const overlapRatio = matchedSkills.length / Math.max(jobSkills.length || 1, 1);
  const matchScore = Math.max(25, Math.min(95, Math.round(overlapRatio * 100)));
  const recommendation = matchScore >= 80 ? 'Highly Recommended' : matchScore >= 60 ? 'Consider with Reservations' : 'Not Recommended';

  return normalizeBatchResult(
    {
      candidateName: profile.name || profile.fullName || profile.candidateName || `Candidate ${candidateIndex || 1}`,
      matchScore,
      matchedSkills,
      missingSkills,
      experienceFit: matchScore >= 80 ? 'Strong' : matchScore >= 60 ? 'Moderate' : 'Weak',
      recommendation,
      profile: {
        name: profile.name || profile.fullName || profile.candidateName || `Candidate ${candidateIndex || 1}`,
        email: profile.email || '',
        title: profile.title || jobTitle || '',
        summary: profile.summary || '',
        skills: candidateSkills,
        matchedSkills,
        missingSkills,
        experience: Array.isArray(profile.experience) ? profile.experience : [],
        education: Array.isArray(profile.education) ? profile.education : [],
        yearsExperience: Number.isFinite(Number(profile.yearsExperience)) ? Number(profile.yearsExperience) : null,
      },
    },
    { candidateIndex, profile }
  );
}

async function extractResumeFromBase64(fileBase64, fileName, mimeType) {
  const buffer = Buffer.from(String(fileBase64 || ''), 'base64');
  const extension = String(fileName || '').toLowerCase().split('.').pop();
  const normalizedMime = String(mimeType || '').toLowerCase();

  if (normalizedMime === 'application/pdf' || extension === 'pdf') {
    return { buffer, text: '' };
  }

  if (normalizedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extension === 'docx') {
    try {
      const mammothModule = await import('mammoth');
      const mammoth = mammothModule.default || mammothModule;
      const result = await mammoth.extractRawText({ buffer });
      return { buffer, text: String(result?.value || '').replace(/\s+/g, ' ').trim() };
    } catch {
      return { buffer, text: buffer.toString('utf8').replace(/\s+/g, ' ').trim() };
    }
  }

  return { buffer, text: buffer.toString('utf8').replace(/\s+/g, ' ').trim() };
}

function buildGeminiPrompt(jobTitle, companyName, jobDescription, candidateIndex) {
  return `You are an expert recruiter. Read this resume and compare it against this job: "${String(jobTitle || '').trim()}".
Job Description: "${String(jobDescription || '').trim()}"

Return ONLY a JSON object with:
{
  "candidateName": "string",
  "matchScore": number (0-100),
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill1", "skill2"],
  "recommendation": "Highly Recommended|Consider|Not Recommended",
  "experienceFit": "string (1 sentence)",
  "profile": {
    "name": "string",
    "email": "string",
    "title": "string",
    "summary": "string",
    "skills": ["skill1", "skill2"],
    "matchedSkills": ["skill1", "skill2"],
    "missingSkills": ["skill1", "skill2"],
    "experience": [{"title": "string", "company": "string", "duration": "string", "description": "string"}],
    "education": [{"degree": "string", "institution": "string", "year": "string"}],
    "yearsExperience": number
  }
}

Rules:
- Return valid JSON only.
- Match score must be between 0 and 100.
- Keep matchedSkills and missingSkills concise and deduplicated.
- Use the profile object to preserve candidate details.
- Company: ${String(companyName || '').trim() || 'Unknown Company'}
- Candidate index: ${Number(candidateIndex || 1)}
- Return ONLY valid JSON. No markdown. No explanation.`;
}

async function callGemini(jobTitle, companyName, jobDescription, fileBase64, fileName, mimeType, candidateIndex) {
  const resume = await extractResumeFromBase64(fileBase64, fileName, mimeType);

  if (!String(process.env.GEMINI_API_KEY || '').trim()) {
    if (resume.text) {
      return buildFallbackMatch({ summary: resume.text }, jobTitle, jobDescription, candidateIndex);
    }

    const error = new Error('GEMINI_API_KEY not set');
    error.status = 500;
    throw error;
  }

  const isPdf = String(mimeType || '').toLowerCase() === 'application/pdf' || String(fileName || '').toLowerCase().endsWith('.pdf');
  const content = isPdf
    ? [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: String(fileBase64 || ''),
          },
        },
        {
          text: buildGeminiPrompt(jobTitle, companyName, jobDescription, candidateIndex),
        },
      ]
    : [
        {
          text: `${buildGeminiPrompt(jobTitle, companyName, jobDescription, candidateIndex)}\n\nResume text:\n${String(resume.text || '').trim()}`,
        },
      ];

  const result = await model.generateContent(content);
  const text = String(result?.response?.text?.() || '').trim();

  if (!text) {
    throw new Error('Gemini returned an empty response.');
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
    const fileBase64 = String(body?.fileBase64 || '').trim();
    const fileName = String(body?.fileName || '').trim();
    const mimeType = String(body?.mimeType || '').trim();
    const jobTitle = sanitizeText(body?.jobTitle);
    const jobDescription = sanitizeText(body?.jobDescription);
    const candidateIndex = Number(body?.candidateIndex || 1);
    const companyName = sanitizeText(body?.companyName || 'Recruiter Batch');

    if (!jobTitle || !jobDescription || !fileBase64 || !fileName) {
      return NextResponse.json({ error: 'fileBase64, fileName, jobTitle, and jobDescription are required.' }, { status: 400 });
    }

    const result = await callGemini(jobTitle, companyName, jobDescription, fileBase64, fileName, mimeType, candidateIndex);

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
    const isAuthIssue = message.includes('GEMINI_API_KEY');
    const isTemporary = /Gemini request failed|empty response|invalid JSON/i.test(message);

    return NextResponse.json(
      {
        error: isTemporary
            ? 'AI analysis temporarily unavailable. Please try again in a moment.'
            : isAuthIssue
              ? 'Server configuration error. Contact admin to set GEMINI_API_KEY in Vercel.'
              : 'Batch analysis failed. Please try again.',
      },
      { status: status >= 400 ? status : 500 }
    );
  }
}