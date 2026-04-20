import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getBackendBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL || process.env.BACKEND_API_URL;

  if (!value) {
    throw new Error('BACKEND_API_URL is not configured.');
  }

  return value.trim().replace(/\/$/, '');
}

function normalizePathSegments(pathSegments) {
  if (Array.isArray(pathSegments)) {
    return pathSegments.filter(Boolean);
  }

  if (typeof pathSegments === 'string' && pathSegments.length > 0) {
    return [pathSegments];
  }

  return [];
}

async function proxyRequest(request, pathSegments) {
  const normalizedSegments = normalizePathSegments(pathSegments);
  const backendBaseUrl = getBackendBaseUrl();
  const targetUrl = new URL(`${backendBaseUrl}/api/${normalizedSegments.join('/')}`);
  targetUrl.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('origin');

  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const response = await fetch(targetUrl, init);
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('transfer-encoding');

  return new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request, context) {
  return proxyRequest(request, context.params?.path);
}

export async function POST(request, context) {
  return proxyRequest(request, context.params?.path);
}

export async function PUT(request, context) {
  return proxyRequest(request, context.params?.path);
}

export async function PATCH(request, context) {
  return proxyRequest(request, context.params?.path);
}

export async function DELETE(request, context) {
  return proxyRequest(request, context.params?.path);
}

export async function OPTIONS(request, context) {
  return proxyRequest(request, context.params?.path);
}