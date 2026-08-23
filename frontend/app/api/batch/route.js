import { NextResponse } from 'next/server';
import PDFParser from 'pdf2json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const BATCH_SOFT_TIMEOUT_MS = 50000;

async function extractTextFromPDF(buffer) {
  return new Promise((resolve) => {
    try {
      const pdfParser = new PDFParser(null, 1);

      const timeout = setTimeout(() => {
        resolve('extraction_timeout');
      }, 8000);

      pdfParser.on('pdfParser_dataError', () => {
        clearTimeout(timeout);
        resolve('');
      });

      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        clearTimeout(timeout);

        try {
          let text = '';

          pdfData.Pages.forEach((page) => {
            page.Texts.forEach((item) => {
              item.R.forEach((run) => {
                try {
                  text += decodeURIComponent(run.T) + ' ';
                } catch {
                  text += run.T + ' ';
                }
              });
            });

            text += '\n';
          });

          resolve(text.replace(/\s+/g, ' ').trim());
        } catch {
          resolve('');
        }
      });

      pdfParser.parseBuffer(buffer);
    } catch {
      resolve('');
    }
  });
}

function extractJsonBlock(rawText) {
  const cleaned = String(rawText || '')
    .replace(/```json/gi, '')
    .replace(/```/gi, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('AI response did not contain valid JSON.');
  }

  return cleaned.slice(firstBrace, lastBrace + 1);
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeResult(payload, fileName) {
  const data = payload && typeof payload === 'object' ? payload : {};

  return {
    candidateName: String(data.candidateName || fileName || 'Candidate').trim(),
    email: String(data.email || '').trim(),
    phone: String(data.phone || '').trim(),
    experienceLevel: String(data.experienceLevel || 'Mid-level').trim(),
    technicalSkills: normalizeStringArray(data.technicalSkills),
    matchScore: Number(data.matchScore) || 0,
    matchedSkills: normalizeStringArray(data.matchedSkills),
    missingSkills: normalizeStringArray(data.missingSkills),
    recommendation: String(data.recommendation || 'Review manually').trim(),
    summary: String(data.summary || '').trim(),
    overallScore: Number(data.overallScore) || 0,
    hiringRecommendation: String(data.hiringRecommendation || 'Maybe').trim(),
  };
}

function extractSkillKeywords(text) {
  const normalized = String(text || '').toLowerCase();
  const keywords = [
    'javascript', 'typescript', 'react', 'next.js', 'node.js', 'express', 'python', 'java', 'sql', 'postgresql',
    'mysql', 'mongodb', 'redis', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'html', 'css',
    'tailwind', 'redux', 'graphql', 'testing', 'jest', 'cypress', 'playwright', 'git', 'devops', 'accessibility',
    'api', 'frontend', 'backend', 'cloud', 'security', 'architecture', 'communication', 'leadership', 'product',
  ];

  return Array.from(new Set(keywords.filter((keyword) => normalized.includes(keyword))));
}

function buildFallbackAnalysis(resumeText, jobTitle, jobDescription, fileName) {
  const candidateName = String(fileName || 'Candidate').replace(/\.[^.]+$/, '').trim() || 'Candidate';
  const resumeKeywords = extractSkillKeywords(resumeText);
  const jobKeywords = extractSkillKeywords(`${jobTitle} ${jobDescription}`);
  const matchedSkills = resumeKeywords.filter((skill) => jobKeywords.includes(skill));
  const missingSkills = jobKeywords.filter((skill) => !matchedSkills.includes(skill));
  const matchScore = jobKeywords.length ? Math.max(20, Math.min(90, Math.round((matchedSkills.length / jobKeywords.length) * 100))) : 50;

  return normalizeResult(
    {
      candidateName,
      email: '',
      experienceLevel: matchScore >= 75 ? 'Senior' : matchScore >= 50 ? 'Mid-level' : 'Junior',
      technicalSkills: resumeKeywords,
      matchScore,
      matchedSkills,
      missingSkills,
      recommendation: matchScore >= 75 ? 'Good Match' : matchScore >= 50 ? 'Weak Match' : 'Weak Match',
      summary: 'Analysis completed using fallback matching because Groq parsing failed.',
      overallScore: matchScore,
      hiringRecommendation: matchScore >= 75 ? 'Hire' : matchScore >= 50 ? 'Maybe' : 'Pass',
    },
    candidateName
  );
}

export async function POST(req) {
  try {
    const startedAt = Date.now();
    console.log('=== BATCH ROUTE REACHED ===');
    console.log('GROQ_API_KEY exists:', !!process.env.GROQ_API_KEY);
    const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    console.log('GROQ_MODEL:', groqModel);

    let formData;
    try {
      formData = await req.formData();
    } catch (e) {
      console.error('FormData parse error:', e.message);
      return NextResponse.json(
        {
          success: false,
          error: `Could not read form data: ${e.message}`,
        },
        { status: 400 }
      );
    }

    const jobTitle = formData.get('jobTitle') || '';
    const jobDescription = formData.get('jobDescription') || '';

    const files = formData.getAll('files');
    console.log('Files received:', files.length);
    console.log('File names:', files.map((file) => file?.name));

    if (!files || files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No files received. Files count: ${files.length}`,
        },
        { status: 400 }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'GROQ_API_KEY not configured',
        },
        { status: 500 }
      );
    }

    const results = [];
    let timedOut = false;

    for (const file of files) {
      if (Date.now() - startedAt > BATCH_SOFT_TIMEOUT_MS) {
        timedOut = true;
        results.push({
          fileName: file?.name || 'Unknown file',
          success: false,
          error: 'Batch stopped early to avoid timing out. Try fewer files per run.',
        });
        break;
      }

      try {
        const fileName = file.name;
        const buffer = Buffer.from(await file.arrayBuffer());
        const lowerName = fileName.toLowerCase();

        let extractedText = '';

        if (lowerName.endsWith('.pdf')) {
          extractedText = await extractTextFromPDF(buffer);
        } else if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
          extractedText = buffer.toString('utf-8');
        } else {
          extractedText = buffer.toString('utf-8');
        }

        if (!extractedText || extractedText.length < 20) {
          results.push({
            fileName,
            success: false,
            error: 'Could not read file content',
          });
          continue;
        }

        const fallbackResult = buildFallbackAnalysis(extractedText, jobTitle, jobDescription, fileName);

        results.push({
          fileName,
          success: true,
          data: normalizeResult(fallbackResult, fileName),
        });
      } catch (fileErr) {
        results.push({
          fileName: file.name,
          success: false,
          error: fileErr?.message || 'Processing failed',
        });
      }
    }

    const successful = results.filter((result) => result.success);

    return NextResponse.json({
      success: true,
      results,
      total: results.length,
      successful: successful.length,
      failed: results.length - successful.length,
      timedOut,
    });
  } catch (err) {
    console.error('BATCH ROUTE ERROR:', err);

    return Response.json(
      {
        success: false,
        error: err?.message || 'Batch processing failed',
      },
      { status: 500 }
    );
  }
}