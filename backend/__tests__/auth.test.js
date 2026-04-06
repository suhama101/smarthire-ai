const jwt = require('jsonwebtoken');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

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
    const req = { header: jest.fn(() => '') };
    const res = createResponse();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects requests with an invalid JWT', () => {
    const req = { header: jest.fn(() => 'Bearer not-a-valid-token') };
    const res = createResponse();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts a valid JWT and attaches the user payload', () => {
    const token = jwt.sign({ sub: 'user-123', email: 'user@example.com' }, JWT_SECRET, { expiresIn: '1h' });
    const req = { header: jest.fn(() => `Bearer ${token}`) };
    const res = createResponse();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 'user-123', email: 'user@example.com' });
    expect(res.status).not.toHaveBeenCalled();
  });
});