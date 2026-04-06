const express = require('express');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function createTokenPayload(email) {
  return {
    sub: email,
    email,
  };
}

function createAuthResponse(email, message) {
  const token = jwt.sign(createTokenPayload(email), JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return {
    token,
    user: {
      email,
    },
    message,
  };
}

router.post('/signup', (req, res) => {
  const { email, password } = req.body || {};

  if (!String(email || '').trim() || !String(password || '').trim()) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  return res.status(201).json(createAuthResponse(normalizedEmail, 'Signup successful.'));
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!String(email || '').trim() || !String(password || '').trim()) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  return res.json(createAuthResponse(normalizedEmail, 'Login successful.'));
});

module.exports = router;