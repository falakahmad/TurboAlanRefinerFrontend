import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/auth/request-password-reset
 * Proxy to backend API for password reset OTP request
 * 
 * The backend handles:
 * - OTP generation
 * - Email sending via SMTP
 * - OTP storage
 */
export async function POST(request: NextRequest) {
  try {
    const backendUrl = process.env.REFINER_BACKEND_URL
    if (!backendUrl) {
      return NextResponse.json(
        { error: "Backend not configured" },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { email } = body

    // Validation
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      )
    }

    // Call backend API
    const url = `${backendUrl.replace(/\/$/, "")}/auth/request-password-reset`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.BACKEND_API_KEY || ''
      },
      body: JSON.stringify({ email })
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || data.message || "Failed to send OTP" },
        { status: response.status }
      )
    }

    // Return success (backend handles email enumeration prevention)
    return NextResponse.json({
      success: true,
      message: data.message || "If an account with that email exists, an OTP has been sent.",
      expires_in: data.expires_in || 600
    })
  } catch (error) {
    console.error("Request password reset error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

