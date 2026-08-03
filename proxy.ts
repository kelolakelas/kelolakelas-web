import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isTokenExpired } from './lib/auth/token';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';

// Routes requiring authentication
const protectedRoutes = ['/dashboard', '/profile'];

// Routes accessible only to unauthenticated users
const publicRoutes = ['/login', '/register'];

/**
 * Enterprise-grade Next.js Proxy for Authentication and Route Protection
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthenticated = Boolean(token && !isTokenExpired(token));

  // Check route matches using early evaluation
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // 1. Unauthenticated user accessing a protected route -> Redirect to /login
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    if (token) {
      loginUrl.searchParams.set('reason', 'expired');
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(AUTH_COOKIE_NAME);
      response.cookies.delete(process.env.TENANT_ID_COOKIE_NAME || 'tenant_id');
      return response;
    }
    return NextResponse.redirect(loginUrl);
  }

  // 2. Authenticated user accessing a public route (e.g. /login) -> Redirect to /dashboard
  if (isPublicRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard/tenant', request.url));
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Matcher configuration:
   * Optimized to exclude static files, Next.js internal routes (_next/static, _next/image),
   * favicon.ico, public assets with extensions (e.g. svg, png, jpg, jpeg, gif, webp), and API routes.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
