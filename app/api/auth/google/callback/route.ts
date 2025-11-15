import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

export async function GET(request: NextRequest) {
  // Use request origin dynamically to support both localhost and production
  const origin = request.nextUrl.origin
  const REDIRECT_URI = `${origin}/api/auth/google/callback`
  const baseUrl = origin

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Check for OAuth errors
  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/?error=${encodeURIComponent('Google OAuth failed: ' + error)}&login=1`
    )
  }

  // Verify state
  const storedState = request.cookies.get('google_oauth_state')?.value
  if (!state || state !== storedState) {
    return NextResponse.redirect(
      `${baseUrl}/?error=${encodeURIComponent('Invalid OAuth state. Please try again.')}&login=1`
    )
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/?error=${encodeURIComponent('No authorization code received.')}&login=1`
    )
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(
      `${baseUrl}/?error=${encodeURIComponent('Google OAuth is not configured.')}&login=1`
    )
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(
        `${baseUrl}/?error=${encodeURIComponent('Failed to exchange authorization code.')}&login=1`
      )
    }

    const tokens = await tokenResponse.json()
    const { access_token } = tokens

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(
        `${baseUrl}/?error=${encodeURIComponent('Failed to fetch user information.')}&login=1`
      )
    }

    const userInfo = await userInfoResponse.json()
    const { email, name, picture, id: googleId } = userInfo

    // Parse name into first and last name
    const nameParts = name ? name.split(' ') : []
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    // Create or sign in user via our auth API
    const authResponse = await fetch(`${request.nextUrl.origin}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'google_signin',
        email,
        firstName,
        lastName,
        googleId,
        avatarUrl: picture,
      }),
    })

    if (!authResponse.ok) {
      const errorData = await authResponse.json()
      return NextResponse.redirect(
        `${baseUrl}/?error=${encodeURIComponent(errorData.error || 'Authentication failed')}&login=1`
      )
    }

    const authData = await authResponse.json()

    // Create redirect URL with token in hash (more secure than query param)
    const redirectUrl = new URL('/auth/google/success', baseUrl)
    redirectUrl.hash = `token=${encodeURIComponent(authData.token || '')}&user=${encodeURIComponent(JSON.stringify(authData.user || {}))}`

    // Clear OAuth state cookie
    const response = NextResponse.redirect(redirectUrl.toString())
    response.cookies.delete('google_oauth_state')

    // Also set auth cookie for middleware
    if (authData.token) {
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      response.cookies.set('refiner_auth', authData.token, {
        path: '/',
        expires,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: false, // Needs to be accessible by client-side JS
      })
    }

    return response
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return NextResponse.redirect(
      `${baseUrl}/?error=${encodeURIComponent('An error occurred during authentication.')}&login=1`
    )
  }
}

