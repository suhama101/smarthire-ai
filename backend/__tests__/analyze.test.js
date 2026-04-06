const fs = require('fs');
const path = require('path');
const request = require('supertest');

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

describe('Analyze API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('rejects resume uploads without a file', async () => {
    const response = await request(app)
      .post('/api/analyze/resume');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: expect.stringContaining('Please upload a resume file') });
  });

  test('uploads and analyzes a resume without authentication', async () => {
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
    expect(saveAnalysis).toHaveBeenCalledWith('public-user', expect.any(Object), expect.stringContaining('Jane Doe'));
  });

  test('returns a job match score without authentication', async () => {
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
      'public-user',
      'Senior Full Stack Engineer',
      'SmartHire',
      expect.stringContaining('Docker'),
      matchResult
    );
  });

  test('generates a learning plan from missing skills', async () => {
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