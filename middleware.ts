import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = pathname.startsWith('/dashboard') ||
                      pathname.startsWith('/spaces/');
  if (isProtected && !req.auth) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/spaces/:path*'],
};
