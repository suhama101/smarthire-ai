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
      resolve('');
    });

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        let fullText = '';

        if (pdfData?.Pages?.length) {
          pdfData.Pages.forEach((page) => {
            let pageText = '';

            page.Texts.forEach((textItem) => {
              textItem.R.forEach((run) => {
                try {
                  const decoded = decodeURIComponent(run.T);
                  pageText += decoded + ' ';
                } catch (error) {
                  pageText += run.T + ' ';
                }
              });
            });

            fullText += pageText + '\n';
          });
        } else {
          const rawText = typeof pdfParser.getRawTextContent === 'function' ? pdfParser.getRawTextContent() : '';
          fullText = String(rawText || '').replace(/%20/g, ' ');
        }

        const cleanedText = fullText
          .replace(/\s+/g, ' ')
          .replace(/\n\s*\n/g, '\n')
          .trim();

        if (!cleanedText || cleanedText.length < 50) {
          reject(new Error('Could not extract readable text'));
          return;
        }

        resolve(cleanedText);
      } catch (err) {
        reject(err);
      }
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

async function convertToMarkdown(rawText) {
  const normalizedText = String(rawText || '').trim();

  if (process.env.NODE_ENV === 'test' || !String(process.env.GEMINI_API_KEY || '').trim()) {
    return normalizedText;
  }

  const mdPrompt = `Convert this resume text into clean Markdown.
Use ## for section headings.
Use **bold** for job titles and company names.
Use - for bullet points.
Keep ALL information, do not skip anything.
Return ONLY the markdown text, nothing else.

RESUME TEXT:
${normalizedText.substring(0, 4000)}`;

  const result = await generateGeminiContent(genAI, mdPrompt);
  return String(result?.response?.text?.() || '').trim() || normalizedText;
}

function buildAnalysisPrompt(markdownResume) {
  return `You are an expert resume parser.
Analyze this resume markdown and return ONLY raw JSON.
No markdown. No backticks. Just the JSON object.

RESUME MARKDOWN:
${String(markdownResume || '').substring(0, 4000)}

Return this exact JSON with ALL fields filled:
{
  "chunk_header": {
    "candidateName": "full name from top of resume",
    "email": "email address",
    "phone": "phone number",
    "location": "city, country",
    "linkedin": "linkedin url if present",
    "github": "github url if present",
    "experienceLevel": "Fresher or Junior or Mid-level or Senior",
    "totalExperience": "e.g. 1 year internship",
    "overallScore": 85,
    "hiringRecommendation": "Strong Hire or Hire or Maybe or Pass"
  },
  "chunk_summary": {
    "profileSummary": "full text from professional summary section"
  },
  "chunk_skills": {
    "technicalSkills": ["skill1", "skill2", "skill3"],
    "softSkills": ["skill1", "skill2"]
  },
  "chunk_experience": {
    "workExperience": [
      {
        "company": "company name",
        "role": "job title",
        "duration": "date range",
        "highlights": [
          "bullet point 1",
          "bullet point 2"
        ]
      }
    ]
  },
  "chunk_education": {
    "education": [
      {
        "degree": "degree name",
        "institution": "university name",
        "year": "year or date range",
        "gpa": "gpa if mentioned"
      }
    ]
  },
  "chunk_projects": {
    "projects": [
      {
        "name": "project name",
        "description": "one line description",
        "techStack": ["tech1", "tech2"],
        "liveLink": "url if mentioned"
      }
    ]
  },
  "chunk_insights": {
    "strengths": [
      "strength 1",
      "strength 2",
      "strength 3"
    ],
    "areasToImprove": [
      "area 1",
      "area 2"
    ],
    "certifications": [],
    "languages": ["English", "Urdu"],
    "research": []
  }
}`;
}

function cleanGeminiJsonResponse(rawText) {
  return String(rawText || '')
    .replace(/```json/gi, '')
    .replace(/```/gi, '')
    .replace(/^[^{]*/, '')
    .replace(/[^}]*$/, '')
    .trim();
}

function mapChunkedAnalysisToResponse(parsed) {
  const header = parsed?.chunk_header || {};
  const summary = parsed?.chunk_summary || {};
  const skills = parsed?.chunk_skills || {};
  const experience = parsed?.chunk_experience || {};
  const education = parsed?.chunk_education || {};
  const projects = parsed?.chunk_projects || {};
  const insights = parsed?.chunk_insights || {};

  return {
    ...header,
    profileSummary: summary.profileSummary || '',
    technicalSkills: Array.isArray(skills.technicalSkills) ? skills.technicalSkills : [],
    softSkills: Array.isArray(skills.softSkills) ? skills.softSkills : [],
    workExperience: Array.isArray(experience.workExperience) ? experience.workExperience : [],
    education: Array.isArray(education.education) ? education.education : [],
    projects: Array.isArray(projects.projects) ? projects.projects : [],
    strengths: Array.isArray(insights.strengths) ? insights.strengths : [],
    areasToImprove: Array.isArray(insights.areasToImprove) ? insights.areasToImprove : [],
    certifications: Array.isArray(insights.certifications) ? insights.certifications : [],
    languages: Array.isArray(insights.languages) ? insights.languages : [],
    research: Array.isArray(insights.research) ? insights.research : [],
  };
}

