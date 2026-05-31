import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { saveResetToken } from '@/services/db';
import { sendPasswordResetEmail } from '@/services/emailService';
import { createClient } from '@/lib/supabaseClient';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body?.email || '').trim();

  if (!email) {
    return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
  }

  const supabase = createClient();
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (user) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await saveResetToken(user.id, token, expiresAt);

    try {
      await sendPasswordResetEmail(email, `https://smarthire-ai-lrq8.vercel.app/reset-password?token=${encodeURIComponent(token)}`);
    } catch (error) {
      console.error('Password reset email failed:', error);
    }
  }

  return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' });
}