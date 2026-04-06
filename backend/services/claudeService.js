const Groq = require('groq-sdk');

let client;
const RESUME_TEXT_LIMIT = 24000;
const JOB_DESCRIPTION_LIMIT = 6000;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const DEBUG_AI_LOGS = process.env.SMART_HIRE_DEBUG_AI_LOGS !== '0';
const FALLBACK_TECH_KEYWORDS = [
  { token: 'javascript', label: 'JavaScript' },
  { token: 'typescript', label: 'TypeScript' },
  { token: 'python', label: 'Python' },
  { token: 'java', label: 'Java' },
  { token: 'c++', label: 'C++' },
  { token: 'c#', label: 'C#' },
  { token: 'go', label: 'Go' },
  { token: 'rust', label: 'Rust' },
  { token: 'react', label: 'React' },
  { token: 'next.js', label: 'Next.js' },
  { token: 'node.js', label: 'Node.js' },
  { token: 'express', label: 'Express' },
  { token: 'nestjs', label: 'NestJS' },
  { token: 'django', label: 'Django' },
  { token: 'flask', label: 'Flask' },
  { token: 'spring', label: 'Spring' },
  { token: 'mongodb', label: 'MongoDB' },
  { token: 'postgresql', label: 'PostgreSQL' },
  { token: 'mysql', label: 'MySQL' },
  { token: 'redis', label: 'Redis' },
  { token: 'docker', label: 'Docker' },
  { token: 'kubernetes', label: 'Kubernetes' },
  { token: 'aws', label: 'AWS' },
  { token: 'azure', label: 'Azure' },
  { token: 'gcp', label: 'GCP' },
  { token: 'git', label: 'Git' },
  { token: 'graphql', label: 'GraphQL' },
  { token: 'rest', label: 'REST' },
  { token: 'html', label: 'HTML' },
  { token: 'css', label: 'CSS' },
  { token: 'tailwind', label: 'Tailwind' },
];

class ClaudeIntegrationError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'ClaudeIntegrationError';
    this.status = status;
  }
}

function logAiDebug(step, payload) {
  if (!DEBUG_AI_LOGS) {
    return;
  }

  console.info(`[SmartHire AI] ${step}`, payload);
}

function previewText(value, maxLength = 3000) {
  const text = String(value || '');

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}... [truncated ${text.length - maxLength} chars]`;
}

function getClient() {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();

  if (!apiKey || apiKey === 'your_key_here') {
    throw new ClaudeIntegrationError('Missing GROQ_API_KEY in backend .env', 500);
  }

  if (!client) {
    client = new Groq({ apiKey });
  }

  return client;
}

function isAnthropicConfigured() {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  return Boolean(apiKey && apiKey !== 'your_key_here');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasKeyword(text, token) {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(token)}([^a-z0-9]|$)`, 'i');
  return pattern.test(text);
}

function buildFallbackResumeData(resumeText) {
  const text = String(resumeText || '').replace(/\s+/g, ' ').trim();
  const technicalSkills = FALLBACK_TECH_KEYWORDS
    .filter((skill) => hasKeyword(text, skill.token))
    .map((skill) => skill.label);

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const summary = text.slice(0, 260).trim();

  const normalized = normalizeResumeData({
    email: emailMatch ? emailMatch[0] : null,
    title: 'Candidate',
    summary: summary || 'Resume processed with fallback parser.',
    technicalSkills: technicalSkills.length ? technicalSkills : ['General Technical Skills'],
    keywords: technicalSkills,
  });

  return normalized;
}

function uniqueStrings(values) {
  return Array.from(
    new Set((values || []).map((item) => String(item).trim()).filter(Boolean))
  );
}

function normalizeSkill(value) {
  return String(value || '').trim().toLowerCase();
}

