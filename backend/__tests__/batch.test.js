const request = require('supertest');

jest.mock('../services/claudeService', () => ({
  extractResumeData: jest.fn(async (text) => ({
    name: String(text || '').includes('Alice') ? 'Alice Johnson' : 'Bob Smith',
    technicalSkills: ['React', 'Node.js'],
    languages: ['JavaScript'],
    frameworks: ['React'],
    yearsExperience: 3,
  })),
  matchJobDescription: jest.fn(async (resumeData) => ({
    overallScore: resumeData.name === 'Alice Johnson' ? 92 : 81,
    matchedSkills: resumeData.name === 'Alice Johnson' ? ['React', 'Node.js'] : ['React'],
  })),
  isAnthropicConfigured: jest.fn(() => false),
}));

const app = require('../server');

describe('batch resume analysis', () => {
  test('returns ranked candidates for multiple uploaded resumes', async () => {
    const response = await request(app)
      .post('/api/batch/analyze')
      .field('job_description', 'Looking for a React engineer with Node.js experience')
      .attach('resumes', Buffer.from('Alice resume content '.repeat(10)), {
        filename: 'alice.txt',
        contentType: 'text/plain',
      })
      .attach('resumes', Buffer.from('Bob resume content '.repeat(10)), {
        filename: 'bob.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toMatchObject({
      rank: 1,
      name: 'Alice Johnson',
      score: 92,
      matchedSkills: ['React', 'Node.js'],
    });
    expect(response.body[1]).toMatchObject({
      rank: 2,
      name: 'Bob Smith',
      score: 81,
      matchedSkills: ['React'],
    });
  });

  test('rejects requests without files', async () => {
    const response = await request(app)
      .post('/api/batch/analyze')
      .field('job_description', 'Looking for a React engineer with Node.js experience');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'Please upload at least one resume file.' });
  });
});