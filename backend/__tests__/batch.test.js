const request = require('supertest');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'test_groq_key';

jest.mock('../services/groqService', () => ({
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
  isGroqConfigured: jest.fn(() => false),
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
    expect(response.body).toMatchObject({
      message: 'Batch analysis completed successfully!',
    });
    expect(Array.isArray(response.body.rankedCandidates)).toBe(true);
    expect(response.body.rankedCandidates).toHaveLength(2);
    expect(response.body.rankedCandidates[0]).toMatchObject({
      rank: 1,
      name: 'Alice Johnson',
      score: 92,
      matchedSkills: ['React', 'Node.js'],
    });
    expect(response.body.rankedCandidates[1]).toMatchObject({
      rank: 2,
      name: 'Bob Smith',
      score: 81,
      matchedSkills: ['React'],
    });
  });

  test('accepts the frontend single-file json payload', async () => {
    const response = await request(app)
      .post('/api/batch/analyze')
      .send({
        jobTitle: 'React Engineer',
        jobDescription: 'Looking for a React engineer with Node.js experience',
        fileName: 'alice.txt',
        mimeType: 'text/plain',
        fileBase64: Buffer.from('Alice resume content '.repeat(10)).toString('base64'),
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      candidateName: 'Alice Johnson',
      matchScore: 92,
      matchedSkills: ['React', 'Node.js'],
    });
  });

  test('rejects requests without files', async () => {
    const response = await request(app)
      .post('/api/batch/analyze')
      .field('job_description', 'Looking for a React engineer with Node.js experience');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'Please upload at least one resume file.' });
  });

  test('rejects requests without a job description', async () => {
    const response = await request(app)
      .post('/api/batch/analyze')
      .attach('resumes', Buffer.from('Alice resume content '.repeat(10)), {
        filename: 'alice.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Job description is required to analyze and rank candidates',
    });
  });
});