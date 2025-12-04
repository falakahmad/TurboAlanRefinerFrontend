import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import crypto from "crypto"

/**
 * POST /api/auth/forgot-password
 * Request a password reset token for the given email
 * 
 * Security best practices:
 * - Always return success message (don't reveal if email exists)
 * - Generate cryptographically secure token
 * - Set expiration time (1 hour)
 * - Store hashed token in database
 * - Rate limit should be applied at middleware level
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    // Validation
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

    // Check if user exists
    const user = await db.collection('users').findOne({ 
      email: email.toLowerCase().trim() 
    })

    // Always return success to prevent email enumeration
    // But only create token if user exists
    let resetToken: string | null = null
    let resetUrl: string | null = null

    if (user) {
      // Generate secure random token
      resetToken = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex')

      // Set expiration (1 hour from now)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

      // Store reset token in database
      await db.collection('password_reset_tokens').insertOne({
        user_id: user.id || user._id?.toString(),
        email: email.toLowerCase().trim(),
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_at: new Date(),
        used: false
      })

      // Create reset URL
      resetUrl = `${request.nextUrl.origin}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`
      
      // In development mode, log the URL for testing
      // In production, this should be sent via email service
      if (process.env.NODE_ENV === 'development') {
        console.log('🔐 Password Reset URL (Development Mode):', resetUrl)
        console.log('📧 Email:', email)
        console.log('🔑 Token:', resetToken)
      }

      // TODO: Send email with reset link in production
      // Example: await sendPasswordResetEmail(email, resetUrl)
      // You can use services like:
      // - SendGrid
      // - AWS SES
      // - Resend
      // - Nodemailer with SMTP
    }

    // Always return success message (security best practice - prevents email enumeration)
    const response: any = {
      success: true,
      message: "If an account with that email exists, a password reset link has been sent."
    }

    // Only include token in development for testing
    if (process.env.NODE_ENV === 'development' && resetToken && resetUrl) {
      response.token = resetToken
      response.resetUrl = resetUrl
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Forgot password error:", error)
    // Don't reveal internal errors
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

