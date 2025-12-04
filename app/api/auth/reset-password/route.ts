import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/auth/reset-password
 * Proxy to backend API for password reset
 * 
 * The backend handles:
 * - Token verification
 * - Password hashing
 * - MongoDB password update
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
    const { token, email, newPassword } = body

    // Validation
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: "Invalid token format" },
        { status: 400 }
      )
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: "Valid email address is required" },
        { status: 400 }
      )
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json(
        { error: "New password is required" },
        { status: 400 }
      )
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      )
    }

    // Call backend API
    const url = `${backendUrl.replace(/\/$/, "")}/auth/reset-password`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.BACKEND_API_KEY || ''
      },
      body: JSON.stringify({
        email,
        token,
        new_password: newPassword
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || data.message || "Failed to reset password" },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: data.message || "Password has been reset successfully. You can now sign in with your new password."
    })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

