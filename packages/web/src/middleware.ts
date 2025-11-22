import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getMetricsTracker } from '@/lib/metrics-tracker';

export async function middleware(req: NextRequest) {
  const startTime = Date.now();

  // Get Auth.js JWT token
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const isAuthenticated = !!token;

  // Protected routes - require authentication
  const protectedPaths = ['/dashboard'];
  const isProtectedPath = protectedPaths.some(path =>
    req.nextUrl.pathname === path || req.nextUrl.pathname.startsWith(`${path}/`)
  );

  // Auth routes - should redirect to dashboard if already authenticated
  const authPaths = ['/login', '/signup'];
  const isAuthPath = authPaths.includes(req.nextUrl.pathname);

  // If accessing protected route without session, redirect to login
  if (isProtectedPath && !isAuthenticated) {
    const redirectUrl = new URL('/login', req.url);
    return NextResponse.redirect(redirectUrl);
  }

  // If accessing auth route with session, redirect to dashboard
  if (isAuthPath && isAuthenticated) {
    const redirectUrl = new URL('/dashboard', req.url);
    return NextResponse.redirect(redirectUrl);
  }

  const response = NextResponse.next();

  // Track metrics for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const responseTime = Date.now() - startTime;
    const tracker = getMetricsTracker();

    if (tracker) {
      // Extract caller service from distributed tracing header
      const callerServiceName = req.headers.get('X-Origin-Service') || undefined;

      tracker.track({
        method: req.method,
        path: req.nextUrl.pathname,
        statusCode: response.status,
        responseTime,
        timestamp: new Date(),
        callerServiceName,
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api/auth (Auth.js routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
