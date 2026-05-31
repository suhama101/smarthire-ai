import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').trim().replace(/\/$/, '');

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  const response = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/json',
    },
  });
}