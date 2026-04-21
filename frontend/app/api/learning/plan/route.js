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

const GEMINI_MODEL = 'gemini-1.5-flash';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

function dedupeStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
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

function normalizeArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeLearningPlan(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};

  return {
    totalWeeks: Number.isFinite(Number(data.totalWeeks)) ? Math.max(1, Math.round(Number(data.totalWeeks))) : 4,
    readinessLabel: ['Almost Ready', 'Needs Work', 'Major Gaps'].includes(data.readinessLabel)
      ? data.readinessLabel
      : 'Needs Work',
    skillModules: Array.isArray(data.skillModules)
      ? data.skillModules.map((module) => ({
          skillName: String(module?.skillName || '').trim(),
          priority: ['High', 'Medium', 'Low'].includes(String(module?.priority || '').trim())
            ? String(module.priority).trim()
            : 'Medium',
          whyNeeded: String(module?.whyNeeded || '').trim(),
          resources: Array.isArray(module?.resources)
            ? module.resources.map((resource) => ({
                name: String(resource?.name || '').trim(),
                type: String(resource?.type || '').trim(),
                estimatedTime: String(resource?.estimatedTime || '').trim(),
                url: String(resource?.url || '').trim(),
              }))
            : [],
          miniProject: String(module?.miniProject || '').trim(),
        }))
      : [],
    weeklySchedule: Array.isArray(data.weeklySchedule)
      ? data.weeklySchedule.map((week) => ({
          week: Number.isFinite(Number(week?.week)) ? Math.max(1, Math.round(Number(week.week))) : 1,
          focusArea: String(week?.focusArea || '').trim(),
          goal: String(week?.goal || '').trim(),
        }))
      : [],
    quickWins: normalizeArray(data.quickWins).slice(0, 3),
  };
}

function buildFallbackLearningPlan(candidateProfile, jobTitle, jobDescription, matchResult) {
  const missingSkills = dedupeStrings(matchResult?.missingSkills || []);
  const quickWins = missingSkills.slice(0, 3);
  const totalWeeks = Math.max(2, Math.min(8, Math.ceil((missingSkills.length || 4) / 2)));
  const score = Number(matchResult?.matchScore || 0);
  const readinessLabel = score >= 80 ? 'Almost Ready' : score >= 60 ? 'Needs Work' : 'Major Gaps';

  return normalizeLearningPlan({
    totalWeeks,
    readinessLabel,
    skillModules: missingSkills.slice(0, 4).map((skill, index) => ({
      skillName: skill,
      priority: index === 0 ? 'High' : 'Medium',
      whyNeeded: `This role emphasizes ${skill} for ${String(jobTitle || 'the target role').trim()}.`,
      resources: [],
      miniProject: `Build a small ${skill} project aligned to the role responsibilities.`,
    })),
    weeklySchedule: Array.from({ length: totalWeeks }, (_, index) => ({
      week: index + 1,
      focusArea: index < missingSkills.length ? missingSkills[index] : 'Role alignment',
      goal: index < missingSkills.length ? `Close the gap in ${missingSkills[index]}.` : 'Polish portfolio and interview readiness.',
    })),
    quickWins: quickWins.length ? quickWins : ['Review role requirements', 'Refresh resume summary', 'Prepare project examples'],
  });
}

async function generateLearningPlan(candidateProfile, jobTitle, jobDescription, matchResult) {
  if (!String(process.env.GEMINI_API_KEY || '').trim()) {
    return buildFallbackLearningPlan(candidateProfile, jobTitle, jobDescription, matchResult);
  }

  const prompt = `You are a career coach and learning designer. Based on this candidate profile, job description, and match analysis, create a detailed personalized learning plan. Return a JSON object with:
- totalWeeks (integer)
- readinessLabel (one of: Almost Ready, Needs Work, Major Gaps)
- skillModules (array of { skillName, priority, whyNeeded, resources: [{name, type, estimatedTime, url}], miniProject })
- weeklySchedule (array of {week, focusArea, goal})
- quickWins (array of 3 strings)
Candidate Profile: ${JSON.stringify(candidateProfile)}
Job Title: ${String(jobTitle || '').trim()}
Missing Skills: ${JSON.stringify(matchResult?.missingSkills || [])}
Match Score: ${Number(matchResult?.matchScore || 0)}`;

  const result = await model.generateContent(prompt);
  const text = String(result?.response?.text?.() || '').trim();

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return normalizeLearningPlan(parseJsonResponse(text));
}

export async function POST(request) {
  try {
    const rateLimit = checkRateLimit(request, 'learning-plan');

    if (rateLimit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 1) } }
      );
    }

    const body = await request.json();
    const candidateProfile = body?.candidateProfile;
    const jobTitle = sanitizeText(body?.jobTitle);
    const jobDescription = sanitizeText(body?.jobDescription);
    const matchResult = body?.matchResult || {};

    if (!candidateProfile || typeof candidateProfile !== 'object') {
      return NextResponse.json({ error: 'candidateProfile is required.' }, { status: 400 });
    }

    if (!jobDescription) {
      return NextResponse.json({ error: 'jobDescription is required.' }, { status: 400 });
    }

    const learningPlan = await generateLearningPlan(candidateProfile, jobTitle, jobDescription, matchResult);

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        ...learningPlan,
      },
      { status: 200 }
    );
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message = error?.message || 'Learning plan generation failed.';

    return NextResponse.json(
      {
        error: message.includes('GEMINI_API_KEY')
          ? 'Server configuration error. Contact admin to set GEMINI_API_KEY in Vercel.'
          : 'Learning plan generation failed. Please try again.',
      },
      { status: status >= 400 ? status : 500 }
    );
  }
}