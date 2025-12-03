import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

// MongoDB helper functions
async function getMongoUser(email: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000'}/api/mongodb/users?email=${encodeURIComponent(email)}`)
    if (!response.ok) return null
    const data = await response.json()
    return data.user || null
  } catch (error) {
    console.error("Failed to get user from MongoDB:", error)
    return null
  }
}

async function insertSystemLog(logData: any) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000'}/api/mongodb/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData)
    })
  } catch (error) {
    console.error("Failed to insert system log:", error)
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const secretKey = process.env.STRIPE_SECRET_KEY
  
  if (!sig || !secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 })
  if (!secretKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

  const stripe = new Stripe(secretKey, { apiVersion: '2022-11-15' })
  let event: Stripe.Event
  try {
    const buf = Buffer.from(await request.arrayBuffer())
    event = stripe.webhooks.constructEvent(buf, sig, secret)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const customerId = session.customer as string | null
      const customerEmail = session.customer_details?.email || session.customer_email || null
      const subscriptionId = session.subscription as string | null
      const plan = session.metadata?.plan || null
      const metaUserId = (session.metadata?.userId as string | undefined) || null

      if (customerId || customerEmail) {
        // Try to resolve user_id by metadata first, then email
        let resolvedUserId: string | null = null
        try {
          if (metaUserId) {
            resolvedUserId = metaUserId
          } else if (customerEmail) {
            const user = await getMongoUser(String(customerEmail).toLowerCase())
            if (user?.id) resolvedUserId = user.id
          }
        } catch {}
        // Note: payment_customers collection can be created in MongoDB if needed
        // For now, we'll just log the event
        // Log system event
        try {
          await insertSystemLog({
            user_id: resolvedUserId,
            action: 'checkout.session.completed',
            details: `session=${session.id}, customer=${customerId}, plan=${plan}`,
          })
        } catch {}
      }
    }
  } catch (e) {
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}


