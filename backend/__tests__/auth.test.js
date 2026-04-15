const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'smarthire_dev_secret';

function createResponse() {
  const res = {};
  res.statusCode = 200;
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.body = payload;
    return res;
  });
  return res;
}

describe('requireAuth middleware', () => {
  test('rejects requests without a bearer token', () => {
    const req = { headers: {} };
    const res = createResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toMatchObject({ error: 'No token provided. Please login.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects requests with an invalid JWT', () => {
    const req = { headers: { authorization: 'Bearer not-a-valid-token' } };
    const res = createResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts a valid JWT and attaches the user payload', () => {
    const token = jwt.sign({ id: 'user-123', email: 'user@example.com', role: 'candidate' }, JWT_SECRET, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = createResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual(expect.objectContaining({ id: 'user-123', email: 'user@example.com', role: 'candidate' }));
    expect(res.status).not.toHaveBeenCalled();
  });
});