const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

jest.mock('../services/db', () => ({
  saveAnalysis: jest.fn(),
  getAnalysisById: jest.fn(),
  saveJobMatch: jest.fn(),
  deleteAnalysisById: jest.fn(),
  deleteJobMatchById: jest.fn(),
  seedDemoDataIfEmpty: jest.fn(),
}));

jest.mock('../services/claudeService', () => ({
  extractResumeData: jest.fn(),
  matchJobDescription: jest.fn(),
  generateLearningPlan: jest.fn(),
  isAnthropicConfigured: jest.fn(() => false),
}));

jest.mock('../services/resumeParser', () => {
  const actual = jest.requireActual('../services/resumeParser');

  return {
    ...actual,
    extractTextFromFile: jest.fn(),
    cleanText: jest.fn((value) => String(value || '').replace(/\s+/g, ' ').trim()),
  };
});

const { saveAnalysis, getAnalysisById, saveJobMatch } = require('../services/db');
const { extractResumeData, matchJobDescription, generateLearningPlan } = require('../services/claudeService');
const { extractTextFromFile } = require('../services/resumeParser');
const app = require('../server');

function makeToken(userId = 'candidate-1') {
  return jwt.sign({ sub: userId, email: `${userId}@example.com` }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Analyze API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('blocks unauthenticated resume uploads', async () => {
    const response = await request(app)
      .post('/api/analyze/resume')
      .attach('resume', Buffer.from('hello world'), {
        filename: 'resume.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('uploads and analyzes a resume with a valid JWT', async () => {
    const token = makeToken('candidate-1');
    const rawText = 'Jane Doe is a backend engineer with JavaScript, Node.js, React, Docker, PostgreSQL, AWS, Git, testing, and CI/CD experience in production teams.';

    extractTextFromFile.mockResolvedValue(rawText);
    extractResumeData.mockResolvedValue({
      summary: 'Experienced backend engineer.',
      technicalSkills: ['JavaScript', 'Node.js', 'Docker'],
      yearsExperience: 6,
    });
    saveAnalysis.mockResolvedValue({
      id: 'analysis-123',
      created_at: '2026-04-06T12:00:00.000Z',
    });

    const response = await request(app)
      .post('/api/analyze/resume')
      .set('Authorization', `Bearer ${token}`)
      .attach('resume', Buffer.from('fake resume content'), {
        filename: 'resume.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: 'Resume analyzed successfully!',
      analysisId: 'analysis-123',
      dataSource: 'fallback',
    });
    expect(extractTextFromFile).toHaveBeenCalled();
    expect(extractResumeData).toHaveBeenCalledWith(expect.stringContaining('Jane Doe'));
    expect(saveAnalysis).toHaveBeenCalledWith('candidate-1', expect.any(Object), expect.stringContaining('Jane Doe'));
  });

  test('returns a job match score for authenticated users', async () => {
    const token = makeToken('candidate-2');
    const resumeData = {
      technicalSkills: ['JavaScript', 'React', 'Node.js'],
      frameworks: ['Express'],
      languages: ['JavaScript'],
      databases: ['PostgreSQL'],
      tools: ['Git'],
      yearsExperience: 4,
    };

    const matchResult = {
      overallScore: 84,
      breakdown: {
        technicalSkills: 90,
        experience: 80,
        keywords: 82,
        education: 75,
      },
      matchedSkills: ['React', 'Node.js'],
      missingSkills: ['Docker', 'Kubernetes'],
      strengths: ['Strong full-stack delivery background.'],
      gaps: ['Needs more containerization exposure.'],
      recommendation: 'Add Docker and deployment experience.',
      atsKeywords: ['Docker', 'Kubernetes'],
    };

    getAnalysisById.mockResolvedValue({ id: 'analysis-123', resume_data: resumeData });
    matchJobDescription.mockResolvedValue(matchResult);
    saveJobMatch.mockResolvedValue({ id: 'match-456', created_at: '2026-04-06T12:15:00.000Z' });

    const response = await request(app)
      .post('/api/analyze/match')
      .set('Authorization', `Bearer ${token}`)
      .send({
        analysisId: 'analysis-123',
        jobTitle: 'Senior Full Stack Engineer',
        companyName: 'SmartHire',
        jobDescription: 'We need a senior engineer with JavaScript, React, Node.js, Docker, Kubernetes, PostgreSQL, Git, and CI/CD experience. The role owns delivery for production web applications and platform quality.',
      });

    expect(response.status).toBe(200);
    expect(response.body.matchResult).toMatchObject(matchResult);
    expect(saveJobMatch).toHaveBeenCalledWith(
      'analysis-123',
      'candidate-2',
      'Senior Full Stack Engineer',
      'SmartHire',
      expect.stringContaining('Docker'),
      matchResult
    );
  });

  test('generates a learning plan from missing skills', async () => {
    const token = makeToken('candidate-3');
    const plan = {
      timelineWeeks: 8,
      priorities: [
        {
          skill: 'Docker',
          priority: 'high',
          weekToComplete: 2,
          resources: ['Docker docs'],
          projectIdea: 'Containerize SmartHire AI',
          whyImportant: 'Useful for deployment readiness',
        },
      ],
      projectSuggestions: ['Containerize the app'],
      resumeTips: ['Mention deployment tooling'],
      estimatedImpact: 'Improves fit for production roles.',
    };

    generateLearningPlan.mockResolvedValue(plan);

    const response = await request(app)
      .post('/api/analyze/learning-plan')
      .set('Authorization', `Bearer ${token}`)
      .send({
        missingSkills: ['Docker', 'Kubernetes'],
        targetRole: 'Senior Full Stack Engineer',
        yearsExperience: 5,
      });

    expect(response.status).toBe(200);
    expect(response.body.learningPlan).toMatchObject(plan);
    expect(generateLearningPlan).toHaveBeenCalledWith(['Docker', 'Kubernetes'], 'Senior Full Stack Engineer', 5);
  });
});