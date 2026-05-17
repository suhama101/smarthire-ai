import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseClient } from '../../../../src/services/supabaseClient.js';
import { getJwtSecret } from '../../../../src/lib/authMiddleware.js';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

function getFirstValidationMessage(error, fallback) {
  return error?.issues?.[0]?.message || error?.errors?.[0]?.message || fallback;
}

function usesRealSupabase(client) {
  return Boolean(client && !client.__isMemory);
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
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: getFirstValidationMessage(parsed.error, 'Invalid login data') },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    let user;
    let password_hash;

    const supabase = getSupabaseClient();

    if (usesRealSupabase(supabase)) {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, password_hash, created_at')
        .eq('email', email)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }

      password_hash = data.password_hash;
      user = { id: data.id, email: data.email, full_name: data.full_name, role: data.role, created_at: data.created_at };
    } else {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, password_hash, created_at')
        .eq('email', email)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }

      password_hash = data.password_hash;
      user = { id: data.id, email: data.email, full_name: data.full_name, role: data.role, created_at: data.created_at };
    }

    const isValid = await bcrypt.compare(password, password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = generateToken(user);
    return NextResponse.json({ token, user });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}