function buildFallbackMatchResult(resumeData, jobDescription) {
  const jdText = String(jobDescription || '');

  const jdSkills = uniqueStrings(
    FALLBACK_TECH_KEYWORDS
      .filter((skill) => hasKeyword(jdText, skill.token))
      .map((skill) => skill.label)
  );

  const candidateSkills = uniqueStrings([
    ...(resumeData?.technicalSkills || []),
    ...(resumeData?.frameworks || []),
    ...(resumeData?.languages || []),
    ...(resumeData?.databases || []),
    ...(resumeData?.tools || []),
  ]);

  const candidateSet = new Set(candidateSkills.map((item) => normalizeSkill(item)));
  const matchedSkills = jdSkills.filter((skill) => candidateSet.has(normalizeSkill(skill)));
  const missingSkills = jdSkills.filter((skill) => !candidateSet.has(normalizeSkill(skill)));

  const skillsCoverage = jdSkills.length
    ? Math.round((matchedSkills.length / jdSkills.length) * 100)
    : 60;

  const years = Number(resumeData?.yearsExperience) || 0;
  const experienceScore = Math.max(40, Math.min(100, 45 + years * 12));
  const keywordsScore = skillsCoverage;
  const educationScore = 70;
  const overallScore = Math.round(
    (skillsCoverage * 0.45) +
    (experienceScore * 0.25) +
    (keywordsScore * 0.2) +
    (educationScore * 0.1)
  );

  const strengths = [];
  if (matchedSkills.length) {
    strengths.push(`Matched ${matchedSkills.length} key skill(s): ${matchedSkills.slice(0, 5).join(', ')}`);
  }
  if (years > 0) {
    strengths.push(`${years} year(s) of reported experience.`);
  }
  if (!strengths.length) {
    strengths.push('Resume provides baseline transferable skills.');
  }

  const gaps = [];
  if (missingSkills.length) {
    gaps.push(`Missing skills: ${missingSkills.slice(0, 6).join(', ')}`);
  }
  if (years < 1) {
    gaps.push('Limited stated experience for role requirements.');
  }
  if (!gaps.length) {
    gaps.push('No major gaps detected from provided description.');
  }

  const recommendation = missingSkills.length
    ? `Candidate can improve fit by adding: ${missingSkills.slice(0, 4).join(', ')}.`
    : 'Strong skill alignment for the provided job description.';

  return {
    overallScore,
    breakdown: {
      technicalSkills: skillsCoverage,
      experience: experienceScore,
      keywords: keywordsScore,
      education: educationScore,
    },
    matchedSkills,
    missingSkills,
    strengths,
    gaps,
    recommendation,
    atsKeywords: missingSkills,
  };
}

function getClaudeText(response) {
  const directText = response?.choices?.[0]?.message?.content;

  if (typeof directText === 'string' && directText.trim()) {
    return directText.trim();
  }

  const content = Array.isArray(response?.content) ? response.content : [];
  const textChunks = content
    .filter((item) => item && item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text.trim())
    .filter(Boolean);

  return textChunks.join('\n').trim();
}

