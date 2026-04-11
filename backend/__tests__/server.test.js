const request = require('supertest');

const originalNodeEnv = process.env.NODE_ENV;
const originalCorsOrigins = process.env.CORS_ORIGINS;

process.env.NODE_ENV = 'production';
process.env.CORS_ORIGINS = 'https://your-frontend.example.com';

const app = require('../server');

describe('CORS configuration', () => {
  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.CORS_ORIGINS = originalCorsOrigins;
  });

  test('allows localhost origins when the allowlist still uses the placeholder frontend URL', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:3000');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.body).toMatchObject({ status: 'ok' });
  });
});
