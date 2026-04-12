const express = require('express');
const path = require('path');
const { uploadBatch } = require('../middleware/upload');
const { extractTextFromFile, cleanText, deleteFile } = require('../services/resumeParser');
const { extractResumeData, matchJobDescription, isAnthropicConfigured } = require('../services/claudeService');

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

router.post('/analyze', uploadBatch, async (req, res, next) => {
  const userId = req.user?.id || DEFAULT_USER_ID;
  const files = Array.isArray(req.files) ? req.files : [];
  const jobDescription = String(req.body?.job_description || '').trim();

  if (!files.length) {
    return res.status(400).json({ error: 'Please upload at least one resume file.' });
  }

  if (!jobDescription) {
    return res.status(400).json({ error: 'job_description is required.' });
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
        const matchResult = await matchJobDescription(resumeData, jobDescription);

        rankedCandidates.push({
          name: getCandidateName(resumeData, file),
          score: Number(matchResult?.overallScore) || 0,
          matchedSkills: Array.isArray(matchResult?.matchedSkills) ? matchResult.matchedSkills : [],
        });
      } finally {
        deleteFile(filePath);
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

    return res.json(sortedCandidates);
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }

    next(err);
  }
});

module.exports = router;