import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { hasTenantContext } from './lib/auth-routing';

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token';

// Routes requiring authentication
const protectedRoutes = ['/dashboard', '/profile'];

// Routes accessible only to unauthenticated users
const publicRoutes = ['/login', '/register'];

type TokenPayload = {
  exp?: number;
  is_parent?: boolean;
  tenant_id?: string;
};

function decodeTokenPayload(token: string): TokenPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    return JSON.parse(decoded) as TokenPayload;
  } catch {
    return null;
  }
}

function getUsableTokenPayload(token: string | undefined) {
  if (!token) return null;
  const payload = decodeTokenPayload(token);
  if (!payload || typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

/**
 * Enterprise-grade Next.js Proxy for Authentication and Route Protection
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const tokenPayload = getUsableTokenPayload(token);
  const isAuthenticated = tokenPayload !== null;

  const clearInvalidCookie = (response: NextResponse) => {
    if (token && !isAuthenticated) {
      response.cookies.delete(AUTH_COOKIE_NAME);
    }
    return response;
  };

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
    loginUrl.searchParams.set('redirectTo', `${pathname}${request.nextUrl.search}`);
    return clearInvalidCookie(NextResponse.redirect(loginUrl));
  }

  // 2. Authenticated user accessing a public route (e.g. /login) -> Redirect to /dashboard
  if (isPublicRoute && isAuthenticated) {
    const destination = tokenPayload?.is_parent
      ? '/kelas'
      : tokenPayload?.tenant_id
        ? hasTenantContext(tokenPayload.tenant_id)
          ? '/dashboard/tenant'
          : '/'
        : '/';
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return clearInvalidCookie(NextResponse.next());
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
