import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/auth/verify-otp
 * Proxy to backend API for OTP verification
 * 
 * The backend handles:
 * - OTP verification
 * - Temporary token generation
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
    const { email, otp } = body

    // Validation
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      )
    }

    if (!otp || typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: "Invalid OTP format. Please enter a 6-digit code." },
        { status: 400 }
      )
    }

    // Call backend API
    const url = `${backendUrl.replace(/\/$/, "")}/auth/verify-otp`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.BACKEND_API_KEY || ''
      },
      body: JSON.stringify({ email, otp })
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || data.message || "Invalid OTP" },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: data.message || "OTP verified successfully",
      temp_token: data.temp_token,
      expires_in: data.expires_in || 300
    })
  } catch (error) {
    console.error("Verify OTP error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

