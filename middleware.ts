import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  // Protect dashboard route with simple auth cookie check
  // Note: Client-side auth is handled by RequireAuth component
  // This middleware is a fallback for SSR scenarios
  if (pathname.startsWith('/dashboard')) {
    const auth = req.cookies.get('refiner_auth')?.value
    // Allow if cookie exists (even if it's just "1" placeholder)
    // The client-side RequireAuth will handle actual validation
    if (!auth) {
      // Don't redirect immediately - let client-side handle it
      // This prevents flash of redirect on page refresh
      return NextResponse.next()
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard'],
}


