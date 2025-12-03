import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest, { params }: { params: { file_id: string } }) {
  const backendUrl = process.env.REFINER_BACKEND_URL
  if (!backendUrl) return NextResponse.json({ error: "backend not configured" }, { status: 500 })

  try {
    const body = await request.json().catch(() => ({}))
    const url = `${backendUrl.replace(/\/$/, "")}/drive/files/${encodeURIComponent(params.file_id)}/download`
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": process.env.BACKEND_API_KEY || "" },
      body: JSON.stringify(body || { output_format: "docx" }),
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (e) {
    return NextResponse.json({ error: "drive_download_failed" }, { status: 500 })
  }
}


