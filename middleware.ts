import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Session-based Authentication Middleware
 * Protects the entire site with login page authentication
 */

export function middleware(request: NextRequest) {
  // Skip auth in development (optional - remove if you want auth in dev too)
  if (process.env.NODE_ENV === 'development' && process.env.BASIC_AUTH_DISABLED === 'true') {
    return NextResponse.next()
  }

  // Skip auth for static assets, API routes, login page, and Next.js internal routes
  const pathname = request.nextUrl.pathname
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname === '/login' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/static/') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next()
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get('auth_session')

  // If no session cookie, redirect to login
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url)
    // Preserve the original URL for redirect after login
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Session exists - allow access
  return NextResponse.next()
}

// Configure which routes to protect
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes - these should not require Basic Auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
