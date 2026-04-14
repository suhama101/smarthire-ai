import { NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = 'smarthire.auth';

export function middleware(request) {
  const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (authToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('from', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*', '/batch/:path*', '/history/:path*'],
};