function parseClaudeJson(response) {
  const text = getClaudeText(response);

  if (!text) {
    throw new ClaudeIntegrationError('Claude returned an empty response', 502);
  }

  const clean = text.replace(/```json|```/gi, '').trim();

  try {
    return JSON.parse(clean);
  } catch (parseErr) {
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (nestedErr) {
        throw new ClaudeIntegrationError('Claude response was not valid JSON', 502);
      }
    }

    throw new ClaudeIntegrationError('Claude response did not contain JSON', 502);
  }
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampScore(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.max(0, Math.min(100, Math.round(fallback)));
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

const SKILL_RESOURCES_MAP = {
  'javascript': {
    priority: 'high',
    weeks: 3,
    resources: ['MDN Web Docs', 'JavaScript.info', 'freeCodeCamp JS Course', 'Eloquent JavaScript book'],
    projectIdea: 'Build interactive web components with vanilla JS',
    whyImportant: 'Essential skill for 90% of web development roles'
  },
  'typescript': {
    priority: 'high',
    weeks: 2,
    resources: ['TypeScript Official Docs', 'TypeScript Handbook', 'TSLearning.dev'],
    projectIdea: 'Convert existing JS project to TypeScript',
    whyImportant: 'Increasingly required for professional frontend/backend development'
  },
  'react': {
    priority: 'high',
    weeks: 4,
    resources: ['React Official Docs', 'React Tutorial', 'Scrimba React Course', 'Kent C. Dodds tutorials'],
    projectIdea: 'Build a multi-page React dashboard like SmartHire AI',
    whyImportant: 'Most demanded frontend framework in job market'
  },
  'node.js': {
    priority: 'high',
    weeks: 3,
    resources: ['Node.js Official Docs', 'Node.js Best Practices', 'Express.js Guide'],
    projectIdea: 'Build a REST API with Express and MongoDB',
    whyImportant: 'Standard backend runtime for JavaScript developers'
  },
  'docker': {
    priority: 'high',
    weeks: 2,
    resources: ['Docker Official Docs', 'Play with Docker', 'Docker Mastery Course'],
    projectIdea: 'Containerize your current projects with Docker',
    whyImportant: 'Essential for DevOps and modern deployment practices'
  },
  'kubernetes': {
    priority: 'medium',
    weeks: 3,
    resources: ['Kubernetes Official Docs', 'Kubernetes by Example', 'Linux Academy K8s Course'],
    projectIdea: 'Deploy Docker container to Kubernetes cluster',
    whyImportant: 'Industry standard for container orchestration'
  },
  'aws': {
    priority: 'high',
    weeks: 4,
    resources: ['AWS Free Tier', 'AWS Training and Certification', 'A Cloud Guru AWS courses'],
    projectIdea: 'Deploy full-stack app to AWS EC2/RDS',
    whyImportant: 'AWS dominates cloud infrastructure market'
  },
  'python': {
    priority: 'high',
    weeks: 3,
    resources: ['Python.org Docs', 'Real Python', 'Codecademy Python Course'],
    projectIdea: 'Build data analysis or automation scripts',
    whyImportant: 'Essential for data science and machine learning'
  },
  'sql': {
    priority: 'high',
    weeks: 2,
    resources: ['SQL Tutorial', 'Mode SQL Tutorial', 'LeetCode SQL Problems'],
    projectIdea: 'Write complex queries for real-world problems',
    whyImportant: 'Required for backend and data roles'
  },
  'git': {
    priority: 'high',
    weeks: 1,
    resources: ['Git Official Docs', 'Atlassian Git Tutorials', 'Oh Shit Git'],
    projectIdea: 'Maintain GitHub portfolio with best practices',
    whyImportant: 'Fundamental skill for any developer job'
  }
};

function buildFallbackLearningPlan(missingSkills, targetRole, yearsExperience) {
  const skills = (missingSkills || []).slice(0, 10).map(s => String(s).toLowerCase().trim());
  
  const baseWeeks = yearsExperience < 1 ? 20 : yearsExperience < 2 ? 16 : 12;
  
  const priorities = skills.map(skill => {
    const skillNorm = skill.replace(/\s+/g, '').toLowerCase();
    
    // Try exact match first, then substring match
    let config = SKILL_RESOURCES_MAP[skillNorm];
    
    if (!config) {
      // Try to find partial match
      const keys = Object.keys(SKILL_RESOURCES_MAP);
      const partialKey = keys.find(k => 
        skillNorm.includes(k) || k.includes(skillNorm)
      );
      config = partialKey ? SKILL_RESOURCES_MAP[partialKey] : null;
    }
    
    const defaults = {
      priority: 'medium',
      weeks: 2,
      resources: [`Learn ${skill}`, `${skill} Best Practices`, `${skill} Advanced Topics`],
      projectIdea: `Build a project using ${skill}`,
      whyImportant: `${skill} is important for ${targetRole} roles`
    };
    
    const resourceConfig = config || defaults;
    
    return {
      skill: skill.charAt(0).toUpperCase() + skill.slice(1),
      priority: resourceConfig.priority,
      weekToComplete: resourceConfig.weeks,
      resources: resourceConfig.resources,
      projectIdea: resourceConfig.projectIdea,
      whyImportant: resourceConfig.whyImportant
    };
  });
  
  const highPrioritySkills = priorities
    .filter(p => p.priority === 'high')
    .map(p => p.skill)
    .slice(0, 3);
  
  const projectSuggestions = [
    `Build a ${targetRole} portfolio project`,
    `Contribute to open source projects using ${highPrioritySkills[0] || 'one of the missing'} skill`,
    `Create a real-world application combining multiple learned skills`,
    'Deploy your projects publicly on GitHub and live demo'
  ];
  
  const resumeTips = skills.slice(0, 5).map(skill => 
    `Add "${skill}" to technical skills section`
  ).concat([
    'Include projects using newly learned technologies',
    'Quantify impact of projects (users, performance improvements, etc)'
  ]);
  
  return {
    timelineWeeks: baseWeeks,
    priorities,
    projectSuggestions,
    resumeTips,
    estimatedImpact: `Adding ${Math.min(5, skills.length)} key skills increases match rate for "${targetRole}" by ~20-30%`
  };
}

function normalizeResumeData(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const technicalSkills = toArray(data.technicalSkills);
  const frameworks = toArray(data.frameworks);
  const languages = toArray(data.languages);
  const databases = toArray(data.databases);
  const tools = toArray(data.tools);

  const mergedSkills = Array.from(
    new Set([...technicalSkills, ...frameworks, ...languages, ...databases, ...tools])
  );

  return {
    name: typeof data.name === 'string' ? data.name : 'Unknown',
    email: typeof data.email === 'string' ? data.email : null,
    title: typeof data.title === 'string' ? data.title : 'Unknown',
    yearsExperience: toNumber(data.yearsExperience, 0),
    summary: typeof data.summary === 'string' ? data.summary.trim() : '',
    technicalSkills: mergedSkills,
    softSkills: toArray(data.softSkills),
    languages,
    frameworks,
    databases,
    tools,
    education: Array.isArray(data.education) ? data.education : [],
    experience: Array.isArray(data.experience) ? data.experience : [],
    certifications: toArray(data.certifications),
    keywords: toArray(data.keywords),
  };
}

function normalizeMatchResult(raw, fallbackResult) {
  const fallback = fallbackResult || {
    overallScore: 60,
    breakdown: {
      technicalSkills: 60,
      experience: 60,
      keywords: 60,
      education: 60,
    },
    matchedSkills: [],
    missingSkills: [],
    strengths: ['Baseline match estimate generated.'],
    gaps: ['Provide fuller resume and job description for better match quality.'],
    recommendation: 'Improve profile details and re-run analysis.',
    atsKeywords: [],
  };

  const data = raw && typeof raw === 'object' ? raw : {};
  const breakdown = data.breakdown && typeof data.breakdown === 'object' ? data.breakdown : {};

  return {
    overallScore: clampScore(data.overallScore, fallback.overallScore),
    breakdown: {
      technicalSkills: clampScore(breakdown.technicalSkills, fallback.breakdown.technicalSkills),
      experience: clampScore(breakdown.experience, fallback.breakdown.experience),
      keywords: clampScore(breakdown.keywords, fallback.breakdown.keywords),
      education: clampScore(breakdown.education, fallback.breakdown.education),
    },
    matchedSkills: uniqueStrings(toArray(data.matchedSkills)).length
      ? uniqueStrings(toArray(data.matchedSkills))
      : uniqueStrings(toArray(fallback.matchedSkills)),
    missingSkills: uniqueStrings(toArray(data.missingSkills)).length
      ? uniqueStrings(toArray(data.missingSkills))
      : uniqueStrings(toArray(fallback.missingSkills)),
    strengths: toArray(data.strengths).length
      ? toArray(data.strengths)
      : toArray(fallback.strengths),
    gaps: toArray(data.gaps).length
      ? toArray(data.gaps)
      : toArray(fallback.gaps),
    recommendation: typeof data.recommendation === 'string' && data.recommendation.trim()
      ? data.recommendation.trim()
      : String(fallback.recommendation || 'Improve profile details and re-run analysis.'),
    atsKeywords: uniqueStrings(toArray(data.atsKeywords)).length
      ? uniqueStrings(toArray(data.atsKeywords))
      : uniqueStrings(toArray(fallback.atsKeywords)),
  };
}

function normalizeLearningPlan(raw, fallbackPlan) {
  const fallback = fallbackPlan || {
    timelineWeeks: 8,
    priorities: [],
    projectSuggestions: [],
    resumeTips: [],
    estimatedImpact: 'Learning plan generated with safe defaults.',
  };

  const data = raw && typeof raw === 'object' ? raw : {};

  const sourcePriorities = Array.isArray(data.priorities) && data.priorities.length
    ? data.priorities
    : (Array.isArray(fallback.priorities) ? fallback.priorities : []);

  const priorities = sourcePriorities.map((item) => {
    const priority = String(item?.priority || '').toLowerCase();
    const normalizedPriority = ['high', 'medium', 'low'].includes(priority) ? priority : 'medium';

    return {
      skill: String(item?.skill || 'General Skill').trim(),
      priority: normalizedPriority,
      weekToComplete: Math.max(1, toNumber(item?.weekToComplete, 2)),
      resources: toArray(item?.resources),
      projectIdea: String(item?.projectIdea || 'Apply this skill in a portfolio project.').trim(),
      whyImportant: String(item?.whyImportant || 'Important for software engineering role readiness.').trim(),
    };
  });

  return {
    timelineWeeks: Math.max(1, toNumber(data.timelineWeeks, fallback.timelineWeeks || 8)),
    priorities,
    projectSuggestions: toArray(data.projectSuggestions).length
      ? toArray(data.projectSuggestions)
      : toArray(fallback.projectSuggestions),
    resumeTips: toArray(data.resumeTips).length
      ? toArray(data.resumeTips)
      : toArray(fallback.resumeTips),
    estimatedImpact: typeof data.estimatedImpact === 'string' && data.estimatedImpact.trim()
      ? data.estimatedImpact.trim()
      : String(fallback.estimatedImpact || 'Learning plan generated with safe defaults.'),
  };
}

function parseModelJsonOrFallback(response, options) {
  const { flowName, fallbackFactory } = options;

  try {
    const raw = parseClaudeJson(response);
    const text = getClaudeText(response);
    const clean = String(text || '').replace(/```json|```/gi, '').trim();

    if (clean && (clean.startsWith('{') || clean.endsWith('}'))) {
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch && jsonMatch[0] !== clean) {
        logAiDebug(`${flowName} model response had extra wrapper text; extracted JSON object safely`, {
          preview: previewText(clean, 800),
        });
      }
    }

    return raw;
  } catch (err) {
    logAiDebug(`${flowName} parse failed, using safe fallback JSON`, {
      error: err?.message,
    });
    return fallbackFactory();
  }
}

