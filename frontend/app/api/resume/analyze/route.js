// REQUIRED ENV VAR: GEMINI_API_KEY
// Add this in Vercel Dashboard -> Project -> Settings -> Environment Variables
// Value: your Gemini API key from https://aistudio.google.com/apikey

import { NextResponse } from 'next/server';
import Busboy from 'busboy';
import { Readable } from 'node:stream';
import PDFParser from 'pdf2json';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { checkRateLimit } from '../../../../src/lib/rate-limit';
import { generateGeminiContent } from '../../../../src/lib/gemini-model';
import { sanitizeText } from '../../../../src/lib/input-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_RESUME_SIZE_BYTES = 4 * 1024 * 1024;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, 1);

    pdfParser.on('pdfParser_dataError', (errData) => {
      console.error('[resume/analyze] PDF parse failed', errData?.parserError || errData);
      resolve('');
    });

    pdfParser.on('pdfParser_dataReady', () => {
      const text = pdfParser.getRawTextContent();
      resolve(String(text || '').replace(/\s+/g, ' ').trim());
    });

    pdfParser.parseBuffer(buffer);
  });
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

function buildGeminiPrompt(resumeText) {
  const normalizedResumeText = String(resumeText || '').trim();

  const basePrompt = 'Analyze this resume in structured chunks. Return ONLY valid JSON with these exact keys: candidateName, email, phone, experienceLevel, totalExperience, profileSummary, technicalSkills, softSkills, languages, frameworks, databases, tools, workExperience, education, projects, strengths, areasToImprove, overallScore, hiringRecommendation. Use strings for candidateName, email, phone, experienceLevel, totalExperience, profileSummary, hiringRecommendation. Use arrays for technicalSkills, softSkills, languages, frameworks, databases, tools, strengths, areasToImprove. Each workExperience item must include title, company, duration, highlights. Each education item must include degree, institution, year. Each project item must include name, description, technologies. overallScore must be a number from 0 to 100. Return only valid JSON and no markdown.';

  return [
    `${basePrompt}\n\nResume text:\n${normalizedResumeText}`,
  ];
}

function normalizeList(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
    .filter(Boolean);
}

function normalizeNestedArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter((item) => item && typeof item === 'object');
}

function normalizeAnalysisData(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const workExperienceSource = normalizeNestedArray(data.workExperience || data.experience).map((item) => ({
    title: String(item?.title || item?.role || item?.position || '').trim(),
    company: String(item?.company || item?.organization || item?.employer || '').trim(),
    duration: String(item?.duration || item?.period || item?.range || '').trim(),
    highlights: normalizeList(item?.highlights || item?.bullets || item?.description),
  }));
  const educationSource = normalizeNestedArray(data.education).map((item) => ({
    degree: String(item?.degree || item?.qualification || item?.program || '').trim(),
    institution: String(item?.institution || item?.school || item?.university || '').trim(),
    year: String(item?.year || item?.graduationYear || item?.completed || '').trim(),
  }));
  const projectSource = normalizeNestedArray(data.projects).map((item) => ({
    name: String(item?.name || item?.title || item?.projectName || '').trim(),
    description: String(item?.description || item?.summary || item?.details || '').trim(),
    technologies: normalizeList(item?.technologies || item?.techStack || item?.tools),
  }));
  const yearsExperience = Number(data.yearsExperience ?? data.totalExperience);
  const safeYearsExperience = Number.isFinite(yearsExperience) ? yearsExperience : null;

  return {
    candidateName: String(data.candidateName || data.name || '').trim() || 'Unknown',
    name: String(data.name || data.candidateName || '').trim() || 'Unknown',
    email: data.email ? String(data.email).trim() : null,
    phone: data.phone ? String(data.phone).trim() : null,
    experienceLevel: String(data.experienceLevel || '').trim(),
    totalExperience: String(data.totalExperience || '').trim() || (safeYearsExperience === null ? '' : `${safeYearsExperience} years`),
    yearsExperience: safeYearsExperience === null ? 0 : safeYearsExperience,
    profileSummary: String(data.profileSummary || data.summary || '').trim(),
    summary: String(data.summary || data.profileSummary || '').trim(),
    technicalSkills: normalizeList(data.technicalSkills || data.skills),
    softSkills: normalizeList(data.softSkills),
    languages: normalizeList(data.languages),
    frameworks: normalizeList(data.frameworks),
    databases: normalizeList(data.databases),
    tools: normalizeList(data.tools),
    workExperience: workExperienceSource,
    experience: workExperienceSource.map((item) => ({
      title: item.title,
      company: item.company,
      duration: item.duration,
      description: item.highlights.join(' '),
    })),
    education: educationSource,
    projects: projectSource,
    strengths: normalizeList(data.strengths),
    areasToImprove: normalizeList(data.areasToImprove || data.gaps),
    overallScore: Number.isFinite(Number(data.overallScore ?? data.score ?? data.matchScore))
      ? Number(data.overallScore ?? data.score ?? data.matchScore)
      : null,
    hiringRecommendation: String(data.hiringRecommendation || data.recommendation || '').trim(),
  };
}

