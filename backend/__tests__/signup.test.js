const express = require('express');
const request = require('supertest');

jest.mock('../services/supabaseClient', () => ({
  getSupabaseClient: jest.fn(),
}));

const { getSupabaseClient } = require('../services/supabaseClient');
const authRoutes = require('../routes/auth');

const originalJwtSecret = process.env.JWT_SECRET;

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
});

afterAll(() => {
  process.env.JWT_SECRET = originalJwtSecret;
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

describe('signup route', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('includes a generated id when inserting a new user', async () => {
    const existingLookup = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'No rows found.' } }),
    };

    const insertBuilder = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'user_123',
          email: 'test@example.com',
          full_name: 'Test User',
          role: 'candidate',
          created_at: '2026-04-15T00:00:00.000Z',
        },
        error: null,
      }),
    };

    const from = jest.fn()
      .mockImplementationOnce(() => existingLookup)
      .mockImplementationOnce(() => insertBuilder);

    getSupabaseClient.mockReturnValue({
      __isMemory: false,
      from,
    });

    const app = createApp();

    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'TestPass123!',
        full_name: 'Test User',
        role: 'candidate',
      });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      id: 'user_123',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'candidate',
    });
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'candidate',
      })
    );
  });
});