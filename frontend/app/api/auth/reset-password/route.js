import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { getResetToken, updateUserPassword } from '@/services/db';
import { createClient } from '@/lib/supabaseClient';

async function findAuthUserByEmail(supabase, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail || !supabase?.auth?.admin?.listUsers) {
    return null;
  }

  let page = 1;
  const perPage = 1000;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    const users = data?.users || [];
    const match = users.find((user) => String(user?.email || '').trim().toLowerCase() === normalizedEmail);

    if (match) {
      return match;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }

  return null;
}

async function updateSupabaseAuthPassword(supabase, userId, email, newPassword) {
  if (!supabase?.auth?.admin?.updateUserById) {
    return { updated: false, reason: 'Supabase Auth admin API is unavailable.' };
  }

  const { error: directUpdateError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (!directUpdateError) {
    return { updated: true };
  }

  const authUser = await findAuthUserByEmail(supabase, email);

  if (!authUser?.id) {
    return {
      updated: false,
      reason: `No Supabase Auth user found for ${email}.`,
      directUpdateError,
    };
  }

  const { error: emailUpdateError } = await supabase.auth.admin.updateUserById(authUser.id, {
    password: newPassword,
  });

  if (emailUpdateError) {
    throw emailUpdateError;
  }

  return { updated: true, authUserId: authUser.id };
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body?.token || '').trim();
  const newPassword = String(body?.newPassword || '').trim();

  console.log('[reset-password] token received', {
    tokenPreview: token ? `${token.slice(0, 8)}...` : '',
    tokenLength: token.length,
  });

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Token and new password are required.' }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
  }

  let resetToken;

  try {
    resetToken = await getResetToken(token);
    console.log('[reset-password] getResetToken result', resetToken ? {
      userId: resetToken.userId,
      expires_at: resetToken.expires_at,
      used: resetToken.used,
    } : null);
  } catch (error) {
    console.error('[reset-password] getResetToken error', error);
    return NextResponse.json({ error: error?.message || 'Could not validate reset token.' }, { status: 500 });
  }

  if (!resetToken) {
    return NextResponse.json({ error: 'Reset token is invalid or expired.' }, { status: 400 });
  }

  const supabase = createClient();

  try {
    console.log('[reset-password] hashing new password');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    console.log('[reset-password] hashed password ready', { hashLength: hashedPassword.length });

    console.log('[reset-password] before password update', { userId: resetToken.userId });
    const updatedUser = await updateUserPassword(resetToken.userId, hashedPassword);
    console.log('[reset-password] after password update', { userId: updatedUser.id, email: updatedUser.email });

    console.log('[reset-password] updating Supabase Auth password', { userId: updatedUser.id, email: updatedUser.email });
    const authUpdate = await updateSupabaseAuthPassword(supabase, updatedUser.id, updatedUser.email, newPassword);

    if (!authUpdate.updated) {
      console.warn('[reset-password] Supabase Auth password was not updated', {
        userId: updatedUser.id,
        email: updatedUser.email,
        reason: authUpdate.reason,
        directUpdateError: authUpdate.directUpdateError?.message,
      });
    } else {
      console.log('[reset-password] Supabase Auth password updated', {
        userId: updatedUser.id,
        authUserId: authUpdate.authUserId || updatedUser.id,
      });
    }

    console.log('[reset-password] marking token as used', { tokenPreview: `${token.slice(0, 8)}...` });
    const { error: tokenUpdateError } = await supabase
      .from('password_reset_tokens')
      .update({ used: true })
      .eq('token', token);

    if (tokenUpdateError) {
      console.error('[reset-password] token update error', tokenUpdateError);
      return NextResponse.json({ error: tokenUpdateError.message || 'Could not finalize password reset.' }, { status: 500 });
    }

    console.log('[reset-password] token marked as used successfully');

    return NextResponse.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('[reset-password] password update error', error);
    return NextResponse.json({ error: error?.message || 'Could not reset password.' }, { status: 500 });
  }
}
