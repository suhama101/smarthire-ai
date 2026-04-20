import { NextResponse } from 'next/server';
import { checkRateLimit } from '../../../../src/lib/rate-limit';
import { sanitizeText } from '../../../../src/lib/input-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

async function generateLearningPlan(candidateProfile, jobTitle, jobDescription, matchResult) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();

  if (!apiKey) {
    const error = new Error('ANTHROPIC_API_KEY is not configured.');
    error.status = 503;
    throw error;
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

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1800,
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

  return normalizeLearningPlan(parseJsonResponse(text));
}

export async function POST(request) {
  try {
    const rateLimit = checkRateLimit(request, 'learning-plan');

    if (rateLimit.limited) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 1) } });
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
        error: message.includes('ANTHROPIC_API_KEY') ? message : 'Learning plan generation failed. Please try again.',
      },
      { status: status >= 400 ? status : 500 }
    );
  }
}import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

async function generateLearningPlan(candidateProfile, jobTitle, jobDescription, matchResult) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();

  if (!apiKey) {
    const error = new Error('ANTHROPIC_API_KEY is not configured.');
    error.status = 503;
    throw error;
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

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1800,
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

  return normalizeLearningPlan(parseJsonResponse(text));
}

export async function POST(request) {
  try {
    const body = await request.json();
    const candidateProfile = body?.candidateProfile;
    const jobTitle = String(body?.jobTitle || '').trim();
    const jobDescription = String(body?.jobDescription || '').trim();
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
    const isAuthIssue = message.includes('ANTHROPIC_API_KEY');
    const isTemporary = /Claude request failed|empty response|invalid JSON/i.test(message);

    return NextResponse.json(
      {
        error: isAuthIssue
          ? message
          : isTemporary
            ? 'AI analysis temporarily unavailable. Please try again in a moment.'
            : 'Learning plan generation failed. Please try again.',
      },
      { status: status >= 400 ? status : 500 }
    );
  }
}