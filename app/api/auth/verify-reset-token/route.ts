import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import crypto from "crypto"

/**
 * POST /api/auth/verify-reset-token
 * Verify if a password reset token is valid
 * 
 * Security best practices:
 * - Hash token before comparing
 * - Check expiration
 * - Check if already used
 * - Don't reveal if token is invalid (timing attack prevention)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, email } = body

    // Validation
    if (!token || typeof token !== 'string' || token.length !== 64) {
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

    const { db } = await connectToDatabase()
    if (!db) {
      return NextResponse.json(
        { error: "Database connection unavailable" },
        { status: 503 }
      )
    }

    // Hash the provided token
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')

    // Find token in database
    const resetToken = await db.collection('password_reset_tokens').findOne({
      token_hash: tokenHash,
      email: email.toLowerCase().trim(),
      used: false
    })

    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 }
      )
    }

    // Check expiration
    const expiresAt = new Date(resetToken.expires_at)
    if (expiresAt < new Date()) {
      // Mark as used to prevent reuse
      await db.collection('password_reset_tokens').updateOne(
        { _id: resetToken._id },
        { $set: { used: true } }
      )
      
      return NextResponse.json(
        { error: "Reset token has expired. Please request a new one." },
        { status: 400 }
      )
    }

    // Token is valid
    return NextResponse.json({
      success: true,
      message: "Token is valid"
    })
  } catch (error) {
    console.error("Verify reset token error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

