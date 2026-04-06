const express = require('express');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!String(email || '').trim() || !String(password || '').trim()) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const token = jwt.sign(
    {
      sub: normalizedEmail,
      email: normalizedEmail,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return res.json({
    token,
    user: {
      email: normalizedEmail,
    },
  });
});

module.exports = router;