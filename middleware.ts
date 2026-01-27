import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Basic Auth Middleware
 * Password protects the entire site in production
 * 
 * This is a "demo gate" security measure. For production, consider implementing
 * proper authentication (e.g., Supabase Auth, NextAuth, etc.)
 */

export function middleware(request: NextRequest) {
  // Skip auth in development (optional - remove if you want auth in dev too)
  if (process.env.NODE_ENV === 'development' && process.env.BASIC_AUTH_DISABLED === 'true') {
    return NextResponse.next()
  }

  // Skip auth for static assets, API routes, and Next.js internal routes
  const pathname = request.nextUrl.pathname
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') || // API routes should not require Basic Auth
    pathname === '/favicon.ico' ||
    pathname.startsWith('/static/') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next()
  }

  // Get credentials from environment variables
  // Note: Must use NEXT_PUBLIC_ prefix for Edge Runtime (Vercel middleware)
  const authUser = process.env.NEXT_PUBLIC_BASIC_AUTH_USER || process.env.BASIC_AUTH_USER
  const authPass = process.env.NEXT_PUBLIC_BASIC_AUTH_PASS || process.env.BASIC_AUTH_PASS

  // If credentials not configured in production, block access
  if (!authUser || !authPass) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
      console.error('⚠️  Basic Auth credentials not configured - blocking access!')
      return new NextResponse('Unauthorized: Basic Auth not configured', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Vici Peptides Dashboard", charset="UTF-8"',
        },
      })
    }
    // In development, allow access if not configured
    return NextResponse.next()
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    // Return 401 with WWW-Authenticate header
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Vici Peptides Dashboard"',
      },
    })
  }

  // Decode credentials
  try {
    const base64Credentials = authHeader.split(' ')[1]
    if (!base64Credentials) {
      throw new Error('Invalid auth header')
    }
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
    const [username, password] = credentials.split(':')

    // Validate credentials
    if (username === authUser && password === authPass) {
      return NextResponse.next()
    }
  } catch (error) {
    // Invalid auth header format - return 401 to prompt again
    return new NextResponse('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Vici Peptides Dashboard", charset="UTF-8"',
      },
    })
  }

  // Invalid credentials
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Vici Peptides Dashboard"',
    },
  })
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
