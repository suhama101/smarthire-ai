const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'smarthire-dev-secret';

function requireAuth(req, res, next) {
  const authorization = String(req.header('authorization') || '').trim();
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      error: 'Authentication required. Please provide a valid JWT.',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub || payload.userId || payload.id || payload.email,
      email: payload.email || null,
    };

    if (!req.user.id) {
      return res.status(401).json({
        error: 'Authentication required. Please provide a valid JWT.',
        code: 'UNAUTHORIZED',
      });
    }

    return next();
  } catch (err) {
    return res.status(401).json({
      error: 'Authentication required. Please provide a valid JWT.',
      code: 'UNAUTHORIZED',
    });
  }
}

module.exports = { requireAuth, JWT_SECRET };