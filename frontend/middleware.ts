import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Set your password here
const SITE_PASSWORD = 'lgs2026'

export function middleware(request: NextRequest) {
  // Skip auth in development
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next()
  }

  const authHeader = request.headers.get('authorization')

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ')
    if (scheme === 'Basic') {
      const decoded = atob(encoded)
      const [user, password] = decoded.split(':')

      if (password === SITE_PASSWORD) {
        return NextResponse.next()
      }
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  })
}

export const config = {
  matcher: [
    // Protect all routes except static files and api
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
}
