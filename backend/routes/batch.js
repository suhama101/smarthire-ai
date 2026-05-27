const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { uploadBatch } = require('../middleware/upload');
const { extractTextFromFile, cleanText, deleteFile } = require('../services/resumeParser');
const { extractResumeData, matchJobDescription, isAnthropicConfigured } = require('../services/claudeService');
const { saveBatchRun } = require('../services/db');

const router = express.Router();
const DEFAULT_USER_ID = 'public-user';

function previewText(value, maxLength = 2500) {
  const text = String(value || '');

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}... [truncated ${text.length - maxLength} chars]`;
}

function getCandidateName(resumeData, file) {
  const extractedName = String(resumeData?.name || '').trim();

  if (extractedName && extractedName.toLowerCase() !== 'unknown') {
    return extractedName;
  }

  const originalName = String(file?.originalname || '').trim();
  if (originalName) {
    return path.parse(originalName).name || originalName;
  }

  return 'Unknown Candidate';
}

function parseJsonBodyFile(req) {
  const fileBase64 = String(req.body?.fileBase64 || '').trim();
  const fileName = String(req.body?.fileName || '').trim();
  const mimeType = String(req.body?.mimeType || '').trim();

  if (!fileBase64 || !fileName) {
    return null;
  }

  const buffer = Buffer.from(fileBase64, 'base64');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smarthire-batch-'));
  const filePath = path.join(tempDir, fileName);

  fs.writeFileSync(filePath, buffer);

  return {
    fieldName: 'resume',
    originalname: fileName,
    mimetype: mimeType || 'application/octet-stream',
    path: filePath,
    isTempJsonUpload: true,
  };
}

function runBatchUploadMiddleware(req, res) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();

  if (!contentType.includes('multipart/form-data')) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    uploadBatch(req, res, (err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

router.post('/analyze', async (req, res, next) => {
  const userId = req.user?.id || DEFAULT_USER_ID;
  const files = [];
  const isJsonSingleFileRequest = !String(req.headers['content-type'] || '').toLowerCase().includes('multipart/form-data');

  try {
    await runBatchUploadMiddleware(req, res);
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }

    return next(err);
  }

  if (Array.isArray(req.files) && req.files.length) {
    files.push(...req.files);
  }

  const jsonUpload = parseJsonBodyFile(req);
  if (!files.length && jsonUpload) {
    files.push(jsonUpload);
  }

  const rawJobDescription = req.body?.job_description ?? req.body?.jobDescription;
  const jobDescription = typeof rawJobDescription === 'string' ? rawJobDescription.trim() : '';

  if (!files.length) {
    return res.status(400).json({ error: 'Please upload at least one resume file.' });
  }

  if (!jobDescription) {
    return res.status(400).json({ error: 'Job description is required to analyze and rank candidates' });
  }

  console.info('[batch/analyze] request received', {
    userId,
    fileCount: files.length,
    jobDescriptionLength: jobDescription.length,
    jobDescriptionPreview: previewText(jobDescription, 3000),
    aiMode: isAnthropicConfigured() ? 'claude' : 'fallback',
  });

  const rankedCandidates = [];

  try {
    for (const file of files) {
      const filePath = file?.path;

      if (!filePath) {
        continue;
      }

      try {
        const rawText = await extractTextFromFile(filePath, file.mimetype);

        if (!rawText || rawText.trim().length < 100) {
          return res.status(400).json({
            error: `Could not extract text from ${file.originalname || 'one of the uploaded files'}. Please ensure the file is not scanned/image-based.`,
          });
        }

        const cleanedText = cleanText(rawText);
        const resumeData = await extractResumeData(cleanedText);
        const matchResult = await matchJobDescription(resumeData, jobDescription, req.body?.jobTitle || 'Unknown Role');

        rankedCandidates.push({
          name: getCandidateName(resumeData, file),
          score: Number(matchResult?.overallScore) || 0,
          matchedSkills: Array.isArray(matchResult?.matchedSkills) ? matchResult.matchedSkills : [],
        });
      } finally {
        deleteFile(filePath);

        if (file?.isTempJsonUpload) {
          const tempDir = path.dirname(filePath);

          try {
            fs.rmdirSync(tempDir);
          } catch {
            // Best-effort cleanup only.
          }
        }
      }
    }

    const sortedCandidates = rankedCandidates
      .sort((left, right) => right.score - left.score || String(left.name).localeCompare(String(right.name)))
      .map((candidate, index) => ({
        rank: index + 1,
        name: candidate.name,
        score: candidate.score,
        matchedSkills: candidate.matchedSkills,
      }));

    if (isJsonSingleFileRequest && sortedCandidates.length === 1) {
      return res.json({
        candidateName: sortedCandidates[0].name,
        matchScore: sortedCandidates[0].score,
        matchedSkills: sortedCandidates[0].matchedSkills,
      });
    }

    return res.json({
      message: 'Batch analysis completed successfully!',
      rankedCandidates: sortedCandidates,
    });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }

    next(err);
  }
});

router.post('/save', async (req, res, next) => {
  try {
    const userId = String(req.user?.id || req.body?.userId || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID;
    const jobDescription = String(req.body?.jobDescription || req.body?.job_description || '').trim();
    const incomingCandidates = Array.isArray(req.body?.candidates) ? req.body.candidates : [];
    const totalCandidates = Number(req.body?.totalCandidates ?? req.body?.total_candidates ?? incomingCandidates.length) || 0;

    if (!jobDescription) {
      return res.status(400).json({ error: 'jobDescription is required.' });
    }

    if (!incomingCandidates.length) {
      return res.status(400).json({ error: 'candidates must be a non-empty array.' });
    }

    const candidates = incomingCandidates.map((candidate) => ({
      candidateName: String(candidate?.candidateName || candidate?.name || 'Candidate').trim(),
      matchScore: Number(candidate?.matchScore ?? candidate?.score) || 0,
      matchedSkills: Array.isArray(candidate?.matchedSkills) ? candidate.matchedSkills : [],
      missingSkills: Array.isArray(candidate?.missingSkills) ? candidate.missingSkills : [],
      recommendation: String(candidate?.recommendation || 'Review manually').trim(),
      summary: String(candidate?.summary || '').trim(),
      profile: candidate?.profile && typeof candidate.profile === 'object' ? candidate.profile : null,
    }));

    const batchRun = await saveBatchRun(userId, jobDescription, candidates, totalCandidates || candidates.length);

    return res.status(201).json({
      message: 'Batch run saved successfully.',
      batchRun,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;