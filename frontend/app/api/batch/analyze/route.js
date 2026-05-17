import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { cleanText, deleteFile, extractTextFromFile } from '../../../../src/services/resumeParser.js';
import { extractResumeData, matchJobDescription, isAnthropicConfigured } from '../../../../src/services/claudeService.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_USER_ID = 'public-user';
const MAX_FILES = 20;
const MAX_UPLOAD_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]);

function previewText(value, maxLength = 2500) {
  const text = String(value || '');

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}... [truncated ${text.length - maxLength} chars]`;
}

function getCandidateName(resumeData, fileName) {
  const extractedName = String(resumeData?.name || resumeData?.candidateName || '').trim();

  if (extractedName && extractedName.toLowerCase() !== 'unknown') {
    return extractedName;
  }

  const originalName = String(fileName || '').trim();
  if (originalName) {
    return path.parse(originalName).name || originalName;
  }

  return 'Unknown Candidate';
}

function getBearerUserId(request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return DEFAULT_USER_ID;
  }

  return DEFAULT_USER_ID;
}

function getExtension(fileName = '') {
  return path.extname(String(fileName)).toLowerCase();
}

function isAllowedUpload(file) {
  const extension = getExtension(file?.name || file?.fileName || '');
  const mimeType = String(file?.type || file?.mimeType || '').toLowerCase();

  return ALLOWED_EXTENSIONS.has(extension) || ALLOWED_MIME_TYPES.has(mimeType);
}

async function writeTempFileFromUpload(file, fallbackName = 'resume') {
  const fileName = String(file?.name || file?.fileName || fallbackName || 'resume').trim() || 'resume';
  const tempFileName = `smarthire-batch-${Date.now()}-${randomUUID()}${getExtension(fileName) || '.tmp'}`;
  const tempFilePath = path.join(os.tmpdir(), tempFileName);

  const buffer = Buffer.isBuffer(file?.buffer)
    ? file.buffer
    : Buffer.from(await file.arrayBuffer());

  await fs.writeFile(tempFilePath, buffer);

  return { filePath: tempFilePath, fileName, mimeType: String(file?.type || file?.mimeType || '').trim(), size: buffer.length };
}

function decodeBase64Payload(fileBase64) {
  const raw = String(fileBase64 || '').trim();
  if (!raw) {
    return null;
  }

  const commaIndex = raw.indexOf(',');
  const payload = commaIndex >= 0 && raw.slice(0, commaIndex).includes('base64') ? raw.slice(commaIndex + 1) : raw;

  return Buffer.from(payload, 'base64');
}

async function writeTempFileFromBase64(payload) {
  const fileName = String(payload?.fileName || payload?.name || 'resume').trim() || 'resume';
  const mimeType = String(payload?.mimeType || payload?.type || '').trim();
  const buffer = decodeBase64Payload(payload?.fileBase64);

  if (!buffer) {
    return null;
  }

  const tempFileName = `smarthire-batch-${Date.now()}-${randomUUID()}${getExtension(fileName) || '.tmp'}`;
  const tempFilePath = path.join(os.tmpdir(), tempFileName);

  await fs.writeFile(tempFilePath, buffer);

  return { filePath: tempFilePath, fileName, mimeType, size: buffer.length };
}

function normalizeJobDescription(value) {
  return String(value || '').trim();
}

function parseMultipartFiles(formData) {
  const uploads = [];

  for (const value of formData.getAll('files')) {
    if (value && typeof value.arrayBuffer === 'function') {
      uploads.push(value);
    }
  }

  for (const value of formData.getAll('resumes')) {
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

async function parseRequestBody(request) {
  const contentType = String(request.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const jobDescription = normalizeJobDescription(formData.get('jobDescription') || formData.get('job_description'));
    const jobTitle = String(formData.get('jobTitle') || formData.get('job_title') || 'Unknown Role').trim() || 'Unknown Role';
    const companyName = String(formData.get('companyName') || 'Recruiter Batch').trim() || 'Recruiter Batch';
    const uploads = parseMultipartFiles(formData);

    return { mode: 'multipart', jobTitle, companyName, jobDescription, uploads };
  }

  const body = await request.json().catch(() => ({}));
  const jobDescription = normalizeJobDescription(body?.jobDescription || body?.job_description);
  const jobTitle = String(body?.jobTitle || body?.job_title || 'Unknown Role').trim() || 'Unknown Role';
  const companyName = String(body?.companyName || 'Recruiter Batch').trim() || 'Recruiter Batch';

  const uploads = [];

  if (Array.isArray(body?.files)) {
    for (const item of body.files) {
      if (item && typeof item === 'object' && (item.fileBase64 || item.base64 || item.data)) {
        uploads.push({
          fileBase64: item.fileBase64 || item.base64 || item.data,
          fileName: item.fileName || item.name || 'resume',
          mimeType: item.mimeType || item.type || '',
        });
      }
    }
  }

  if (body?.fileBase64 || body?.fileName) {
    uploads.push({
      fileBase64: body.fileBase64,
      fileName: body.fileName,
      mimeType: body.mimeType || body.type || '',
    });
  }

  return { mode: 'json', jobTitle, companyName, jobDescription, uploads };
}

async function processUpload(upload, jobDescription, jobTitle, index) {
  let tempFilePath = null;

  try {
    const fileInfo = typeof upload?.arrayBuffer === 'function'
      ? await writeTempFileFromUpload(upload, upload?.name || `resume-${index + 1}`)
      : await writeTempFileFromBase64(upload);

    if (!fileInfo) {
      return {
        success: false,
        fileName: upload?.name || upload?.fileName || `resume-${index + 1}`,
        error: 'Could not read uploaded file.',
      };
    }

    tempFilePath = fileInfo.filePath;

    if (!isAllowedUpload({ name: fileInfo.fileName, type: fileInfo.mimeType })) {
      return {
        success: false,
        fileName: fileInfo.fileName,
        error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or MD.',
      };
    }

    if (fileInfo.size > MAX_UPLOAD_SIZE_BYTES) {
      return {
        success: false,
        fileName: fileInfo.fileName,
        error: 'Resume file is too large. Please upload files under 4MB.',
      };
    }

    const rawText = await extractTextFromFile(tempFilePath, fileInfo.mimeType || fileInfo.fileName);

    if (!rawText || String(rawText).trim().length < 30) {
      return {
        success: false,
        fileName: fileInfo.fileName,
        error: 'Could not extract text from file.',
      };
    }

    const cleanedText = cleanText(rawText);

    if (!cleanedText || cleanedText.trim().length < 30) {
      return {
        success: false,
        fileName: fileInfo.fileName,
        error: 'Could not extract text from file.',
      };
    }

    const resumeData = await extractResumeData(cleanedText);
    const matchResult = await matchJobDescription(resumeData, jobDescription, jobTitle);
    const candidateName = getCandidateName(resumeData, fileInfo.fileName);

    return {
      success: true,
      fileName: fileInfo.fileName,
      candidate: {
        rank: 0,
        name: candidateName,
        candidateName,
        score: Number(matchResult?.overallScore ?? matchResult?.matchScore) || 0,
        matchScore: Number(matchResult?.matchScore ?? matchResult?.overallScore) || 0,
        matchedSkills: Array.isArray(matchResult?.matchedSkills) ? matchResult.matchedSkills : [],
        missingSkills: Array.isArray(matchResult?.missingSkills) ? matchResult.missingSkills : [],
        recommendation: matchResult?.recommendation || '',
        summary: matchResult?.summary || '',
        resumeData,
        matchResult,
        sourceFileName: fileInfo.fileName,
      },
    };
  } catch (error) {
    return {
      success: false,
      fileName: upload?.name || upload?.fileName || `resume-${index + 1}`,
      error: error?.message || 'Processing failed',
    };
  } finally {
    if (tempFilePath) {
      try {
        deleteFile(tempFilePath);
      } catch {
        try {
          await fs.unlink(tempFilePath);
        } catch {
          // Ignore cleanup failures.
        }
      }
    }
  }
}

export async function POST(request) {
  try {
    const { jobTitle, companyName, jobDescription, uploads } = await parseRequestBody(request);

    if (!jobDescription) {
      return NextResponse.json({ error: 'jobDescription is required.' }, { status: 400 });
    }

    if (!Array.isArray(uploads) || uploads.length === 0) {
      return NextResponse.json({ error: 'Please upload at least one resume file.' }, { status: 400 });
    }

    if (uploads.length > MAX_FILES) {
      return NextResponse.json({ error: 'You can upload up to 20 resume files at once.' }, { status: 400 });
    }

    console.info('[batch/analyze] request received', {
      userId: DEFAULT_USER_ID,
      fileCount: uploads.length,
      jobDescriptionLength: jobDescription.length,
      jobDescriptionPreview: previewText(jobDescription, 3000),
      aiMode: isAnthropicConfigured() ? 'claude' : 'fallback',
      companyName,
      jobTitle,
    });

    const processed = [];

    for (let index = 0; index < uploads.length; index += 1) {
      processed.push(await processUpload(uploads[index], jobDescription, jobTitle, index));
    }

    const rankedCandidates = processed
      .filter((item) => item.success && item.candidate)
      .map((item) => item.candidate)
      .sort((left, right) => right.score - left.score || String(left.name).localeCompare(String(right.name)))
      .map((candidate, index) => ({
        ...candidate,
        rank: index + 1,
      }));

    return NextResponse.json({
      message: 'Batch analysis completed successfully!',
      rankedCandidates,
      results: processed,
      total: processed.length,
      successful: processed.filter((item) => item.success).length,
      failed: processed.filter((item) => !item.success).length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || 'Batch analysis failed.' },
      { status: error?.status || 500 }
    );
  }
}