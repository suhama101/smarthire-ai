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
  try {
    const backendBaseUrl = getBackendBaseUrl();
    const targetUrl = new URL(`${backendBaseUrl}/api/batch/save`);

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('content-length');
    headers.delete('origin');

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      redirect: 'manual',
      body: await request.text(),
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('transfer-encoding');

    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err?.message || 'Failed to save batch run.',
      },
      { status: 500 }
    );
  }
}