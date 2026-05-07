import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import PDFParser from 'pdf2json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

export async function POST(req) {
  try {
    console.log('=== BATCH ROUTE REACHED ===');
    console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
    console.log('GEMINI_MODEL:', process.env.GEMINI_MODEL);

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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'GEMINI_API_KEY not configured',
        },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite',
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.1,
      },
    });

    const results = [];

    for (const file of files) {
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

        const prompt = `Parse resume and match to job.
Return ONLY raw JSON. No markdown. No backticks.

RESUME (first 2500 chars):
${extractedText.substring(0, 2500)}

JOB TITLE: ${jobTitle}
JOB DESCRIPTION: ${String(jobDescription).substring(0, 300)}

JSON:
{
  "candidateName": "full name",
  "email": "email or empty",
  "phone": "phone or empty",
  "experienceLevel": "Fresher or Junior or Mid-level or Senior",
  "technicalSkills": ["skill1","skill2","skill3"],
  "matchScore": 70,
  "matchedSkills": ["skill1","skill2"],
  "missingSkills": ["skill1"],
  "recommendation": "Strong Match or Good Match or Weak Match",
  "summary": "one sentence about this candidate fit",
  "overallScore": 70,
  "hiringRecommendation": "Strong Hire or Hire or Maybe or Pass"
}`;

        let parsed = null;

        try {
          const result = await model.generateContent(prompt);
          const raw = result.response.text();
          parsed = JSON.parse(extractJsonBlock(raw));
          parsed.matchScore = Number(parsed.matchScore) || 0;
          parsed.overallScore = Number(parsed.overallScore) || 0;
          parsed.technicalSkills = Array.isArray(parsed.technicalSkills) ? parsed.technicalSkills : [];
          parsed.matchedSkills = Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills : [];
          parsed.missingSkills = Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [];
        } catch {
          results.push({
            fileName,
            success: false,
            error: 'AI could not analyze this resume',
          });
          continue;
        }

        results.push({
          fileName,
          success: true,
          data: normalizeResult(parsed, fileName),
        });

        await new Promise((resolve) => setTimeout(resolve, 1500));
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
    });
  } catch (err) {
    console.error('BATCH ROUTE ERROR:', err);

    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Batch processing failed',
      },
      { status: 500 }
    );
  }
}