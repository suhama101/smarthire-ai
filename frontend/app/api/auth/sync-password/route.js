import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { newPassword } = await req.json().catch(() => ({}));

    if (!newPassword || String(newPassword).length < 6) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
    }

    const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
    const supabaseKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Supabase credentials are not configured' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const user = userData?.user;

    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 12);
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('email', user.email.toLowerCase().trim());

    if (updateError) {
      console.error('DB update error:', updateError);
      return NextResponse.json({ error: 'Failed to sync password' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Sync password error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to sync password' }, { status: 500 });
  }
}
