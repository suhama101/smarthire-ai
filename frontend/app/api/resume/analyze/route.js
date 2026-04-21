// REQUIRED ENV VAR: ANTHROPIC_API_KEY
// Add this in Vercel Dashboard -> Project -> Settings -> Environment Variables
// Value: your Anthropic API key from https://console.anthropic.com

import { NextResponse } from 'next/server';
import Busboy from 'busboy';
import { Readable } from 'node:stream';
import { checkRateLimit } from '../../../../src/lib/rate-limit';
import { sanitizeText } from '../../../../src/lib/input-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_RESUME_SIZE_BYTES = 4 * 1024 * 1024;
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)\d{3}[\s-]?\d{4}/g;
const SKILL_KEYWORDS = [
  'javascript', 'typescript', 'react', 'next.js', 'nextjs', 'node.js', 'node', 'express', 'python', 'java',
  'c#', 'go', 'golang', 'php', 'ruby', 'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'aws', 'azure', 'gcp',
  'docker', 'kubernetes', 'terraform', 'html', 'css', 'tailwind', 'redux', 'graphql', 'rest', 'api', 'testing',
  'jest', 'cypress', 'playwright', 'git', 'ci/cd', 'devops', 'agile', 'scrum', 'figma', 'ui', 'ux', 'accessibility',
];

function getFileExtension(fileName = '') {
  const parts = String(fileName).toLowerCase().split('.');
  return parts.length > 1 ? `.${parts.pop()}` : '';
}

async function extractPdfText(buffer) {
  try {
    const pdfjsModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdfjs = pdfjsModule.default || pdfjsModule;
    const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false, isEvalSupported: false }).promise;
    const pageTexts = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => (typeof item.str === 'string' ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageText) {
        pageTexts.push(pageText);
      }
    }

    await document.destroy();
    return pageTexts.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

async function extractDocxText(buffer) {
  try {
    const mammothModule = await import('mammoth');
    const mammoth = mammothModule.default || mammothModule;
    const result = await mammoth.extractRawText({ buffer });
    return String(result?.value || '').replace(/\s+/g, ' ').trim();
  } catch {
    return Buffer.from(buffer).toString('utf8').replace(/\s+/g, ' ').trim();
  }
}

async function extractTextFromUpload(upload) {
  const extension = getFileExtension(upload?.filename || '');
  const mimeType = String(upload?.mimeType || '').toLowerCase();
  const buffer = Buffer.isBuffer(upload?.buffer) ? upload.buffer : Buffer.from(upload?.buffer || []);

  if (mimeType === 'application/pdf' || extension === '.pdf') {
    return extractPdfText(buffer);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === '.docx'
  ) {
    return extractDocxText(buffer);
  }

  if (mimeType === 'text/plain' || mimeType === 'text/markdown' || extension === '.txt' || extension === '.md') {
    return buffer.toString('utf8').replace(/\s+/g, ' ').trim();
  }

  throw new Error('Unsupported file type. Please upload PDF, DOCX, TXT, or MD.');
}

function buildClaudeContentForUpload(upload, resumeText) {
  const extension = getFileExtension(upload?.filename || '');
  const mimeType = String(upload?.mimeType || '').toLowerCase();

  if (mimeType === 'application/pdf' || extension === '.pdf') {
    return [
      {
        type: 'text',
        text: `Extract structured profile data from this resume text. Return ONLY a JSON object with fields: name, email, phone, skills (array), experience (array of {title, company, duration}), education (array of {degree, institution, year}), summary (2-3 sentences). Return ONLY valid JSON, no markdown, no explanation.\n\nResume text:\n${String(resumeText || '').slice(0, 24000)}`,
      },
    ];
  }

  return [
    {
      type: 'text',
      text: `Extract structured profile data from this resume text. Return ONLY a JSON object with fields: name, email, phone, skills (array), experience (array of {title, company, duration}), education (array of {degree, institution, year}), summary (2-3 sentences). Return ONLY valid JSON, no markdown, no explanation.\n\nResume text:\n${String(resumeText || '').slice(0, 24000)}`,
    },
  ];
}

function parseMultipartRequest(request) {
  return new Promise((resolve, reject) => {
    const headers = Object.fromEntries(request.headers.entries());
    const busboy = Busboy({
      headers,
      limits: {
        files: 1,
        fileSize: MAX_RESUME_SIZE_BYTES,
      },
    });

    const fields = {};
    let fileUpload = null;
    let fileTooLarge = false;

    busboy.on('field', (fieldName, value) => {
      fields[fieldName] = value;
    });

    busboy.on('file', (fieldName, fileStream, info) => {
      if (fieldName !== 'resume' || fileUpload) {
        fileStream.resume();
        return;
      }

      const chunks = [];
      const filename = info?.filename || '';
      const mimeType = info?.mimeType || '';

      fileStream.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk));
      });

      fileStream.on('limit', () => {
        fileTooLarge = true;
      });

      fileStream.on('end', () => {
        fileUpload = {
          fieldName,
          filename,
          mimeType,
          buffer: Buffer.concat(chunks),
        };
      });

      fileStream.on('error', reject);
    });

    busboy.on('error', reject);
    busboy.on('finish', () => resolve({ fields, fileUpload, fileTooLarge }));

    if (!request.body) {
      reject(new Error('Request body is empty.'));
      return;
    }

    Readable.fromWeb(request.body).on('error', reject).pipe(busboy);
  });
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

function dedupeStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function extractFallbackSkills(text) {
  const normalized = String(text || '').toLowerCase();
  const labels = SKILL_KEYWORDS.filter((skill) => normalized.includes(skill)).map((skill) => {
    if (skill === 'nextjs') return 'Next.js';
    if (skill === 'node.js') return 'Node.js';
    if (skill === 'ci/cd') return 'CI/CD';
    if (skill === 'gcp') return 'GCP';
    if (skill === 'aws') return 'AWS';
    if (skill === 'azure') return 'Azure';
    if (skill === 'sql') return 'SQL';
    if (skill === 'rest') return 'REST';
    if (skill === 'api') return 'APIs';
    if (skill === 'ui') return 'UI';
    if (skill === 'ux') return 'UX';
    return skill;
  });

  return dedupeStrings(labels);
}

function extractFallbackProfile(resumeText) {
  const text = String(resumeText || '').replace(/\s+/g, ' ').trim();
  const lines = String(resumeText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const emails = text.match(EMAIL_REGEX) || [];
  const phones = text.match(PHONE_REGEX) || [];

  return normalizeResumeData({
    name: lines[0] || 'Candidate',
    email: emails[0] || null,
    phone: phones[0] || null,
    skills: extractFallbackSkills(text),
    experience: [],
    education: [],
    summary: text.slice(0, 280) || 'Resume text extracted successfully.',
  });
}

async function analyzeWithClaude(upload, resumeText) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  const localResumeText = String(resumeText || '').trim();

  if (!apiKey) {
    if (localResumeText) {
      return extractFallbackProfile(localResumeText);
    }

    const error = new Error('ANTHROPIC_API_KEY not set');
    console.error('[resume/analyze] Missing ANTHROPIC_API_KEY');
    error.status = 500;
    throw error;
  }

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
      max_tokens: 1000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: buildClaudeContentForUpload(upload, resumeText),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[resume/analyze] Claude request failed', {
      status: response.status,
      statusText: response.statusText,
      errorText,
    });
    if (localResumeText) {
      return extractFallbackProfile(localResumeText);
    }

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
    if (localResumeText) {
      return extractFallbackProfile(localResumeText);
    }

    throw new Error('Claude returned an empty response.');
  }

  try {
    return normalizeResumeData(parseJsonResponse(text));
  } catch (parseError) {
    console.error('[resume/analyze] Claude response parse failed', {
      message: parseError?.message,
      stack: parseError?.stack,
    });

    if (localResumeText) {
      return extractFallbackProfile(localResumeText);
    }

    throw parseError;
  }
}

export async function POST(request) {
  try {
    const rateLimit = checkRateLimit(request, 'resume-analyze');

    if (rateLimit.limited) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 1) } });
    }

    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Please upload a resume file.' }, { status: 400 });
    }

    const { fileUpload, fileTooLarge } = await parseMultipartRequest(request);

    if (fileTooLarge) {
      return NextResponse.json({ error: 'File too large. Max 4MB.' }, { status: 413 });
    }

    if (!fileUpload?.buffer?.length) {
      return NextResponse.json({ error: 'Please upload a resume file.' }, { status: 400 });
    }

    const fileName = String(fileUpload.filename || '');
    const extension = getFileExtension(fileName);
    const allowedExtensions = new Set(['.pdf', '.docx', '.txt', '.md']);
    const isPdfUpload = extension === '.pdf' || String(fileUpload.mimeType || '').toLowerCase() === 'application/pdf';

    if (!allowedExtensions.has(extension)) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or MD.' }, { status: 415 });
    }

    const extractedText = sanitizeText(await extractTextFromUpload(fileUpload));

    if (!extractedText) {
      return NextResponse.json(
        {
          error: isPdfUpload
            ? 'Could not extract readable text from this PDF. Please upload a text-based PDF or DOCX file.'
            : 'Analysis failed. Please try again.',
        },
        { status: 422 }
      );
    }

    const resumeData = await analyzeWithClaude(fileUpload, extractedText);

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
    const isTooLarge = /too large|file size/i.test(message) || status === 413;
    const isTemporary = /Claude request failed|empty response|invalid JSON/i.test(message);

    console.error('[resume/analyze] Request failed', {
      message,
      status,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        error: isTooLarge
            ? 'File too large. Max 4MB.'
          : isTemporary
            ? 'AI analysis temporarily unavailable. Please try again in a moment.'
            : isAuthIssue
              ? 'Server configuration error. Contact admin to set ANTHROPIC_API_KEY in Vercel.'
              : 'Analysis failed. Please try again.',
      },
      { status: status >= 400 ? status : 500 }
    );
  }
}