function validateResumeDataShape(data) {
  if (!data.summary || data.summary.length < 10) {
    throw new ClaudeIntegrationError('Claude response is missing a valid summary', 502);
  }

  if (!Array.isArray(data.technicalSkills) || data.technicalSkills.length === 0) {
    throw new ClaudeIntegrationError('Claude response is missing technical skills', 502);
  }
}

function mapAnthropicError(err) {
  if (err instanceof ClaudeIntegrationError) {
    return err;
  }

  const status = Number(err?.status || err?.response?.status) || 502;
  const message = err?.message || 'Groq request failed';
  return new ClaudeIntegrationError(message, status);
}

/**
 * Extract structured skills and profile from raw resume text
 */
async function extractResumeData(resumeText) {
  if (!isAnthropicConfigured()) {
    logAiDebug('Resume analysis using fallback mode', {
      reason: 'GROQ_API_KEY is missing or empty',
      resumeLength: String(resumeText || '').length,
    });
    return buildFallbackResumeData(resumeText);
  }

  try {
    const promptResumeText = String(resumeText || '').slice(0, RESUME_TEXT_LIMIT);
    const prompt = `Task: Parse the resume into structured JSON for software engineering hiring (Frontend, Backend, Full Stack).

  Critical rules:
  - Output must be a single valid JSON object only. No prose, no markdown, no comments.
  - Use exactly the keys and nesting shown below. Do not add extra keys.
  - If a value is unknown, use null for scalar fields or [] for arrays.
  - Extract only what is explicitly supported by the resume text. Do not infer or guess facts.
  - Keep skills canonical and deduplicated (for example "JavaScript", "TypeScript", "React", "Node.js", "Express", "REST APIs", "GraphQL", "PostgreSQL", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "CI/CD", "Git").
  - technicalSkills should contain only technical abilities/tools/frameworks/languages from evidence in the resume, with priority for modern software engineering stack signals.
  - For software roles, prioritize accurate extraction from these buckets when present in evidence:
    - Frontend: React, Next.js, TypeScript, state management, testing, UI performance/accessibility.
    - Backend: Node.js/Express/NestJS or other backend frameworks, API design (REST/GraphQL), auth/security basics, caching, message queues.
    - Data/Storage: SQL/NoSQL databases, schema/query proficiency, migrations, indexing awareness.
    - DevOps/Cloud: Docker, CI/CD, cloud deployment (AWS/Azure/GCP), monitoring/logging.
  - Do not add skills that are not explicitly stated or clearly evidenced.
  - summary must be grounded in resume evidence and be 2-3 concise sentences.
  - yearsExperience should be a number; if unclear, use 0.

  Return JSON with exactly this structure:
{
  "name": "Full Name",
  "email": "email or null",
  "title": "Current/Target Job Title",
  "yearsExperience": 3,
  "summary": "2-3 sentence professional summary",
  "technicalSkills": ["skill1", "skill2"],
  "softSkills": ["skill1", "skill2"],
  "languages": ["Python", "JavaScript"],
  "frameworks": ["React", "Node.js"],
  "databases": ["PostgreSQL", "MongoDB"],
  "tools": ["Git", "Docker"],
  "education": [{ "degree": "BSc Computer Science", "institution": "NUST", "year": 2022 }],
  "experience": [{ "title": "Software Engineer", "company": "Inotech", "duration": "1 year", "highlights": ["built X", "improved Y"] }],
  "certifications": ["AWS Certified", "etc"],
  "keywords": ["top 10 ATS keywords from this resume"]
}

Resume text:
${promptResumeText}`;

    logAiDebug('Resume prompt input', {
      resumeLength: promptResumeText.length,
      promptLength: prompt.length,
      resumePreview: previewText(promptResumeText, 2500),
      promptPreview: previewText(prompt, 4000),
    });

    const response = await getClient().chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 1500,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a deterministic resume parser. Return exactly one JSON object matching the requested schema, based only on provided evidence, with no hallucinations.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    logAiDebug('Resume Groq raw response', {
      model: response?.model,
      finish_reason: response?.choices?.[0]?.finish_reason,
      usage: response?.usage,
      content: response?.choices?.[0]?.message?.content,
    });

    const parsedResume = parseModelJsonOrFallback(response, {
      flowName: 'resume-analysis',
      fallbackFactory: () => buildFallbackResumeData(resumeText),
    });
    const normalized = normalizeResumeData(parsedResume);
    validateResumeDataShape(normalized);
    logAiDebug('Resume analysis parsed result', normalized);
    return normalized;
  } catch (err) {
    throw mapAnthropicError(err);
  }
}

