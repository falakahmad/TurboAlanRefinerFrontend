/**
 * Stripe Prices API Route
 * Proxies requests to backend Stripe price management service.
 */
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_REFINER_BACKEND_URL || process.env.REFINER_BACKEND_URL || 'http://localhost:8000'
    
    // Proxy request to backend
    const response = await fetch(`${backendUrl}/stripe/prices/all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || 'Failed to get price IDs' },
        { status: response.status }
      )
    }

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to get price IDs" },
      { status: 500 }
    )
  }
}