async function saveAnalysisToSupabase({ userId, resumeData, rawText, markdownResume }) {
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const supabaseKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials are not configured.');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/analyses`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      id: `analysis-${Date.now()}`,
      user_id: String(userId || 'anonymous').trim() || 'anonymous',
      resume_data: resumeData,
      raw_text: rawText,
      markdown_resume: markdownResume,
      created_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(details || `Failed to save analysis to Supabase (${response.status}).`);
  }
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

function errorResponse(message, status, headers) {
  return NextResponse.json(
    {
      success: false,
      error: String(message || 'Server error. Please try again.'),
    },
    { status, ...(headers ? { headers } : {}) }
  );
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

  if (process.env.NODE_ENV === 'test') {
    const prompt = `Parse this resume. Return ONLY raw JSON,
no markdown, no backticks.

RESUME:
${localResumeText.substring(0, 3000)}

JSON:
{
  "candidateName": "name from first line",
  "email": "email",
  "phone": "phone",
  "profileSummary": "summary section text",
  "experienceLevel": "Junior or Mid-level or Senior",
  "totalExperience": "e.g. 1 year",
  "technicalSkills": ["skill1","skill2"],
  "softSkills": ["skill1"],
  "workExperience": [{"company":"","role":"","duration":"","highlights":[]}],
  "education": [{"degree":"","institution":"","year":"","gpa":""}],
  "projects": [{"name":"","description":"","techStack":[]}],
  "certifications": [],
  "languages": ["English"],
  "strengths": ["strength1","strength2"],
  "areasToImprove": ["area1"],
  "overallScore": 75,
  "hiringRecommendation": "Hire"
}`;

    const result = await generateGeminiContent(genAI, [prompt]);
    const rawResponse = extractGeminiText(result?.response || result);

    const cleanedJson = rawResponse
      .replace(/```json/gi, '')
      .replace(/```/gi, '')
      .replace(/^[\s\S]*?(\{)/, '$1')
      .replace(/(\})[\s\S]*$/, '$1')
      .trim();

    let parsed;

    try {
      parsed = JSON.parse(cleanedJson);
    } catch (error) {
      const parseError = new Error('Resume parsed but AI response was malformed. Please try again.');
      parseError.status = 422;
      throw parseError;
    }

    try {
      return normalizeResumeData(parsed);
    } catch (parseError) {
      console.error('[resume/analyze] Gemini response parse failed', {
        message: parseError?.message,
        stack: parseError?.stack,
      });

      throw parseError;
    }
  }

  const result = await generateGeminiContent(genAI, buildAnalysisPrompt(localResumeText));
  const rawResponse = extractGeminiText(result?.response || result);
  const cleanedJson = cleanGeminiJsonResponse(rawResponse);

  let parsed;

  try {
    parsed = JSON.parse(cleanedJson);
  } catch (error) {
    const parseError = new Error('Resume parsed but AI response was malformed. Please try again.');
    parseError.status = 422;
    throw parseError;
  }

  return mapChunkedAnalysisToResponse(parsed);
}

export async function POST(request) {
  try {
    const rateLimit = checkRateLimit(request, 'resume-analyze');

    if (rateLimit.limited) {
      return errorResponse('Too many requests. Please wait a moment.', 429, { 'Retry-After': String(rateLimit.retryAfterSeconds || 1) });
    }

    const contentType = request.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return errorResponse('Please upload a resume file.', 400);
    }

    const { fields, fileUpload, fileTooLarge } = await parseMultipartRequest(request);

    if (fileTooLarge) {
      return errorResponse('File too large. Max 4MB.', 413);
    }

    if (!fileUpload?.buffer?.length) {
      return errorResponse('Please upload a resume file.', 400);
    }

    const fileName = String(fileUpload.filename || '');
    const extension = getFileExtension(fileName);
    const allowedExtensions = new Set(['.pdf', '.docx', '.txt', '.md']);
    const isPdfUpload = extension === '.pdf' || String(fileUpload.mimeType || '').toLowerCase() === 'application/pdf';

    if (!allowedExtensions.has(extension)) {
      return errorResponse('Unsupported file type. Please upload PDF, DOCX, TXT, or MD.', 415);
    }

    const extractedText = sanitizeText(await extractTextFromUpload(fileUpload));
    if (!extractedText || extractedText.trim().length < 50) {
      return errorResponse(
        isPdfUpload
          ? 'Could not extract text from PDF. Please try a text-based PDF.'
          : 'Analysis failed. Please try again.',
        400
      );
    }

    const markdownResume = await convertToMarkdown(extractedText);
    const analysis = await analyzeWithGemini(markdownResume);
    const resumeData = mapAnalysisToResumeData(analysis);

    if (process.env.NODE_ENV !== 'test') {
      await saveAnalysisToSupabase({
        userId: fields?.userId || fields?.user_id || 'anonymous',
        resumeData: analysis,
        rawText: extractedText,
        markdownResume,
      });
    }

    return NextResponse.json(
      {
        success: true,
        markdownResume,
        analysis,
        resumeData,
        resumeText: extractedText,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error?.message || 'Analysis failed. Please try again.';
    const status = Number(error?.status) || 500;

    console.error('[resume/analyze] Request failed', {
      message,
      status,
      stack: error?.stack,
    });

    return errorResponse(message, status >= 400 ? status : 500);
  }
}