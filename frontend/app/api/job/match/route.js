// REQUIRED ENV VAR: GEMINI_API_KEY
// Add this in Vercel Dashboard -> Project -> Settings -> Environment Variables
// Value: your Gemini API key from https://aistudio.google.com/apikey

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkRateLimit } from '../../../../src/lib/rate-limit';
import { sanitizeText } from '../../../../src/lib/input-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GEMINI_MODEL = 'gemini-2.5-flash';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
const JOB_SKILL_KEYWORDS = [
  'javascript', 'typescript', 'react', 'next.js', 'node.js', 'express', 'python', 'java', 'sql', 'postgresql',
  'mysql', 'mongodb', 'redis', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'html', 'css',
  'tailwind', 'redux', 'graphql', 'testing', 'jest', 'cypress', 'playwright', 'git', 'devops', 'accessibility',
  'api', 'frontend', 'backend', 'cloud', 'security', 'architecture', 'product', 'leadership', 'communication',
];

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
      throw new Error('Gemini response did not contain valid JSON.');
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

function dedupeStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function extractSkills(text) {
  const normalized = String(text || '').toLowerCase();

  return dedupeStrings(
    JOB_SKILL_KEYWORDS.filter((skill) => normalized.includes(skill)).map((skill) => {
      if (/next\.js|nextjs/i.test(skill)) return 'Next.js';
      if (/node\.js/i.test(skill)) return 'Node.js';
      if (/gcp/i.test(skill)) return 'GCP';
      if (/aws/i.test(skill)) return 'AWS';
      if (/azure/i.test(skill)) return 'Azure';
      if (/ci\/cd/i.test(skill)) return 'CI/CD';
      if (/sql/i.test(skill)) return 'SQL';
      if (/api/i.test(skill)) return 'APIs';
      if (/ui/i.test(skill)) return 'UI';
      if (/ux/i.test(skill)) return 'UX';
      return skill;
    })
  );
}

function buildFallbackMatch(candidateProfile, jobTitle, jobDescription) {
  const profile = candidateProfile && typeof candidateProfile === 'object' ? candidateProfile : {};
  const candidateSkills = extractSkills(`${JSON.stringify(profile)} ${String(profile.summary || '')}`);
  const jobSkills = extractSkills(`${jobTitle} ${jobDescription}`);
  const matchedSkills = candidateSkills.filter((skill) => jobSkills.some((jobSkill) => skill.toLowerCase() === jobSkill.toLowerCase() || skill.toLowerCase().includes(jobSkill.toLowerCase()) || jobSkill.toLowerCase().includes(skill.toLowerCase())));
  const missingSkills = jobSkills.filter((skill) => !matchedSkills.some((matched) => matched.toLowerCase() === skill.toLowerCase()));
  const overlapRatio = matchedSkills.length / Math.max(jobSkills.length || 1, 1);
  const matchScore = Math.max(25, Math.min(95, Math.round(overlapRatio * 100)));

  return normalizeMatchData({
    matchScore,
    matchedSkills,
    missingSkills,
    niceToHaveSkills: missingSkills.slice(0, 3),
    experienceFit: matchScore >= 80 ? 'Strong' : matchScore >= 60 ? 'Moderate' : 'Weak',
    recommendation: matchScore >= 80 ? 'Highly Recommended' : matchScore >= 60 ? 'Consider with Reservations' : 'Not Recommended',
    recommendationReason: 'Fallback analysis used because GEMINI_API_KEY is not configured.',
  });
}

async function analyzeMatch(candidateProfile, jobTitle, jobDescription) {
  if (!String(process.env.GEMINI_API_KEY || '').trim()) {
    return buildFallbackMatch(candidateProfile, jobTitle, jobDescription);
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

  const result = await model.generateContent(prompt);
  const text = String(result?.response?.text?.() || '').trim();

  if (!text) {
    throw new Error('Gemini returned an empty response.');
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
    const isAuthIssue = message.includes('GEMINI_API_KEY');
    const isTemporary = /Gemini request failed|empty response|invalid JSON/i.test(message);

    return NextResponse.json(
      {
        error: isTemporary
            ? 'AI analysis temporarily unavailable. Please try again in a moment.'
            : isAuthIssue
              ? 'Server configuration error. Contact admin to set GEMINI_API_KEY in Vercel.'
              : 'Job matching failed. Please try again.',
      },
      { status: status >= 400 ? status : 500 }
    );
  }
}