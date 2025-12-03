import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const backendUrl = process.env.REFINER_BACKEND_URL
  if (!backendUrl) return NextResponse.json({ error: "backend not configured" }, { status: 500 })
  
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get("fileId")
    const fromPass = searchParams.get("fromPass")
    const toPass = searchParams.get("toPass")
    const mode = searchParams.get("mode") || "sentence"

    if (!fileId || !fromPass || !toPass) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    const url = `${backendUrl.replace(/\/$/, "")}/refine/diff?fileId=${fileId}&fromPass=${fromPass}&toPass=${toPass}&mode=${mode}`
    const upstream = await fetch(url, {
      headers: { "X-API-Key": process.env.BACKEND_API_KEY || "" },
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (e) {
    return NextResponse.json({ error: "diff_request_failed" }, { status: 500 })
  }
}