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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite',
  generationConfig: {
    maxOutputTokens: 1500,
    temperature: 0.1,
  },
});
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

async function extractTextFromPDF(buffer) {
  return new Promise((resolve) => {
    const pdfParser = new PDFParser(null, 1);

    pdfParser.on('pdfParser_dataError', () => {
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
                  pageText += decodeURIComponent(run.T) + ' ';
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

        resolve(fullText.replace(/\s+/g, ' ').trim());
      } catch (error) {
        resolve('');
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

function buildFallbackMatchFromProfile(candidateProfile, jobTitle, jobDescription, candidateIndex) {
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

function buildFallbackMatch(candidateProfile, resumeText, jobTitle, jobDescription, candidateIndex, fileName) {
  const profile = candidateProfile && typeof candidateProfile === 'object' ? candidateProfile : {};
  const resumeBody = String(resumeText || '').replace(/\s+/g, ' ').trim();
  const candidateName = String(profile.name || profile.fullName || profile.candidateName || fileName || `Candidate ${candidateIndex || 1}`)
    .replace(/\.[^.]+$/, '')
    .trim() || `Candidate ${candidateIndex || 1}`;
  const candidateSkills = extractSkills(`${resumeBody} ${fileName} ${JSON.stringify(profile)} ${String(profile.summary || '')}`);
  const jobSkills = extractSkills(`${jobTitle} ${jobDescription}`);
  const matchedSkills = candidateSkills.filter((skill) => jobSkills.some((jobSkill) => skill.toLowerCase() === jobSkill.toLowerCase() || skill.toLowerCase().includes(jobSkill.toLowerCase()) || jobSkill.toLowerCase().includes(skill.toLowerCase())));
  const missingSkills = jobSkills.filter((skill) => !matchedSkills.some((matched) => matched.toLowerCase() === skill.toLowerCase()));
  const overlapRatio = matchedSkills.length / Math.max(jobSkills.length || 1, 1);
  const matchScore = Math.max(25, Math.min(95, Math.round(overlapRatio * 100)));

  return normalizeBatchResult(
    {
      candidateName,
      matchScore,
      matchedSkills,
      missingSkills,
      experienceFit: matchScore >= 80 ? 'Strong' : matchScore >= 60 ? 'Moderate' : 'Weak',
      recommendation: matchScore >= 80 ? 'Strongly Recommended' : matchScore >= 60 ? 'Recommended' : 'Needs Review',
      profile: {
        name: candidateName,
        email: profile.email || '',
        title: profile.title || jobTitle || '',
        summary: resumeBody.slice(0, 280) || String(profile.summary || ''),
        skills: candidateSkills,
        matchedSkills,
        missingSkills,
        experience: Array.isArray(profile.experience) ? profile.experience : [],
        education: Array.isArray(profile.education) ? profile.education : [],
        yearsExperience: Number.isFinite(Number(profile.yearsExperience)) ? Number(profile.yearsExperience) : null,
      },
    },
    { candidateIndex, profile: { ...profile, name: candidateName } }
  );
}

async function extractResumeFromBase64(fileBase64, fileName, mimeType) {
  const buffer = Buffer.from(String(fileBase64 || ''), 'base64');
  const extension = String(fileName || '').toLowerCase().split('.').pop();
  const normalizedMime = String(mimeType || '').toLowerCase();

  if (normalizedMime === 'application/pdf' || extension === 'pdf') {
    return { buffer, text: await extractTextFromPDF(buffer) };
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

async function extractResumeFromUpload(upload, fallbackName = '') {
  if (!upload) {
    return { fileBase64: '', fileName: fallbackName, mimeType: '', text: '' };
  }

  if (typeof upload.arrayBuffer === 'function') {
    const buffer = Buffer.from(await upload.arrayBuffer());
    const fileName = String(upload.name || fallbackName || '').trim();
    const mimeType = String(upload.type || '').trim();
    const extension = fileName.toLowerCase().split('.').pop();

    if (mimeType === 'application/pdf' || extension === 'pdf') {
      return { buffer, fileBase64: buffer.toString('base64'), fileName, mimeType, text: await extractTextFromPDF(buffer) };
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extension === 'docx') {
      try {
        const mammothModule = await import('mammoth');
        const mammoth = mammothModule.default || mammothModule;
        const result = await mammoth.extractRawText({ buffer });
        return { buffer, fileBase64: buffer.toString('base64'), fileName, mimeType, text: String(result?.value || '').replace(/\s+/g, ' ').trim() };
      } catch {
        return { buffer, fileBase64: buffer.toString('base64'), fileName, mimeType, text: buffer.toString('utf8').replace(/\s+/g, ' ').trim() };
      }
    }

    return { buffer, fileBase64: buffer.toString('base64'), fileName, mimeType, text: buffer.toString('utf8').replace(/\s+/g, ' ').trim() };
  }

  return extractResumeFromBase64(upload.fileBase64 || '', upload.fileName || fallbackName, upload.mimeType || '');
}

async function extractUploadsFromFormData(formData) {
  const uploads = [];

  for (const value of formData.getAll('resumes')) {
    if (value && typeof value.arrayBuffer === 'function') {
      uploads.push(value);
    }
  }

  for (const value of formData.getAll('files')) {
    if (value && typeof value.arrayBuffer === 'function') {
      uploads.push(value);
    }
  }

  if (!uploads.length) {
    const fallbackUpload = formData.get('file') || formData.get('resume');

    if (fallbackUpload && typeof fallbackUpload.arrayBuffer === 'function') {
      uploads.push(fallbackUpload);
    }
  }

  return uploads;
}

function buildGeminiPrompt(extractedText, jobTitle, jobDescription) {
  return `Parse this resume and compare with the job description. Return ONLY raw JSON, no markdown.

RESUME:
${String(extractedText || '').substring(0, 3000)}

JOB TITLE: ${String(jobTitle || '').trim()}
JOB DESCRIPTION: ${String(jobDescription || '').substring(0, 500)}

Return this JSON:
{
  "candidateName": "name from resume",
  "email": "email",
  "phone": "phone",
  "experienceLevel": "Junior or Mid-level or Senior",
  "technicalSkills": ["skill1", "skill2"],
  "matchScore": 75,
  "matchedSkills": ["skill1"],
  "missingSkills": ["skill1"],
  "recommendation": "Strong Match or Good Match or Weak Match",
  "summary": "2-3 sentence match summary",
  "overallScore": 75,
  "hiringRecommendation": "Hire"
}`;
}

async function callGemini(jobTitle, companyName, jobDescription, resumeText, candidateIndex, fileName) {
  const text = String(resumeText || '').trim();
  const fallbackResult = () => buildFallbackMatch({ summary: text || '' }, text || '', jobTitle, jobDescription, candidateIndex, fileName);

  if (!String(process.env.GEMINI_API_KEY || '').trim()) {
    return fallbackResult();
  }

  try {
    const prompt = buildGeminiPrompt(text, jobTitle, jobDescription);
    const result = await model.generateContent(prompt);
    const raw = String(result?.response?.text?.() || '').trim();

    if (!raw) {
      return fallbackResult();
    }

    const cleaned = raw
      .replace(/```json/gi, '')
      .replace(/```/gi, '')
      .replace(/^[^{]*/s, '')
      .replace(/[^}]*$/s, '')
      .trim();

    const parsed = parseJsonResponse(cleaned);
    parsed.matchScore = Number(parsed.matchScore) || 0;
    parsed.overallScore = Number(parsed.overallScore) || parsed.matchScore || 0;

    return normalizeBatchResult(parsed, {
      candidateIndex,
      profile: {
        name: fileName || `Candidate ${candidateIndex || 1}`,
        title: jobTitle || '',
        summary: text.slice(0, 280),
      },
    });
  } catch (error) {
    console.error('Batch Gemini fallback used:', error?.message || error);
    return fallbackResult();
  }
}

async function analyzeUploads(jobTitle, companyName, jobDescription, uploads) {
  const rankedCandidates = [];
  const results = [];

  for (let index = 0; index < uploads.length; index += 1) {
    const upload = uploads[index];

    try {
      const extracted = await extractResumeFromUpload(upload, upload?.name || `resume-${index + 1}`);
      const fileText = String(extracted.text || '').trim();

      if (!fileText || fileText.length < 30) {
        results.push({
          fileName: extracted.fileName || upload?.name || `resume-${index + 1}`,
          success: false,
          error: 'Could not extract text from file',
        });
        continue;
      }

      const parsed = await callGemini(
        jobTitle,
        companyName,
        jobDescription,
        fileText,
        index + 1,
        extracted.fileName || upload?.name || `resume-${index + 1}`,
      );

      const sourceFileName = extracted.fileName || upload?.name || `resume-${index + 1}`;
      const candidateRow = {
        rank: index + 1,
        candidateName: parsed.candidateName || `Candidate ${index + 1}`,
        name: parsed.candidateName || `Candidate ${index + 1}`,
        score: Number(parsed.matchScore) || 0,
        matchScore: Number(parsed.matchScore) || 0,
        matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills : [],
        missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
        recommendation: parsed.recommendation || 'Review manually',
        summary: parsed.summary || '',
        sourceFileName,
        profile: parsed.profile || {
          name: parsed.candidateName || `Candidate ${index + 1}`,
          title: jobTitle || '',
          summary: fileText.slice(0, 280),
        },
      };

      results.push({
        fileName: sourceFileName,
        success: true,
        data: candidateRow,
      });

      rankedCandidates.push(candidateRow);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('File error:', upload?.name || `resume-${index + 1}`, error?.message || error);
      results.push({
        fileName: upload?.name || `resume-${index + 1}`,
        success: false,
        error: error?.message || 'Processing failed',
      });
    }
  }

  const rankedByScore = rankedCandidates
    .sort((left, right) => right.score - left.score || String(left.name).localeCompare(String(right.name)))
    .map((candidate, index) => ({
      rank: index + 1,
      candidateName: candidate.candidateName || candidate.name,
      name: candidate.name,
      score: candidate.score,
      matchScore: candidate.matchScore,
      matchedSkills: candidate.matchedSkills,
      missingSkills: candidate.missingSkills,
      recommendation: candidate.recommendation,
      summary: candidate.summary,
      sourceFileName: candidate.sourceFileName,
      profile: candidate.profile,
    }));

  return { rankedCandidates: rankedByScore, results };
}

export async function POST(request) {
  try {
    const rateLimit = checkRateLimit(request, 'batch-analyze');

    if (rateLimit.limited) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 1) } });
    }

    const contentType = String(request.headers.get('content-type') || '').toLowerCase();
    let fileBase64 = '';
    let fileName = '';
    let mimeType = '';
    let jobTitle = '';
    let jobDescription = '';
    let candidateIndex = 1;
    let companyName = 'Recruiter Batch';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const uploads = await extractUploadsFromFormData(formData);

      jobTitle = sanitizeText(formData.get('jobTitle'));
      jobDescription = sanitizeText(formData.get('jobDescription'));
      companyName = sanitizeText(formData.get('companyName') || 'Recruiter Batch');

      if (!uploads.length) {
        return NextResponse.json({ error: 'Please upload at least one resume file.' }, { status: 400 });
      }

      const { rankedCandidates, results } = await analyzeUploads(jobTitle, companyName, jobDescription, uploads);
      const successful = results.filter((result) => result.success).length;

      return NextResponse.json(
        {
          success: true,
          message: 'Batch analysis completed successfully!',
          rankedCandidates,
          results,
          total: results.length,
          successful,
          failed: results.length - successful,
        },
        { status: 200 }
      );
    } else {
      const body = await request.json();
      fileBase64 = String(body?.fileBase64 || '').trim();
      fileName = String(body?.fileName || '').trim();
      mimeType = String(body?.mimeType || '').trim();
      jobTitle = sanitizeText(body?.jobTitle);
      jobDescription = sanitizeText(body?.jobDescription);
      candidateIndex = Number(body?.candidateIndex || 1);
      companyName = sanitizeText(body?.companyName || 'Recruiter Batch');
    }

    if (!jobTitle || !jobDescription || !fileBase64 || !fileName) {
      return NextResponse.json({ error: 'fileBase64, fileName, jobTitle, and jobDescription are required.' }, { status: 400 });
    }

    const extracted = await extractResumeFromBase64(fileBase64, fileName, mimeType);
    const result = await callGemini(jobTitle, companyName, jobDescription, extracted.text, candidateIndex, fileName);

    return NextResponse.json(
      {
        success: true,
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