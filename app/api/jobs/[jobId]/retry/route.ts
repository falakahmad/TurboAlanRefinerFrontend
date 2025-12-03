import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest, { params }: { params: { jobId: string } }) {
  const backendUrl = process.env.REFINER_BACKEND_URL
  if (!backendUrl) return NextResponse.json({ error: "backend not configured" }, { status: 500 })
  try {
    const body = await request.json()
    const url = `${backendUrl.replace(/\/$/, "")}/jobs/${params.jobId}/retry`
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": process.env.BACKEND_API_KEY || "" },
      body: JSON.stringify(body),
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch {
    return NextResponse.json({ error: "retry_failed" }, { status: 500 })
  }
}

