import { NextResponse } from 'next/server';

import { getSupabaseClient } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || body.user_id || '').trim();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase credentials are not configured.' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { error: error?.message || 'Failed to load history.' },
        { status: error?.status || 500 }
      );
    }

    return NextResponse.json({ analyses: data || [] }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || 'Failed to load history.' },
      { status: 500 }
    );
  }
}