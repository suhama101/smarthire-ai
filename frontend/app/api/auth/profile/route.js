import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getUserStats } from '../../../../src/services/db.js';
import { getSupabaseClient } from '../../../../src/services/supabaseClient.js';
import { getJwtSecret } from '../../../../src/lib/authMiddleware.js';

const updateProfileSchema = z.object({
  full_name: z.string().min(2, 'Valid full name required'),
});

function getBearerToken(request) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.split(' ')[1];
}

function getAuthenticatedUser(request) {
  const token = getBearerToken(request);

  if (!token) {
    return { error: NextResponse.json({ error: 'No token provided. Please login.' }, { status: 401 }) };
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    return { user: decoded };
  } catch (err) {
    if (err?.name === 'TokenExpiredError') {
      return { error: NextResponse.json({ error: 'Token expired. Please login again.' }, { status: 401 }) };
    }

    return { error: NextResponse.json({ error: 'Invalid token.' }, { status: 401 }) };
  }
}

function usesRealSupabase(client) {
  return Boolean(client && !client.__isMemory);
}

export async function GET(request) {
  try {
    const authResult = getAuthenticatedUser(request);
    if (authResult.error) {
      return authResult.error;
    }

    const userId = authResult.user.id;
    const supabase = getSupabaseClient();

    if (usesRealSupabase(supabase)) {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, created_at')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const stats = await getUserStats(userId);

      return NextResponse.json({
        ...data,
        stats,
      });
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const stats = await getUserStats(userId);

    return NextResponse.json({ ...data, stats });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Could not fetch profile' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const authResult = getAuthenticatedUser(request);
    if (authResult.error) {
      return authResult.error;
    }

    const userId = authResult.user.id;
    const body = await request.json().catch(() => ({}));
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error?.issues?.[0]?.message || 'Valid full name required' },
        { status: 400 }
      );
    }

    const { full_name } = parsed.data;
    const supabase = getSupabaseClient();

    if (usesRealSupabase(supabase)) {
      const { data, error } = await supabase
        .from('users')
        .update({ full_name: full_name.trim() })
        .eq('id', userId)
        .select('id, email, full_name, role')
        .single();

      if (error) {
        return NextResponse.json(
          { error: error?.message || 'Could not update profile' },
          { status: error?.status || 500 }
        );
      }

      return NextResponse.json({ message: 'Profile updated', user: data });
    }

    const { data: currentUser } = await supabase
      .from('users')
      .select('id, email, full_name, role, created_at, password_hash')
      .eq('id', userId)
      .maybeSingle();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('users')
      .update({ full_name: full_name.trim() })
      .eq('id', userId)
      .select('id, email, full_name, role, created_at')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error?.message || 'Could not update profile' },
        { status: error?.status || 500 }
      );
    }

    return NextResponse.json({ message: 'Profile updated', user: data });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'Could not update profile' }, { status: 500 });
  }
}