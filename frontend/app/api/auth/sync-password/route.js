import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { newPassword } = await req.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const bcrypt = await import('bcryptjs');
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
