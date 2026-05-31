import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { getResetToken } from '@/services/db';
import { createClient } from '@/lib/supabaseClient';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const token = String(body?.token || '').trim();
  const newPassword = String(body?.newPassword || '').trim();

  if (!token || !newPassword) {
    return NextResponse.json({ error: 'Token and new password are required.' }, { status: 400 });
  }

  const resetToken = await getResetToken(token);

  if (!resetToken) {
    return NextResponse.json({ error: 'Reset token is invalid or expired.' }, { status: 400 });
  }

  const supabase = createClient();
  const password_hash = await bcrypt.hash(newPassword, 12);

  const { error: userUpdateError } = await supabase
    .from('users')
    .update({ password_hash })
    .eq('id', resetToken.user_id);

  if (userUpdateError) {
    return NextResponse.json({ error: userUpdateError.message || 'Could not update password.' }, { status: 500 });
  }

  const { error: tokenUpdateError } = await supabase
    .from('password_reset_tokens')
    .update({ used: true })
    .eq('token', token);

  if (tokenUpdateError) {
    return NextResponse.json({ error: tokenUpdateError.message || 'Could not finalize password reset.' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Password updated successfully.' });
}