function mapAnalysisToResumeData(analysis) {
  const data = analysis && typeof analysis === 'object' ? analysis : {};

  return {
    name: data.candidateName || data.name || 'Unknown',
    candidateName: data.candidateName || data.name || 'Unknown',
    email: data.email || null,
    phone: data.phone || null,
    title: data.experienceLevel || 'Unknown',
    yearsExperience: Number.isFinite(Number(data.yearsExperience)) ? Number(data.yearsExperience) : 0,
    summary: data.profileSummary || data.summary || '',
    profileSummary: data.profileSummary || data.summary || '',
    technicalSkills: data.technicalSkills || [],
    skills: data.technicalSkills || [],
    softSkills: data.softSkills || [],
    languages: data.languages || [],
    frameworks: data.frameworks || [],
    databases: data.databases || [],
    tools: data.tools || [],
    experience: data.workExperience || [],
    workExperience: data.workExperience || [],
    education: data.education || [],
    projects: data.projects || [],
    strengths: data.strengths || [],
    areasToImprove: data.areasToImprove || [],
    overallScore: data.overallScore,
    hiringRecommendation: data.hiringRecommendation || '',
    keywords: data.technicalSkills || [],
  };
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
      throw new Error('Gemini response did not contain valid JSON.');
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

function extractGeminiText(response) {
  return String(response?.text?.() || response?.response?.text?.() || '').trim();
}

async function analyzeWithGemini(resumeText) {
  const localResumeText = String(resumeText || '').trim();

  if (!String(process.env.GEMINI_API_KEY || '').trim()) {
    if (localResumeText) {
      return extractFallbackProfile(localResumeText);
    }

    const error = new Error('GEMINI_API_KEY not set');
    console.error('[resume/analyze] Missing GEMINI_API_KEY');
    error.status = 500;
    throw error;
  }

  const prompt = buildGeminiPrompt(resumeText);
  const response = await generateGeminiContent(genAI, prompt);

  const text = extractGeminiText(response?.response || response);

  if (!text) {
    if (localResumeText) {
      return extractFallbackProfile(localResumeText);
    }

    throw new Error('Gemini returned an empty response.');
  }

  try {
    return normalizeResumeData(parseJsonResponse(text));
  } catch (parseError) {
    console.error('[resume/analyze] Gemini response parse failed', {
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

    const { fields, fileUpload, fileTooLarge } = await parseMultipartRequest(request);

    if (fileTooLarge) {
      return NextResponse.json({ error: 'File too large. Max 4MB.' }, { status: 413 });
    }

    if (!fileUpload?.buffer?.length) {
      return NextResponse.json({ error: 'Please upload a resume file.' }, { status: 400 });
    }

    const clientResumeText = sanitizeText(String(fields?.resumeText || ''));

    const fileName = String(fileUpload.filename || '');
    const extension = getFileExtension(fileName);
    const allowedExtensions = new Set(['.pdf', '.docx', '.txt', '.md']);
    const isPdfUpload = extension === '.pdf' || String(fileUpload.mimeType || '').toLowerCase() === 'application/pdf';

    if (!allowedExtensions.has(extension)) {
      return NextResponse.json({ error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or MD.' }, { status: 415 });
    }

    const extractedText = sanitizeText(await extractTextFromUpload(fileUpload));

    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json(
        {
          error: isPdfUpload
            ? 'Could not extract text from PDF. Please try a text-based PDF.'
            : 'Analysis failed. Please try again.',
        },
        { status: 400 }
      );
    }

    const analysis = await analyzeWithGemini(extractedText);
    const resumeData = mapAnalysisToResumeData(analysis);

    return NextResponse.json(
      {
        status: 'ok',
        success: true,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        analysis,
        resumeData,
        resumeText: extractedText,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error?.message || 'Analysis failed. Please try again.';
    const status = Number(error?.status) || 500;
    const isAuthIssue = /GEMINI_API_KEY|api key/i.test(message);
    const isTooLarge = /too large|file size/i.test(message) || status === 413;
    const isTemporary = /Gemini request failed|empty response|invalid JSON/i.test(message);

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
            ? message
            : isAuthIssue
              ? 'Server configuration error. Contact admin to set GEMINI_API_KEY in Vercel.'
              : message,
      },
      { status: status >= 400 ? status : 500 }
    );
  }
}