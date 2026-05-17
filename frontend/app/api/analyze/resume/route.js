import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

import { cleanText, deleteFile, extractTextFromFile } from '../../../../src/services/resumeParser.js';
import { extractResumeData, isAnthropicConfigured } from '../../../../src/services/claudeService.js';
import { saveAnalysis } from '../../../../src/services/db.js';
import { getJwtSecret } from '../../../../src/lib/authMiddleware.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_USER_ID = 'public-user';
const MAX_RESUME_SIZE_BYTES = 4 * 1024 * 1024;
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

function getFileExtension(fileName = '') {
  return path.extname(String(fileName)).toLowerCase();
}

function getAuthenticatedUserId(request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return DEFAULT_USER_ID;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return decoded?.id || DEFAULT_USER_ID;
  } catch {
    return DEFAULT_USER_ID;
  }
}

function getUploadedFile(formData) {
  const file = formData.get('resume') || formData.get('file');

  if (!file || typeof file === 'string') {
    return null;
  }

  return file;
}

function isAllowedUpload(file) {
  const extension = getFileExtension(file?.name || '');
  const mimeType = String(file?.type || '').toLowerCase();

  return ALLOWED_EXTENSIONS.has(extension) || ALLOWED_MIME_TYPES.has(mimeType);
}

async function writeTempFile(file) {
  const tempFileName = `smarthire-resume-${Date.now()}-${randomUUID()}${getFileExtension(file.name || '') || '.tmp'}`;
  const tempFilePath = path.join(os.tmpdir(), tempFileName);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await fs.writeFile(tempFilePath, buffer);
  return tempFilePath;
}

export async function POST(request) {
  let tempFilePath = null;

  try {
    const formData = await request.formData();
    const file = getUploadedFile(formData);

    if (!file) {
      return NextResponse.json(
        { error: 'Please upload a resume file (PDF, DOCX, or TXT).' },
        { status: 400 }
      );
    }

    if (!isAllowedUpload(file)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or MD.' },
        { status: 400 }
      );
    }

    if (typeof file.size === 'number' && file.size > MAX_RESUME_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Resume file is too large. Please upload a file under 4MB.' },
        { status: 400 }
      );
    }

    const userId = getAuthenticatedUserId(request);
    tempFilePath = await writeTempFile(file);

    console.info('[analyze/resume] upload received', {
      userId,
      originalName: file.name,
      mimetype: file.type,
      size: file.size,
      aiMode: isAnthropicConfigured() ? 'claude' : 'fallback',
    });

    const rawText = await extractTextFromFile(tempFilePath, file.type);
    console.info('[analyze/resume] extracted resume text', {
      length: String(rawText || '').length,
      preview: previewText(rawText, 3000),
    });

    if (!rawText || String(rawText).trim().length < 100) {
      return NextResponse.json(
        {
          error: 'Could not extract text from file. Please ensure the file is not scanned/image-based.',
        },
        { status: 400 }
      );
    }

    const cleanedText = cleanText(rawText);
    console.info('[analyze/resume] cleaned resume text', {
      length: String(cleanedText || '').length,
      preview: previewText(cleanedText, 3000),
    });

    const resumeData = await extractResumeData(cleanedText);
    const analysis = await saveAnalysis(userId, resumeData, cleanedText);

    return NextResponse.json({
      analysisId: analysis.id,
      resumeData,
    });
  } catch (err) {
    if (err?.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'AI could not parse this resume format. Please try a cleaner PDF.' },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: err?.message || 'Could not analyze resume.' },
      { status: 500 }
    );
  } finally {
    if (tempFilePath) {
      try {
        deleteFile(tempFilePath);
      } catch {
        try {
          await fs.unlink(tempFilePath);
        } catch {
          // Ignore cleanup errors in /tmp.
        }
      }
    }
  }
}