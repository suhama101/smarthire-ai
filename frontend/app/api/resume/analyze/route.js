import { NextResponse } from 'next/server';
import { checkRateLimit } from '../../../../src/lib/rate-limit';
import { sanitizeText } from '../../../../src/lib/input-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_RESUME_SIZE_BYTES = 4 * 1024 * 1024;
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

function getFileExtension(fileName = '') {
  const parts = String(fileName).toLowerCase().split('.');
  return parts.length > 1 ? `.${parts.pop()}` : '';
}

async function extractPdfText(buffer) {
  const pdfParseModule = await import('pdf-parse');
  const pdfParse = pdfParseModule.default || pdfParseModule;
  const result = await pdfParse(buffer);
  return result?.text || '';
}

async function extractDocxText(buffer) {
  const mammothModule = await import('mammoth');
  const mammoth = mammothModule.default || mammothModule;
  const result = await mammoth.extractRawText({ buffer });
  return result?.value || '';
}

async function extractTextFromFile(file) {
  const extension = getFileExtension(file?.name || '');
  const mimeType = String(file?.type || '').toLowerCase();

  if (mimeType === 'application/pdf' || extension === '.pdf') {
    return extractPdfText(Buffer.from(await file.arrayBuffer()));
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === '.docx'
  ) {
    return extractDocxText(Buffer.from(await file.arrayBuffer()));
  }

  if (mimeType === 'text/plain' || mimeType === 'text/markdown' || extension === '.txt' || extension === '.md') {
    return file.text();
  }

  throw new Error('Unsupported file type. Please upload PDF, DOCX, TXT, or MD.');
}

function normalizeArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter(Boolean);
}

function normalizeResumeData(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const skills = normalizeArray(data.skills || data.technicalSkills);
  const experience = Array.isArray(data.experience)
    ? data.experience.map((item) => ({
        title: String(item?.title || '').trim(),
        company: String(item?.company || '').trim(),
        duration: String(item?.duration || '').trim(),
        description: String(item?.description || '').trim(),
      }))
    : [];
  const education = Array.isArray(data.education)
    ? data.education.map((item) => ({
        degree: String(item?.degree || '').trim(),
        institution: String(item?.institution || '').trim(),
        year: item?.year ? String(item.year).trim() : '',
      }))
    : [];

  return {
    name: String(data.name || '').trim() || 'Unknown',
    email: data.email ? String(data.email).trim() : null,
    phone: data.phone ? String(data.phone).trim() : null,
    skills,
    experience,
    education,
    summary: String(data.summary || '').trim(),
  };
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

async function analyzeWithClaude(resumeText) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();

  if (!apiKey) {
    const error = new Error('ANTHROPIC_API_KEY is not configured.');
    error.status = 503;
    throw error;
  }

  const prompt = `Extract structured profile data from this resume text. Return JSON with fields: name, email, phone, skills (array), experience (array of {title, company, duration, description}), education (array of {degree, institution, year}), summary (2-3 sentence overview)

Resume text:
${String(resumeText || '').slice(0, 24000)}`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'tools-2024-04-04',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1600,
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

  const data = await response.json();
  const content = Array.isArray(data?.content) ? data.content : [];
  const text = content
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('Claude returned an empty response.');
  }

  return normalizeResumeData(parseJsonResponse(text));
}

export async function POST(request) {
  try {
    const rateLimit = checkRateLimit(request, 'resume-analyze');

    if (rateLimit.limited) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 1) } });
    }

    const formData = await request.formData();
    const file = formData.get('resume');

    if (!file || typeof file !== 'object' || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Please upload a resume file.' }, { status: 400 });
    }

    if (file.size > MAX_RESUME_SIZE_BYTES) {
      return NextResponse.json({ error: 'File is too large. Please choose a file under 4MB.' }, { status: 413 });
    }

    const fileName = String(file.name || '');
    const extension = getFileExtension(fileName);
    const allowedExtensions = new Set(['.pdf', '.docx', '.txt', '.md']);

    if (!allowedExtensions.has(extension)) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or MD.' }, { status: 415 });
    }

    const extractedText = sanitizeText(await extractTextFromFile(file));

    if (!extractedText) {
      return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 422 });
    }

    const resumeData = await analyzeWithClaude(extractedText);

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        resumeData,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error?.message || 'Analysis failed. Please try again.';
    const status = Number(error?.status) || 500;
    const isAuthIssue = message.includes('ANTHROPIC_API_KEY');
    const isTemporary = /Claude request failed|empty response|invalid JSON/i.test(message);

    return NextResponse.json(
      {
        error: isAuthIssue
          ? message
          : isTemporary
            ? 'AI analysis temporarily unavailable. Please try again in a moment.'
            : 'Analysis failed. Please try again.',
      },
      { status: status >= 400 ? status : 500 }
    );
  }
}