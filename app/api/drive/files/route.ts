import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const backendUrl = process.env.REFINER_BACKEND_URL
  if (!backendUrl) return NextResponse.json({ error: "backend not configured" }, { status: 500 })
  
  try {
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get("folder_id") || "root"
    const limit = searchParams.get("limit") || "100"
    
    const url = `${backendUrl.replace(/\/$/, "")}/drive/files?folder_id=${folderId}&limit=${limit}`
    const upstream = await fetch(url, {
      headers: { "X-API-Key": process.env.BACKEND_API_KEY || "" },
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (e) {
    return NextResponse.json({ error: "drive_files_request_failed" }, { status: 500 })
  }
}