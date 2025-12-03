import { NextResponse } from "next/server"

export async function GET() {
  const backendUrl = process.env.REFINER_BACKEND_URL
  if (backendUrl) {
    try {
      const url = `${backendUrl.replace(/\/$/, "")}/history/profile`
      const upstream = await fetch(url, { cache: "no-store", headers: { "X-API-Key": process.env.BACKEND_API_KEY || "" } })
      if (upstream.ok) {
        const data = await upstream.json()
        return NextResponse.json(data)
      }
    } catch (e) {
      // fall through to mock
    }
  }
  // Fallback mock
  return NextResponse.json({
    brevity_bias: 0.42,
    formality_bias: 0.55,
    structure_bias: 0.61,
  })
}



