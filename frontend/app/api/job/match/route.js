import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    const backendBaseUrl = String(process.env.API_URL || '').trim().replace(/\/$/, '');

    if (!backendBaseUrl) {
      return NextResponse.json({ error: 'API_URL is not configured.' }, { status: 500 });
    }

    const targetUrl = `${backendBaseUrl}/api/analyze/match`;
    const body = await request.text();
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('content-length');
    headers.delete('origin');

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('transfer-encoding');

    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const message = error?.message || 'Job matching failed.';

    return NextResponse.json(
      {
        error: message,
      },
      { status: status >= 400 ? status : 500 }
    );
  }
}