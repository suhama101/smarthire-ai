const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { extractTextFromFile, cleanText, deleteFile } = require('../services/resumeParser');
const { extractResumeData, matchJobDescription, generateLearningPlan, isAnthropicConfigured } = require('../services/claudeService');
const { saveAnalysis, getAnalysisById, saveJobMatch, deleteAnalysisById, deleteJobMatchById } = require('../services/db');

const router = express.Router();

function previewText(value, maxLength = 2500) {
  const text = String(value || '');

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}... [truncated ${text.length - maxLength} chars]`;
}

router.get('/', (req, res) => {
  res.json({
    message: 'Analyze API is live',
    endpoints: ['POST /resume', 'POST /match', 'POST /learning-plan'],
  });
});

// POST /api/analyze/resume
// Upload and analyze a resume with Claude AI
router.post('/resume', requireAuth, upload.single('resume'), async (req, res, next) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a resume file (PDF or DOCX).' });
    }

    filePath = req.file.path;
    console.info('[analyze/resume] upload received', {
      userId: req.user.id,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      aiMode: isAnthropicConfigured() ? 'claude' : 'fallback',
    });

    const rawText = await extractTextFromFile(filePath, req.file.mimetype);
    console.info('[analyze/resume] extracted resume text', {
      length: String(rawText || '').length,
      preview: previewText(rawText, 3000),
    });

    if (!rawText || rawText.trim().length < 100) {
      return res.status(400).json({ error: 'Could not extract text from file. Please ensure the file is not scanned/image-based.' });
    }

    const cleanedText = cleanText(rawText);
    console.info('[analyze/resume] cleaned resume text', {
      length: String(cleanedText || '').length,
      preview: previewText(cleanedText, 3000),
    });

    const resumeData = await extractResumeData(cleanedText);

    // Step 3: Save to database
    const analysis = await saveAnalysis(req.user.id, resumeData, cleanedText);

    // Cleanup uploaded file
    deleteFile(filePath);

    res.json({
      message: 'Resume analyzed successfully!',
      analysisId: analysis.id,
      resumeData,
      createdAt: analysis.created_at,
      dataSource: isAnthropicConfigured() ? 'claude' : 'fallback',
    });
  } catch (err) {
    if (filePath) deleteFile(filePath);

    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }

    if (err instanceof SyntaxError) {
      return res.status(422).json({ error: 'AI could not parse this resume format. Please try a cleaner PDF.' });
    }

    next(err);
  }
});

// POST /api/analyze/match
// Match a previously analyzed resume against a job description
router.post('/match', requireAuth, async (req, res, next) => {
  try {
    const { analysisId, jobTitle, companyName, jobDescription } = req.body;

    if (!analysisId || !jobDescription) {
      return res.status(400).json({ error: 'analysisId and jobDescription are required.' });
    }

    console.info('[analyze/match] request received', {
      userId: req.user.id,
      analysisId,
      jobTitle,
      companyName,
      jobDescriptionLength: String(jobDescription || '').length,
      jobDescriptionPreview: previewText(jobDescription, 3000),
      aiMode: isAnthropicConfigured() ? 'claude' : 'fallback',
    });

    if (jobDescription.length < 50) {
      return res.status(400).json({ error: 'Job description is too short. Please paste the full job description.' });
    }

    // Get the resume analysis
    const analysis = await getAnalysisById(analysisId, req.user.id);
    if (!analysis) {
      return res.status(404).json({ error: 'Resume analysis not found.' });
    }

    const matchResult = await matchJobDescription(analysis.resume_data, jobDescription);

    // Save the match
    const jobMatch = await saveJobMatch(
      analysisId,
      req.user.id,
      jobTitle || 'Unknown Role',
      companyName || 'Unknown Company',
      jobDescription,
      matchResult
    );

    res.json({
      message: 'Job match complete!',
      matchId: jobMatch.id,
      matchResult,
      createdAt: jobMatch.created_at,
      dataSource: isAnthropicConfigured() ? 'claude' : 'fallback',
    });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }

    if (err instanceof SyntaxError) {
      return res.status(422).json({ error: 'AI could not process this job description. Please try again.' });
    }

    next(err);
  }
});

// POST /api/analyze/learning-plan
// Generate personalized learning plan for missing skills
router.post('/learning-plan', requireAuth, async (req, res, next) => {
  try {
    const { missingSkills, targetRole, yearsExperience } = req.body;

    if (!missingSkills || !Array.isArray(missingSkills) || missingSkills.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of missing skills.' });
    }

    console.info('[analyze/learning-plan] request received', {
      userId: req.user.id,
      missingSkills,
      targetRole,
      yearsExperience,
      aiMode: isAnthropicConfigured() ? 'claude' : 'fallback',
    });

    const learningPlan = await generateLearningPlan(
      missingSkills.slice(0, 10), // Cap at 10 skills
      targetRole || 'Software Engineer',
      yearsExperience || 1
    );

    res.json({
      message: 'Learning plan generated!',
      learningPlan,
      dataSource: isAnthropicConfigured() ? 'claude' : 'fallback',
    });
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message });
    }

    if (err instanceof SyntaxError) {
      return res.status(422).json({ error: 'AI could not generate plan. Please try again.' });
    }

    next(err);
  }
});

// DELETE /api/analyze/analysis/:analysisId
// Delete a resume analysis for the current user
router.delete('/analysis/:analysisId', requireAuth, async (req, res, next) => {
  try {
    const { analysisId } = req.params;
    if (!analysisId) {
      return res.status(400).json({ error: 'analysisId is required.' });
    }

    const deleted = await deleteAnalysisById(analysisId, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Resume analysis not found.' });
    }

    return res.json({ message: 'Analysis deleted.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/analyze/match/:matchId
// Delete a stored match result for the current user
router.delete('/match/:matchId', requireAuth, async (req, res, next) => {
  try {
    const { matchId } = req.params;
    if (!matchId) {
      return res.status(400).json({ error: 'matchId is required.' });
    }

    const deleted = await deleteJobMatchById(matchId, req.user.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Job match not found.' });
    }

    return res.json({ message: 'Job match deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
