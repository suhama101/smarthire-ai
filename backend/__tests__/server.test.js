const request = require('supertest');

const originalNodeEnv = process.env.NODE_ENV;
const originalCorsOrigins = process.env.CORS_ORIGINS;

process.env.NODE_ENV = 'production';
process.env.CORS_ORIGINS = 'https://your-app.vercel.app,https://custom-domain.com';

const app = require('../server');

describe('CORS configuration', () => {
  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.CORS_ORIGINS = originalCorsOrigins;
  });

  test('allows explicitly allowlisted origins', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'https://your-app.vercel.app');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://your-app.vercel.app');
    expect(response.body).toMatchObject({ status: 'ok' });
  });

  test('rejects localhost origins in production unless explicitly allowlisted', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:3000');

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'CORS_BLOCKED' });
  });
});
