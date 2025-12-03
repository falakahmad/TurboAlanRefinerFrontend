import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { file_id: string } }) {
  const backendUrl = process.env.REFINER_BACKEND_URL
  if (!backendUrl) return NextResponse.json({ error: "backend not configured" }, { status: 500 })

  try {
    const url = `${backendUrl.replace(/\/$/, "")}/drive/files/${encodeURIComponent(params.file_id)}`
    const upstream = await fetch(url, {
      method: "GET",
      headers: { "X-API-Key": process.env.BACKEND_API_KEY || "" },
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (e) {
    return NextResponse.json({ error: "drive_get_file_failed" }, { status: 500 })
  }
}


