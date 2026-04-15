const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { getSupabaseClient } = require('../services/supabaseClient');

const JWT_SECRET = process.env.JWT_SECRET || 'smarthire_dev_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// In-memory fallback store when Supabase is not configured
const memoryUsers = new Map();

function getDbClient() {
  return getSupabaseClient();
}

// ---------- Validation Schemas ----------
const signupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(2, 'Full name required'),
  role: z.enum(['candidate', 'recruiter']).default('candidate'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

function usesRealSupabase(client) {
  return Boolean(client && !client.__isMemory);
}

function createUserId() {
  return `user_${randomUUID()}`;
}

function isNoRowFoundError(error) {
  return error?.code === 'PGRST116' || /no rows found/i.test(String(error?.message || ''));
}

function isUniqueConstraintError(error) {
  return error?.code === '23505' || /duplicate key/i.test(String(error?.message || ''));
}

// ---------- Helper ----------
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// ---------- SIGNUP ----------
const signup = async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { email, password, full_name, role } = parsed.data;
    const password_hash = await bcrypt.hash(password, 12);
    const id = createUserId();

    const supabase = getDbClient();

    if (usesRealSupabase(supabase)) {
      // Check existing user
      const existingQuery = supabase
        .from('users')
        .select('id')
        .eq('email', email);

      const { data: existing, error: existingError } = existingQuery.maybeSingle
        ? await existingQuery.maybeSingle()
        : await existingQuery.single();

      if (existingError && !isNoRowFoundError(existingError)) {
        throw existingError;
      }

      if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Insert new user
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({ id, email, password_hash, full_name, role })
        .select('id, email, full_name, role, created_at')
        .single();

      if (error) {
        if (isUniqueConstraintError(error)) {
          return res.status(409).json({ error: 'Email already registered' });
        }
        throw error;
      }

      const token = generateToken(newUser);
      return res.status(201).json({ token, user: newUser });
    } else {
      // Memory fallback
      if (memoryUsers.has(email)) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      const user = { id, email, full_name, role, created_at: new Date().toISOString() };
      memoryUsers.set(email, { ...user, password_hash });
      const token = generateToken(user);
      return res.status(201).json({ token, user });
    }
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
};

// ---------- LOGIN ----------
const login = async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { email, password } = parsed.data;

    let user, password_hash;

    const supabase = getDbClient();

    if (usesRealSupabase(supabase)) {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, password_hash, created_at')
        .eq('email', email)
        .single();

      if (error || !data) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      password_hash = data.password_hash;
      user = { id: data.id, email: data.email, full_name: data.full_name, role: data.role, created_at: data.created_at };
    } else {
      const stored = memoryUsers.get(email);
      if (!stored) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      password_hash = stored.password_hash;
      user = { id: stored.id, email: stored.email, full_name: stored.full_name, role: stored.role, created_at: stored.created_at };
    }

    const isValid = await bcrypt.compare(password, password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    res.json({ token, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

// ---------- GET PROFILE ----------
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const supabase = getDbClient();

    if (usesRealSupabase(supabase)) {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, created_at')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get user stats
      const { count: analysisCount } = await supabase
        .from('analyses')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { count: matchCount } = await supabase
        .from('job_matches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      return res.json({
        ...data,
        stats: { analyses: analysisCount || 0, matches: matchCount || 0 },
      });
    } else {
      const stored = [...memoryUsers.values()].find((u) => u.id === userId);
      if (!stored) return res.status(404).json({ error: 'User not found' });
      const { password_hash, ...user } = stored;
      return res.json({ ...user, stats: { analyses: 0, matches: 0 } });
    }
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Could not fetch profile' });
  }
};

// ---------- UPDATE PROFILE ----------
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name } = req.body;

    if (!full_name || full_name.trim().length < 2) {
      return res.status(400).json({ error: 'Valid full name required' });
    }

    const supabase = getDbClient();

    if (usesRealSupabase(supabase)) {
      const { data, error } = await supabase
        .from('users')
        .update({ full_name: full_name.trim() })
        .eq('id', userId)
        .select('id, email, full_name, role')
        .single();

      if (error) throw error;
      return res.json({ message: 'Profile updated', user: data });
    } else {
      for (const [key, val] of memoryUsers) {
        if (val.id === userId) {
          memoryUsers.set(key, { ...val, full_name });
          break;
        }
      }
      return res.json({ message: 'Profile updated' });
    }
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Could not update profile' });
  }
};

module.exports = { signup, login, getProfile, updateProfile };