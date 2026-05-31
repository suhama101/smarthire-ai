import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getBackendBaseUrl() {
  const value = process.env.API_URL || process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL;

  if (!value) {
    throw new Error('API_URL is not configured.');
  }

  return value.trim().replace(/\/$/, '');
}

export async function POST(request) {
  const backendBaseUrl = getBackendBaseUrl();
  const targetUrl = `${backendBaseUrl}/api/auth/reset-password`;
  const body = await request.json().catch(() => ({}));

  const response = await fetch(targetUrl, {
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