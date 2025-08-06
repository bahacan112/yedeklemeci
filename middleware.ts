import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-super-secret-jwt-key-here')

// Protected routes that require authentication
const protectedRoutes = [
  '/api/backup-configs',
  '/api/backup',
  '/api/connection-test',
  '/api/onedrive',
  '/api/smtp-configs',
  '/api/email-recipients',
  '/api/cron/backup',
  '/api/cron/status'
]

// Public routes that don't require authentication
const publicRoutes = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/microsoft/setup-guide',
  '/api/microsoft/debug',
  '/api/cron/test'
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for public routes and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    publicRoutes.some(route => pathname.startsWith(route))
  ) {
    return NextResponse.next()
  }

  // Check if this is a protected API route
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  if (isProtectedRoute) {
    try {
      const token = request.cookies.get('auth-token')?.value
      
      if (!token) {
        console.log('[MIDDLEWARE] No token found for protected route:', pathname)
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      // Verify the token
      await jwtVerify(token, secret)
      console.log('[MIDDLEWARE] Token verified for protected route:', pathname)
      
    } catch (error) {
      console.error('[MIDDLEWARE] Token verification failed for route:', pathname, error)
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
