import { NextRequest, NextResponse } from "next/server"

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const backendUrl = process.env.REFINER_BACKEND_URL
  if (!backendUrl) return NextResponse.json({ error: "backend not configured" }, { status: 500 })
  
  try {
    const url = `${backendUrl.replace(/\/$/, "")}/memory/${params.userId}/export`
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "X-API-Key": process.env.BACKEND_API_KEY || "" },
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (e) {
    return NextResponse.json({ error: "memory_export_request_failed" }, { status: 500 })
  }
}