/**
 * Match resume against a job description and return detailed scoring
 */
async function matchJobDescription(resumeData, jobDescription) {
  if (!isAnthropicConfigured()) {
    logAiDebug('Job matching using fallback mode', {
      reason: 'GROQ_API_KEY is missing or empty',
      jobDescriptionLength: String(jobDescription || '').length,
    });
    return buildFallbackMatchResult(resumeData, jobDescription);
  }

  try {
    const promptJobDescription = String(jobDescription || '').slice(0, JOB_DESCRIPTION_LIMIT);
    const prompt = `Task: Score candidate-job fit for software engineering roles (Frontend, Backend, Full Stack) conservatively and logically.

Critical rules:
- Output must be a single valid JSON object only. No prose, no markdown, no comments.
- Use exactly the keys and nesting shown below. Do not add extra keys.
- Use only the provided candidate fields and job description. Do not invent credentials, projects, education, or skills.
- scoring must be internally consistent:
  - overallScore must be an integer from 0 to 100.
  - each breakdown value must be an integer from 0 to 100.
  - overallScore should align with breakdown values (rough weighted logic: technicalSkills 45%, experience 25%, keywords 20%, education 10%).
- matchedSkills: include only skills clearly present in BOTH candidate data and JD.
- missingSkills: include only JD-required skills not present in candidate data.
- strengths and gaps: write evidence-based, specific statements only.
- recommendation: concise and practical; avoid generic fluff.
- atsKeywords: include JD terms that are relevant and currently underrepresented in candidate data.
- Evaluate using realistic multinational software hiring expectations:
  - Core coding stack fit (JavaScript/TypeScript, frontend/backend frameworks, API development).
  - Practical engineering depth (testing, debugging, code quality, maintainability).
  - Production readiness (databases, cloud exposure, observability basics, secure auth patterns).
  - Collaboration signals (Git workflows, CI/CD familiarity, cross-team delivery context when evidenced).
  - Seniority alignment via yearsExperience and role title match.
- For missingSkills, prioritize practical gaps commonly expected in modern roles when relevant to the JD, such as Docker, CI/CD, system design basics, API security, cloud deployment, testing strategy, and database design.
- Be conservative: if JD asks for a capability and resume evidence is weak/absent, treat it as a gap.

CANDIDATE SKILLS: ${JSON.stringify(resumeData.technicalSkills || [])}
CANDIDATE LANGUAGES: ${JSON.stringify(resumeData.languages || [])}
CANDIDATE FRAMEWORKS: ${JSON.stringify(resumeData.frameworks || [])}
CANDIDATE EXPERIENCE: ${resumeData.yearsExperience || 0} years
CANDIDATE TITLE: ${resumeData.title || 'Unknown'}

JOB DESCRIPTION:
${promptJobDescription}

Return JSON with exactly this structure:
{
  "overallScore": 78,
  "breakdown": {
    "technicalSkills": 85,
    "experience": 70,
    "keywords": 80,
    "education": 75
  },
  "matchedSkills": ["React", "Node.js"],
  "missingSkills": ["Docker", "Kubernetes"],
  "strengths": ["Strong React experience", "Good Node.js background"],
  "gaps": ["No cloud experience", "Missing CI/CD knowledge"],
  "recommendation": "Strong candidate. Focus on adding Docker and cloud skills.",
  "atsKeywords": ["keywords from JD that candidate should add to resume"]
}`;

    logAiDebug('Match prompt input', {
      candidateSkills: resumeData?.technicalSkills || [],
      candidateLanguages: resumeData?.languages || [],
      candidateFrameworks: resumeData?.frameworks || [],
      jobDescriptionLength: promptJobDescription.length,
      promptLength: prompt.length,
      jobDescriptionPreview: previewText(promptJobDescription, 2500),
      promptPreview: previewText(prompt, 4000),
    });

    const response = await getClient().chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 1500,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a strict technical recruiter evaluator. Produce evidence-based scoring and return exactly one JSON object in the requested schema.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    logAiDebug('Match Groq raw response', {
      model: response?.model,
      finish_reason: response?.choices?.[0]?.finish_reason,
      usage: response?.usage,
      content: response?.choices?.[0]?.message?.content,
    });

    const fallbackMatch = buildFallbackMatchResult(resumeData, jobDescription);
    const parsed = parseModelJsonOrFallback(response, {
      flowName: 'job-match',
      fallbackFactory: () => fallbackMatch,
    });
    const normalized = normalizeMatchResult(parsed, fallbackMatch);
    logAiDebug('Match parsed result', normalized);
    return normalized;
  } catch (err) {
    throw mapAnthropicError(err);
  }
}

