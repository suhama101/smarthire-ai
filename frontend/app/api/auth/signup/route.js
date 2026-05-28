import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseClient } from '../../../../src/services/supabaseClient.js';
import { getJwtSecret } from '../../../../src/lib/authMiddleware.js';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const signupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  full_name: z.string().min(2, 'Full name required'),
  role: z.enum(['candidate', 'recruiter']).default('candidate'),
});

function getFirstValidationMessage(error, fallback) {
  return error?.issues?.[0]?.message || error?.errors?.[0]?.message || fallback;
}

function usesRealSupabase(client) {
  return Boolean(client && !client.__isMemory);
}

function createUserId() {
  return randomUUID();
}

function isNoRowFoundError(error) {
  return error?.code === 'PGRST116' || /no rows found/i.test(String(error?.message || ''));
}

function isUniqueConstraintError(error) {
  return error?.code === '23505' || /duplicate key/i.test(String(error?.message || ''));
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: getFirstValidationMessage(parsed.error, 'Invalid signup data') },
        { status: 400 }
      );
    }

    const { email, password, full_name } = parsed.data;
    const role = String(parsed.data.role || 'candidate').toLowerCase();
    const password_hash = await bcrypt.hash(password, 12);
    const id = createUserId();

    const supabase = getSupabaseClient();

    if (usesRealSupabase(supabase)) {
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
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
      }

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({ id, email, password_hash, full_name, role })
        .select('id, email, full_name, role, created_at')
        .single();

      if (error) {
        if (isUniqueConstraintError(error)) {
          return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
        }

        return NextResponse.json(
          { error: error?.message || 'Signup failed. Please try again.' },
          { status: error?.status || 500 }
        );
      }

      const token = generateToken(newUser);
      return NextResponse.json({ token, user: { ...newUser, user_metadata: { role } } }, { status: 201 });
    }

    const existingQuery = supabase
      .from('users')
      .select('id')
      .eq('email', email);
    const { data: existing } = existingQuery.maybeSingle
      ? await existingQuery.maybeSingle()
      : await existingQuery.single();

    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ id, email, password_hash, full_name, role, created_at: new Date().toISOString() })
      .select('id, email, full_name, role, created_at')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error?.message || 'Signup failed. Please try again.' },
        { status: error?.status || 500 }
      );
    }

    const token = generateToken(newUser);
    return NextResponse.json({ token, user: { ...newUser, user_metadata: { role } } }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || 'Signup failed. Please try again.' },
      { status: err?.status || 500 }
    );
  }
}