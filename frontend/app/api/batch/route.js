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
      summary: 'Analysis completed using fallback matching because Gemini quota or parsing failed.',
      overallScore: matchScore,
      hiringRecommendation: matchScore >= 75 ? 'Hire' : matchScore >= 50 ? 'Maybe' : 'Pass',
    },
    candidateName
  );
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

        const prompt = `You are a senior technical recruiter.
Your job is to accurately match resumes to job requirements.

CRITICAL MATCHING RULES:
- Match skills flexibly and intelligently
- "Next.js" = "Nextjs" = "NextJS" = "next js"
- "Node.js" = "Nodejs" = "NodeJS" = "node js"  
- "React.js" = "Reactjs" = "ReactJS" = "React"
- "Express.js" = "Expressjs" = "Express js"
- "JavaScript" = "Javascript" = "JS"
- "TypeScript" = "Typescript" = "TS"
- "C++" = "CPP" = "c plus plus"
- "Machine Learning" = "ML"
- "Artificial Intelligence" = "AI"
- If a skill appears ANYWHERE in resume text, 
  it counts as matched
- Do NOT be strict - be intelligent and generous
- Consider related skills as partial matches
- Years of experience: estimate from dates in resume

RESUME FULL TEXT:
${extractedText.substring(0, 3000)}

JOB TITLE: ${jobTitle}

JOB DESCRIPTION (extract required skills from this):
${jobDescription.substring(0, 500)}

TASK:
Step 1: Extract ALL skills mentioned anywhere in resume
Step 2: Extract ALL skills required in job description
Step 3: Match them using flexible rules above
Step 4: Calculate matchScore as percentage

matchScore calculation:
- Count how many job-required skills exist in resume
- matchScore = (matched / total required) * 100
- Round to nearest 10
- Minimum score is 10 if candidate has any relevant skills
- If 8 out of 10 skills match = 80%
- If 3 out of 10 skills match = 30%

IMPORTANT: 
- Never return 0% unless resume has zero relevant content
- Never return 20% if most skills actually match
- Be accurate and fair

Return ONLY raw JSON, no markdown, no backticks, 
nothing before or after the JSON object:

{
  "candidateName": "extract full name from first line of resume",
  "email": "extract email from resume",
  "phone": "extract phone from resume",
  "experienceLevel": "Fresher or Junior or Mid-level or Senior",
  "totalExperience": "estimated years e.g. 1 year",
  "technicalSkills": [
    "list ALL skills found anywhere in resume"
  ],
  "matchScore": 75,
  "matchedSkills": [
    "skills from job description found in resume"
  ],
  "missingSkills": [
    "skills from job description NOT found in resume"
  ],
  "recommendation": "Strong Match or Good Match or Weak Match or No Match",
  "summary": "2 sentences explaining why this candidate matches or not",
  "overallScore": 75,
  "hiringRecommendation": "Strong Hire or Hire or Maybe or Pass"
}`;

        let parsed = null;
        const fallbackResult = buildFallbackAnalysis(extractedText, jobTitle, jobDescription, fileName);

        try {
          const result = await model.generateContent(prompt);
          const raw = result.response.text();
          
          console.log('RAW GEMINI RESPONSE:', raw.substring(0, 300));

          // Multiple cleaning strategies
          let cleaned = raw
            .replace(/```json/gi, '')
            .replace(/```/gi, '')
            .trim();

          // Find first { and last }
          const firstBrace = cleaned.indexOf('{');
          const lastBrace = cleaned.lastIndexOf('}');

          if (firstBrace === -1 || lastBrace === -1) {
            throw new Error('No JSON object found in response');
          }

          cleaned = cleaned.substring(firstBrace, lastBrace + 1);

          parsed = JSON.parse(cleaned);

          // Ensure required fields exist with defaults
          parsed.candidateName = parsed.candidateName || file.name.replace('.pdf', '');
          parsed.matchScore = Number(parsed.matchScore) || 0;
          parsed.overallScore = Number(parsed.overallScore) || 0;
          parsed.technicalSkills = Array.isArray(parsed.technicalSkills) 
            ? parsed.technicalSkills : [];
          parsed.matchedSkills = Array.isArray(parsed.matchedSkills)
            ? parsed.matchedSkills : [];
          parsed.missingSkills = Array.isArray(parsed.missingSkills)
            ? parsed.missingSkills : [];
          parsed.recommendation = parsed.recommendation || 'Weak Match';
          parsed.summary = parsed.summary || 'Analysis completed.';
          parsed.hiringRecommendation = parsed.hiringRecommendation || 'Maybe';
        } catch (parseErr) {
          console.error('Parse error for', file.name, ':', parseErr.message);
          results.push({
            fileName: file.name,
            success: true,
            data: fallbackResult,
            warning: 'Fallback analysis used: ' + parseErr.message,
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