/**
 * Generate a personalized learning plan to close skills gaps
 */
async function generateLearningPlan(missingSkills, targetRole, currentLevel) {
  if (!isAnthropicConfigured()) {
    logAiDebug('Learning plan using fallback mode', {
      reason: 'GROQ_API_KEY is missing or empty',
      missingSkills,
      targetRole,
      currentLevel,
    });
    return buildFallbackLearningPlan(missingSkills, targetRole, currentLevel);
  }

  try {
    const prompt = `Task: Create a practical learning plan from missing skills for software engineering career growth (Frontend, Backend, Full Stack).

  Critical rules:
  - Output must be a single valid JSON object only. No prose, no markdown, no comments.
  - Use exactly the keys and nesting shown below. Do not add extra keys.
  - Base the plan on SKILLS TO LEARN only; do not invent unrelated skill tracks.
  - Prioritize foundational and job-relevant software engineering skills first.
  - weekToComplete should be a realistic integer per skill.
  - resources should be practical and credible (official docs, well-known tutorials/platforms).
  - projectSuggestions and resumeTips must directly reflect the missing skills and target role.
  - estimatedImpact should be cautious and realistic, not exaggerated.
  - Favor industry-relevant sequencing for software roles:
    - fundamentals first (APIs, database basics, testing, Git workflows),
    - then production skills (Docker, CI/CD, cloud deployment),
    - then design depth (system design basics, scalability, reliability).
  - Keep recommendations realistic for multinational hiring standards and delivery expectations.

TARGET ROLE: ${targetRole}
CURRENT LEVEL: ${currentLevel} years experience
SKILLS TO LEARN: ${JSON.stringify(missingSkills)}

Return JSON with exactly this structure:
{
  "timelineWeeks": 8,
  "priorities": [
    {
      "skill": "Docker",
      "priority": "high",
      "weekToComplete": 2,
      "resources": ["Docker official docs", "freeCodeCamp Docker tutorial"],
      "projectIdea": "Dockerize your SmartHire AI project",
      "whyImportant": "Required for 80% of DevOps-related roles"
    }
  ],
  "projectSuggestions": ["Add Docker to SmartHire AI", "Deploy on AWS EC2"],
  "resumeTips": ["Add 'containerization' to skills", "Mention Docker in project description"],
  "estimatedImpact": "Adding these skills increases match rate by ~25%"
}`;

    logAiDebug('Learning plan prompt input', {
      missingSkills,
      targetRole,
      currentLevel,
      promptLength: prompt.length,
      promptPreview: previewText(prompt, 4000),
    });

    const response = await getClient().chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 1200,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a pragmatic engineering mentor. Produce a grounded, role-aligned learning plan and return exactly one JSON object in the requested schema.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    logAiDebug('Learning plan Groq raw response', {
      model: response?.model,
      finish_reason: response?.choices?.[0]?.finish_reason,
      usage: response?.usage,
      content: response?.choices?.[0]?.message?.content,
    });

    const fallbackPlan = buildFallbackLearningPlan(missingSkills, targetRole, currentLevel);
    const parsed = parseModelJsonOrFallback(response, {
      flowName: 'learning-plan',
      fallbackFactory: () => fallbackPlan,
    });
    const normalized = normalizeLearningPlan(parsed, fallbackPlan);
    logAiDebug('Learning plan parsed result', normalized);
    return normalized;
  } catch (err) {
    throw mapAnthropicError(err);
  }
}

module.exports = { extractResumeData, matchJobDescription, generateLearningPlan, isAnthropicConfigured };
