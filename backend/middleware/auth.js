const jwt = require('jsonwebtoken');

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();

  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  return secret;
}

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided. Please login.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, getJwtSecret());

    req.user = decoded; // { id, email, role }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

const requireRole = (role) => (req, res, next) => {
  if (req.user?.role !== role) {
    return res.status(403).json({ error: `Access denied. Requires role: ${role}` });
  }
  next();
};

module.exports = { authMiddleware, requireRole };